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
  "inlineSchema": 'model BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author User @relation("AuthorPosts", fields: [authorId], references: [id])\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nmodel Payment {\n  id             String        @id @default(uuid())\n  bookingId      String\n  tranId         String        @unique // SSLCommerz transaction id, generated server-side\n  valId          String? // set after gateway success, used for server-side validation\n  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency       String        @default("BDT")\n  status         PaymentStatus @default(INITIATED)\n  gatewayPageUrl String?\n  sslSessionKey  String?\n  cardType       String?\n  bankTranId     String?\n  paidAt         DateTime?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel Review {\n  id      String @id @default(uuid())\n  rating  Int\n  comment String\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category Category  @relation(fields: [categoryId], references: [id])\n  agent    User      @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings Booking[]\n  reviews  Review[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[] @relation("AgentPackages")\n  bookings Booking[]     @relation("CustomerBookings")\n  reviews  Review[]      @relation("CustomerReviews")\n  posts    BlogPost[]    @relation("AuthorPosts")\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n',
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
config2.runtimeDataModel = JSON.parse('{"models":{"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"}],"dbName":"users"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","posts","author","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","data","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","create","update","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","having","_min","_max","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","AND","OR","NOT","id","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","userId","packageId","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","subject","message","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "lARPgAEPDgAAoQIAIJcBAACfAgAwmAEAABoAEJkBAACfAgAwmgEBAAAAAaQBAACgAuEBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAd0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhAQAAAAEAIBYFAACwAgAgBgAAoQIAIAsAAP4BACAMAAD_AQAglwEAAK0CADCYAQAAAwAQmQEAAK0CADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhBAUAAOQDACAGAADgAwAgCwAArwMAIAwAALADACAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAAAAAaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEA9QEAIaQBAACrAt0BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2QFAAPwBACHaAQIA-wEAIdsBEACmAgAhAwcAAOADACAIAADhAwAgCgAA4wMAIA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQAAAAGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQMAAAAJACABAAAKADACAAALACASCQAAqQIAIJcBAAClAgAwmAEAAA0AEJkBAAClAgAwmgEBAPUBACGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEA9QEAIc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACEHCQAA4gMAIM0BAACxAgAg0QEAALECACDSAQAAsQIAINMBAACxAgAg1AEAALECACDVAQAAsQIAIBIJAACpAgAglwEAAKUCADCYAQAADQAQmQEAAKUCADCaAQEAAAABpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAAAAAc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIAwHAAChAgAgCAAApAIAIJcBAACjAgAwmAEAABIAEJkBAACjAgAwmgEBAPUBACGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACECBwAA4AMAIAgAAOEDACANBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQAAAAGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACHiAQAAogIAIAMAAAASACABAAATADACAAAUACABAAAACQAgAQAAABIAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgDw4AAKECACCXAQAAnwIAMJgBAAAaABCZAQAAnwIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhAQ4AAOADACADAAAAGgAgAQAAGwAwAgAAAQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAABoAIAEAAAABACADAAAAGgAgAQAAGwAwAgAAAQAgAwAAABoAIAEAABsAMAIAAAEAIAMAAAAaACABAAAbADACAAABACAMDgAA3wMAIJoBAQAAAAGkAQAAAOEBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAAB3QEBAAAAAd4BAQAAAAHfAQEAAAAB4QEBAAAAAQEUAAAlACALmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAHhAQEAAAABARQAACcAMAEUAAAnADAMDgAA3gMAIJoBAQC3AgAhpAEAAM0C4QEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAId0BAQC3AgAh3gEBALcCACHfAQEAtwIAIeEBAQC3AgAhAgAAAAEAIBQAACoAIAuaAQEAtwIAIaQBAADNAuEBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHdAQEAtwIAId4BAQC3AgAh3wEBALcCACHhAQEAtwIAIQIAAAAaACAUAAAsACACAAAAGgAgFAAALAAgAwAAAAEAIBsAACUAIBwAACoAIAEAAAABACABAAAAGgAgAwQAANsDACAhAADdAwAgIgAA3AMAIA6XAQAAmwIAMJgBAAAzABCZAQAAmwIAMJoBAQDaAQAhpAEAAJwC4QEiqAEgAN8BACGqAUAA4QEAIasBQADhAQAhugEBANoBACG7AQEA2gEAId0BAQDaAQAh3gEBANoBACHfAQEA2gEAIeEBAQDaAQAhAwAAABoAIAEAADIAMCAAADMAIAMAAAAaACABAAAbADACAAABACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACkAwAgCAAA_AIAIAoAAP0CACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABARQAADsAIAmaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABARQAAD0AMAEUAAA9ADAMBwAAogMAIAgAAOsCACAKAADsAgAgmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQIAAAALACAUAABAACAJmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQIAAAAJACAUAABCACACAAAACQAgFAAAQgAgAwAAAAsAIBsAADsAIBwAAEAAIAEAAAALACABAAAACQAgBQQAANYDACAhAADZAwAgIgAA2AMAIDMAANcDACA0AADaAwAgDJcBAACXAgAwmAEAAEkAEJkBAACXAgAwmgEBANoBACGkAQAAmALdASKqAUAA4QEAIasBQADhAQAhyQEBANoBACHKAQEA2gEAIdkBQADhAQAh2gECAOABACHbARAAggIAIQMAAAAJACABAABIADAgAABJACADAAAACQAgAQAACgAwAgAACwAgCQMAAP0BACCXAQAAlgIAMJgBAABPABCZAQAAlgIAMJoBAQAAAAGbAQEAAAABqgFAAPwBACGrAUAA_AEAIbsBAQAAAAEBAAAATAAgAQAAAEwAIAkDAAD9AQAglwEAAJYCADCYAQAATwAQmQEAAJYCADCaAQEA9QEAIZsBAQD1AQAhqgFAAPwBACGrAUAA_AEAIbsBAQD1AQAhAQMAAK4DACADAAAATwAgAQAAUAAwAgAATAAgAwAAAE8AIAEAAFAAMAIAAEwAIAMAAABPACABAABQADACAABMACAGAwAA1QMAIJoBAQAAAAGbAQEAAAABqgFAAAAAAasBQAAAAAG7AQEAAAABARQAAFQAIAWaAQEAAAABmwEBAAAAAaoBQAAAAAGrAUAAAAABuwEBAAAAAQEUAABWADABFAAAVgAwBgMAAMsDACCaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAEwAIBQAAFkAIAWaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAE8AIBQAAFsAIAIAAABPACAUAABbACADAAAATAAgGwAAVAAgHAAAWQAgAQAAAEwAIAEAAABPACADBAAAyAMAICEAAMoDACAiAADJAwAgCJcBAACVAgAwmAEAAGIAEJkBAACVAgAwmgEBANoBACGbAQEA2gEAIaoBQADhAQAhqwFAAOEBACG7AQEA2gEAIQMAAABPACABAABhADAgAABiACADAAAATwAgAQAAUAAwAgAATAAgC5cBAACUAgAwmAEAAGgAEJkBAACUAgAwmgEBAAAAAZsBAQD1AQAhnAEBAPUBACGqAUAA_AEAIasBQAD8AQAh1gEBAPUBACHXAQEA9QEAIdgBIAD6AQAhAQAAAGUAIAEAAABlACALlwEAAJQCADCYAQAAaAAQmQEAAJQCADCaAQEA9QEAIZsBAQD1AQAhnAEBAPUBACGqAUAA_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-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMMBAQAAAAHEAQEAAAABARQAALEBADABFAAAsQEAMBMFAACMAwAgBgAAtwMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACHEAQEAtwIAIQIAAAAFACAUAAC0AQAgD5oBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMMBAQC3AgAhxAEBALcCACECAAAAAwAgFAAAtgEAIAIAAAADACAUAAC2AQAgAwAAAAUAIBsAAK8BACAcAAC0AQAgAQAAAAUAIAEAAAADACAFBAAAsgMAICEAALUDACAiAAC0AwAgMwAAswMAIDQAALYDACASlwEAAIECADCYAQAAvQEAEJkBAACBAgAwmgEBANoBACGkAQAAhQLDASKoASAA3wEAIaoBQADhAQAhqwFAAOEBACG6AQEA2gEAIbsBAQDaAQAhvAEBANoBACG9AQEA2gEAIb4BEACCAgAhvwECAOABACHAAQgAgwIAIcEBAACEAgAgwwEBANoBACHEAQEA2gEAIQMAAAADACABAAC8AQAwIAAAvQEAIAMAAAADACABAAAEADACAAAFACAWAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQAAAAGbAQEA9QEAIZwBAQAAAAGdAQEA9gEAIZ4BAQAAAAGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIQEAAADAAQAgAQAAAMABACAWAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQD1AQAhmwEBAPUBACGcAQEA9QEAIZ0BAQD2AQAhngEBAPYBACGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIQgDAACuAwAgCwAArwMAIAwAALADACANAACxAwAgnQEAALECACCeAQAAsQIAIJ8BAACxAgAgoAEAALECACADAAAAwwEAIAEAAMQBADACAADAAQAgAwAAAMMBACABAADEAQAwAgAAwAEAIAMAAADDAQAgAQAAxAEAMAIAAMABACATAwAAqgMAIAsAAKsDACAMAACsAwAgDQAArQMAIJoBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQEUAADIAQAgD5oBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQEUAADKAQAwARQAAMoBADATAwAAvwIAIAsAAMACACAMAADBAgAgDQAAwgIAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIQIAAADAAQAgFAAAzQEAIA-aAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACECAAAAwwEAIBQAAM8BACACAAAAwwEAIBQAAM8BACADAAAAwAEAIBsAAMgBACAcAADNAQAgAQAAAMABACABAAAAwwEAIAkEAACyAgAgIQAAtQIAICIAALQCACAzAACzAgAgNAAAtgIAIJ0BAACxAgAgngEAALECACCfAQAAsQIAIKABAACxAgAgEpcBAADZAQAwmAEAANYBABCZAQAA2QEAMJoBAQDaAQAhmwEBANoBACGcAQEA2gEAIZ0BAQDbAQAhngEBANsBACGfAQEA2wEAIaABAQDbAQAhogEAANwBogEipAEAAN0BpAEipgEAAN4BpgEipwEgAN8BACGoASAA3wEAIakBAgDgAQAhqgFAAOEBACGrAUAA4QEAIQMAAADDAQAgAQAA1QEAMCAAANYBACADAAAAwwEAIAEAAMQBADACAADAAQAgEpcBAADZAQAwmAEAANYBABCZAQAA2QEAMJoBAQDaAQAhmwEBANoBACGcAQEA2gEAIZ0BAQDbAQAhngEBANsBACGfAQEA2wEAIaABAQDbAQAhogEAANwBogEipAEAAN0BpAEipgEAAN4BpgEipwEgAN8BACGoASAA3wEAIakBAgDgAQAhqgFAAOEBACGrAUAA4QEAIQ4EAADjAQAgIQAA8wEAICIAAPMBACCsAQEAAAABrQEBAAAABK4BAQAAAASvAQEAAAABsAEBAAAAAbEBAQAAAAGyAQEAAAABswEBAPIBACG0AQEAAAABtQEBAAAAAbYBAQAAAAEOBAAA8AEAICEAAPEBACAiAADxAQAgrAEBAAAAAa0BAQAAAAWuAQEAAAAFrwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDvAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABBwQAAOMBACAhAADuAQAgIgAA7gEAIKwBAAAAogECrQEAAACiAQiuAQAAAKIBCLMBAADtAaIBIgcEAADjAQAgIQAA7AEAICIAAOwBACCsAQAAAKQBAq0BAAAApAEIrgEAAACkAQizAQAA6wGkASIHBAAA4wEAICEAAOoBACAiAADqAQAgrAEAAACmAQKtAQAAAKYBCK4BAAAApgEIswEAAOkBpgEiBQQAAOMBACAhAADoAQAgIgAA6AEAIKwBIAAAAAGzASAA5wEAIQ0EAADjAQAgIQAA4wEAICIAAOMBACAzAADmAQAgNAAA4wEAIKwBAgAAAAGtAQIAAAAErgECAAAABK8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA5QEAIQsEAADjAQAgIQAA5AEAICIAAOQBACCsAUAAAAABrQFAAAAABK4BQAAAAASvAUAAAAABsAFAAAAAAbEBQAAAAAGyAUAAAAABswFAAOIBACELBAAA4wEAICEAAOQBACAiAADkAQAgrAFAAAAAAa0BQAAAAASuAUAAAAAErwFAAAAAAbABQAAAAAGxAUAAAAABsgFAAAAAAbMBQADiAQAhCKwBAgAAAAGtAQIAAAAErgECAAAABK8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA4wEAIQisAUAAAAABrQFAAAAABK4BQAAAAASvAUAAAAABsAFAAAAAAbEBQAAAAAGyAUAAAAABswFAAOQBACENBAAA4wEAICEAAOMBACAiAADjAQAgMwAA5gEAIDQAAOMBACCsAQIAAAABrQECAAAABK4BAgAAAASvAQIAAAABsAECAAAAAbEBAgAAAAGyAQIAAAABswECAOUBACEIrAEIAAAAAa0BCAAAAASuAQgAAAAErwEIAAAAAbABCAAAAAGxAQgAAAABsgEIAAAAAbMBCADmAQAhBQQAAOMBACAhAADoAQAgIgAA6AEAIKwBIAAAAAGzASAA5wEAIQKsASAAAAABswEgAOgBACEHBAAA4wEAICEAAOoBACAiAADqAQAgrAEAAACmAQKtAQAAAKYBCK4BAAAApgEIswEAAOkBpgEiBKwBAAAApgECrQEAAACmAQiuAQAAAKYBCLMBAADqAaYBIgcEAADjAQAgIQAA7AEAICIAAOwBACCsAQAAAKQBAq0BAAAApAEIrgEAAACkAQizAQAA6wGkASIErAEAAACkAQKtAQAAAKQBCK4BAAAApAEIswEAAOwBpAEiBwQAAOMBACAhAADuAQAgIgAA7gEAIKwBAAAAogECrQEAAACiAQiuAQAAAKIBCLMBAADtAaIBIgSsAQAAAKIBAq0BAAAAogEIrgEAAACiAQizAQAA7gGiASIOBAAA8AEAICEAAPEBACAiAADxAQAgrAEBAAAAAa0BAQAAAAWuAQEAAAAFrwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDvAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABCKwBAgAAAAGtAQIAAAAFrgECAAAABa8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA8AEAIQusAQEAAAABrQEBAAAABa4BAQAAAAWvAQEAAAABsAEBAAAAAbEBAQAAAAGyAQEAAAABswEBAPEBACG0AQEAAAABtQEBAAAAAbYBAQAAAAEOBAAA4wEAICEAAPMBACAiAADzAQAgrAEBAAAAAa0BAQAAAASuAQEAAAAErwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDyAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABC6wBAQAAAAGtAQEAAAAErgEBAAAABK8BAQAAAAGwAQEAAAABsQEBAAAAAbIBAQAAAAGzAQEA8wEAIbQBAQAAAAG1AQEAAAABtgEBAAAAARYDAAD9AQAgCwAA_gEAIAwAAP8BACANAACAAgAglwEAAPQBADCYAQAAwwEAEJkBAAD0AQAwmgEBAPUBACGbAQEA9QEAIZwBAQD1AQAhnQEBAPYBACGeAQEA9gEAIZ8BAQD2AQAhoAEBAPYBACGiAQAA9wGiASKkAQAA-AGkASKmAQAA-QGmASKnASAA-gEAIagBIAD6AQAhqQECAPsBACGqAUAA_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_AEAIdYBAQD1AQAh1wEBAPUBACHYASAA-gEAIQiXAQAAlQIAMJgBAABiABCZAQAAlQIAMJoBAQDaAQAhmwEBANoBACGqAUAA4QEAIasBQADhAQAhuwEBANoBACEJAwAA_QEAIJcBAACWAgAwmAEAAE8AEJkBAACWAgAwmgEBAPUBACGbAQEA9QEAIaoBQAD8AQAhqwFAAPwBACG7AQEA9QEAIQyXAQAAlwIAMJgBAABJABCZAQAAlwIAMJoBAQDaAQAhpAEAAJgC3QEiqgFAAOEBACGrAUAA4QEAIckBAQDaAQAhygEBANoBACHZAUAA4QEAIdoBAgDgAQAh2wEQAIICACEHBAAA4wEAICEAAJoCACAiAACaAgAgrAEAAADdAQKtAQAAAN0BCK4BAAAA3QEIswEAAJkC3QEiBwQAAOMBACAhAACaAgAgIgAAmgIAIKwBAAAA3QECrQEAAADdAQiuAQAAAN0BCLMBAACZAt0BIgSsAQAAAN0BAq0BAAAA3QEIrgEAAADdAQizAQAAmgLdASIOlwEAAJsCADCYAQAAMwAQmQEAAJsCADCaAQEA2gEAIaQBAACcAuEBIqgBIADfAQAhqgFAAOEBACGrAUAA4QEAIboBAQDaAQAhuwEBANoBACHdAQEA2gEAId4BAQDaAQAh3wEBANoBACHhAQEA2gEAIQcEAADjAQAgIQAAngIAICIAAJ4CACCsAQAAAOEBAq0BAAAA4QEIrgEAAADhAQizAQAAnQLhASIHBAAA4wEAICEAAJ4CACAiAACeAgAgrAEAAADhAQKtAQAAAOEBCK4BAAAA4QEIswEAAJ0C4QEiBKwBAAAA4QECrQEAAADhAQiuAQAAAOEBCLMBAACeAuEBIg8OAAChAgAglwEAAJ8CADCYAQAAGgAQmQEAAJ8CADCaAQEA9QEAIaQBAACgAuEBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACHdAQEA9QEAId4BAQD1AQAh3wEBAPUBACHhAQEA9QEAIQSsAQAAAOEBAq0BAAAA4QEIrgEAAADhAQizAQAAngLhASIYAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQD1AQAhmwEBAPUBACGcAQEA9QEAIZ0BAQD2AQAhngEBAPYBACGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIeMBAADDAQAg5AEAAMMBACACyQEBAAAAAcoBAQAAAAEMBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhGAUAALACACAGAAChAgAgCwAA_gEAIAwAAP8BACCXAQAArQIAMJgBAAADABCZAQAArQIAMJoBAQD1AQAhpAEAAK8CwwEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAIbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACHjAQAAAwAg5AEAAAMAIBIJAACpAgAglwEAAKUCADCYAQAADQAQmQEAAKUCADCaAQEA9QEAIaQBAACnAtEBIqoBQAD8AQAhqwFAAPwBACHLAQEA9QEAIcwBAQD1AQAhzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIQisARAAAAABrQEQAAAABK4BEAAAAASvARAAAAABsAEQAAAAAbEBEAAAAAGyARAAAAABswEQAIoCACEErAEAAADRAQKtAQAAANEBCK4BAAAA0QEIswEAAJIC0QEiCKwBQAAAAAGtAUAAAAAFrgFAAAAABa8BQAAAAAGwAUAAAAABsQFAAAAAAbIBQAAAAAGzAUAAkAIAIREHAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACHjAQAACQAg5AEAAAkAIA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACEErAEAAADdAQKtAQAAAN0BCK4BAAAA3QEIswEAAJoC3QEiA7cBAAANACC4AQAADQAguQEAAA0AIBYFAACwAgAgBgAAoQIAIAsAAP4BACAMAAD_AQAglwEAAK0CADCYAQAAAwAQmQEAAK0CADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhCKwBCAAAAAGtAQgAAAAErgEIAAAABK8BCAAAAAGwAQgAAAABsQEIAAAAAbIBCAAAAAGzAQgA5gEAIQSsAQAAAMMBAq0BAAAAwwEIrgEAAADDAQizAQAAhwLDASILAwAA_QEAIJcBAACWAgAwmAEAAE8AEJkBAACWAgAwmgEBAPUBACGbAQEA9QEAIaoBQAD8AQAhqwFAAPwBACG7AQEA9QEAIeMBAABPACDkAQAATwAgAAAAAAAAAegBAQAAAAEB6AEBAAAAAQHoAQAAAKIBAgHoAQAAAKQBAgHoAQAAAKYBAgHoASAAAAABBegBAgAAAAHvAQIAAAAB8AECAAAAAfEBAgAAAAHyAQIAAAABAegBQAAAAAELGwAA_gIAMBwAAIMDADDlAQAA_wIAMOYBAACAAwAw5wEAAIEDACDoAQAAggMAMOkBAACCAwAw6gEAAIIDADDrAQAAggMAMOwBAACEAwAw7QEAAIUDADALGwAA3gIAMBwAAOMCADDlAQAA3wIAMOYBAADgAgAw5wEAAOECACDoAQAA4gIAMOkBAADiAgAw6gEAAOICADDrAQAA4gIAMOwBAADkAgAw7QEAAOUCADALGwAA0AIAMBwAANUCADDlAQAA0QIAMOYBAADSAgAw5wEAANMCACDoAQAA1AIAMOkBAADUAgAw6gEAANQCADDrAQAA1AIAMOwBAADWAgAw7QEAANcCADALGwAAwwIAMBwAAMgCADDlAQAAxAIAMOYBAADFAgAw5wEAAMYCACDoAQAAxwIAMOkBAADHAgAw6gEAAMcCADDrAQAAxwIAMOwBAADJAgAw7QEAAMoCADAKmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAECAAAAAQAgGwAAzwIAIAMAAAABACAbAADPAgAgHAAAzgIAIAEUAACUBAAwDw4AAKECACCXAQAAnwIAMJgBAAAaABCZAQAAnwIAMJoBAQAAAAGkAQAAoALhASKoASAA-gEAIaoBQAD8AQAhqwFAAPwBACG6AQEA9QEAIbsBAQAAAAHdAQEA9QEAId4BAQD1AQAh3wEBAPUBACHhAQEA9QEAIQIAAAABACAUAADOAgAgAgAAAMsCACAUAADMAgAgDpcBAADKAgAwmAEAAMsCABCZAQAAygIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhDpcBAADKAgAwmAEAAMsCABCZAQAAygIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhCpoBAQC3AgAhpAEAAM0C4QEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAId0BAQC3AgAh3gEBALcCACHfAQEAtwIAIQHoAQAAAOEBAgqaAQEAtwIAIaQBAADNAuEBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHdAQEAtwIAId4BAQC3AgAh3wEBALcCACEKmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAEHCAAA3QIAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAABygEBAAAAAQIAAAAUACAbAADcAgAgAwAAABQAIBsAANwCACAcAADaAgAgARQAAJMEADANBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQAAAAGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACHiAQAAogIAIAIAAAAUACAUAADaAgAgAgAAANgCACAUAADZAgAgCpcBAADXAgAwmAEAANgCABCZAQAA1wIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhCpcBAADXAgAwmAEAANgCABCZAQAA1wIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhBpoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHKAQEAtwIAIQcIAADbAgAgmgEBALcCACGqAUAAvgIAIasBQAC-AgAhwAECAL0CACHIAQEAtwIAIcoBAQC3AgAhBRsAAI4EACAcAACRBAAg5QEAAI8EACDmAQAAkAQAIOsBAAAFACAHCAAA3QIAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAABygEBAAAAAQMbAACOBAAg5QEAAI8EACDrAQAABQAgCggAAPwCACAKAAD9AgAgmgEBAAAAAaQBAAAA3QECqgFAAAAAAasBQAAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABAgAAAAsAIBsAAPsCACADAAAACwAgGwAA-wIAIBwAAOoCACABFAAAjQQAMA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQAAAAGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQIAAAALACAUAADqAgAgAgAAAOYCACAUAADnAgAgDJcBAADlAgAwmAEAAOYCABCZAQAA5QIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACEMlwEAAOUCADCYAQAA5gIAEJkBAADlAgAwmgEBAPUBACGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQiaAQEAtwIAIaQBAADpAt0BIqoBQAC-AgAhqwFAAL4CACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQXoARAAAAAB7wEQAAAAAfABEAAAAAHxARAAAAAB8gEQAAAAAQHoAQAAAN0BAgoIAADrAgAgCgAA7AIAIJoBAQC3AgAhpAEAAOkC3QEiqgFAAL4CACGrAUAAvgIAIcoBAQC3AgAh2QFAAL4CACHaAQIAvQIAIdsBEADoAgAhBRsAAIcEACAcAACLBAAg5QEAAIgEACDmAQAAigQAIOsBAAAFACALGwAA7QIAMBwAAPICADDlAQAA7gIAMOYBAADvAgAw5wEAAPACACDoAQAA8QIAMOkBAADxAgAw6gEAAPECADDrAQAA8QIAMOwBAADzAgAw7QEAAPQCADANmgEBAAAAAaQBAAAA0QECqgFAAAAAAasBQAAAAAHMAQEAAAABzQEBAAAAAc4BEAAAAAHPAQEAAAAB0QEBAAAAAdIBAQAAAAHTAQEAAAAB1AEBAAAAAdUBQAAAAAECAAAADwAgGwAA-gIAIAMAAAAPACAbAAD6AgAgHAAA-QIAIAEUAACJBAAwEgkAAKkCACCXAQAApQIAMJgBAAANABCZAQAApQIAMJoBAQAAAAGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEAAAABzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIQIAAAAPACAUAAD5AgAgAgAAAPUCACAUAAD2AgAgEZcBAAD0AgAwmAEAAPUCABCZAQAA9AIAMJoBAQD1AQAhpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAPUBACHNAQEA9gEAIc4BEACmAgAhzwEBAPUBACHRAQEA9gEAIdIBAQD2AQAh0wEBAPYBACHUAQEA9gEAIdUBQACoAgAhEZcBAAD0AgAwmAEAAPUCABCZAQAA9AIAMJoBAQD1AQAhpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAPUBACHNAQEA9gEAIc4BEACmAgAhzwEBAPUBACHRAQEA9gEAIdIBAQD2AQAh0wEBAPYBACHUAQEA9gEAIdUBQACoAgAhDZoBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIQHoAQAAANEBAgHoAUAAAAABDZoBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIQ2aAQEAAAABpAEAAADRAQKqAUAAAAABqwFAAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAQoIAAD8AgAgCgAA_QIAIJoBAQAAAAGkAQAAAN0BAqoBQAAAAAGrAUAAAAABygEBAAAAAdkBQAAAAAHaAQIAAAAB2wEQAAAAAQMbAACHBAAg5QEAAIgEACDrAQAABQAgBBsAAO0CADDlAQAA7gIAMOcBAADwAgAg6wEAAPECADARBQAApwMAIAsAAKgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAAQIAAAAFACAbAAClAwAgAwAAAAUAIBsAAKUDACAcAACLAwAgARQAAIYEADAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAAAAAaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACECAAAABQAgFAAAiwMAIAIAAACGAwAgFAAAhwMAIBKXAQAAhQMAMJgBAACGAwAQmQEAAIUDADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhEpcBAACFAwAwmAEAAIYDABCZAQAAhQMAMJoBAQD1AQAhpAEAAK8CwwEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAIbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACEOmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACEF6AEIAAAAAe8BCAAAAAHwAQgAAAAB8QEIAAAAAfIBCAAAAAEC6AEBAAAABO4BAQAAAAUB6AEAAADDAQIRBQAAjAMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACEFGwAA9QMAIBwAAIQEACDlAQAA9gMAIOYBAACDBAAg6wEAAEwAIAsbAACaAwAwHAAAngMAMOUBAACbAwAw5gEAAJwDADDnAQAAnQMAIOgBAADiAgAw6QEAAOICADDqAQAA4gIAMOsBAADiAgAw7AEAAJ8DADDtAQAA5QIAMAsbAACPAwAwHAAAkwMAMOUBAACQAwAw5gEAAJEDADDnAQAAkgMAIOgBAADUAgAw6QEAANQCADDqAQAA1AIAMOsBAADUAgAw7AEAAJQDADDtAQAA1wIAMAcHAACZAwAgmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABAgAAABQAIBsAAJgDACADAAAAFAAgGwAAmAMAIBwAAJYDACABFAAAggQAMAIAAAAUACAUAACWAwAgAgAAANgCACAUAACVAwAgBpoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHJAQEAtwIAIQcHAACXAwAgmgEBALcCACGqAUAAvgIAIasBQAC-AgAhwAECAL0CACHIAQEAtwIAIckBAQC3AgAhBRsAAP0DACAcAACABAAg5QEAAP4DACDmAQAA_wMAIOsBAADAAQAgBwcAAJkDACCaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAckBAQAAAAEDGwAA_QMAIOUBAAD-AwAg6wEAAMABACAKBwAApAMAIAoAAP0CACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHZAUAAAAAB2gECAAAAAdsBEAAAAAECAAAACwAgGwAAowMAIAMAAAALACAbAACjAwAgHAAAoQMAIAEUAAD8AwAwAgAAAAsAIBQAAKEDACACAAAA5gIAIBQAAKADACAImgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHZAUAAvgIAIdoBAgC9AgAh2wEQAOgCACEKBwAAogMAIAoAAOwCACCaAQEAtwIAIaQBAADpAt0BIqoBQAC-AgAhqwFAAL4CACHJAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQUbAAD3AwAgHAAA-gMAIOUBAAD4AwAg5gEAAPkDACDrAQAAwAEAIAoHAACkAwAgCgAA_QIAIJoBAQAAAAGkAQAAAN0BAqoBQAAAAAGrAUAAAAAByQEBAAAAAdkBQAAAAAHaAQIAAAAB2wEQAAAAAQMbAAD3AwAg5QEAAPgDACDrAQAAwAEAIBEFAACnAwAgCwAAqAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDDAQEAAAABAegBAQAAAAQDGwAA9QMAIOUBAAD2AwAg6wEAAEwAIAQbAACaAwAw5QEAAJsDADDnAQAAnQMAIOsBAADiAgAwBBsAAI8DADDlAQAAkAMAMOcBAACSAwAg6wEAANQCADAEGwAA_gIAMOUBAAD_AgAw5wEAAIEDACDrAQAAggMAMAQbAADeAgAw5QEAAN8CADDnAQAA4QIAIOsBAADiAgAwBBsAANACADDlAQAA0QIAMOcBAADTAgAg6wEAANQCADAEGwAAwwIAMOUBAADEAgAw5wEAAMYCACDrAQAAxwIAMAAAAAAAAAAAAAUbAADwAwAgHAAA8wMAIOUBAADxAwAg5gEAAPIDACDrAQAAwAEAIAMbAADwAwAg5QEAAPEDACDrAQAAwAEAIAAAAAAAAAAAAAAFGwAA6wMAIBwAAO4DACDlAQAA7AMAIOYBAADtAwAg6wEAAAsAIAMbAADrAwAg5QEAAOwDACDrAQAACwAgAAAAAAAACxsAAMwDADAcAADQAwAw5QEAAM0DADDmAQAAzgMAMOcBAADPAwAg6AEAAIIDADDpAQAAggMAMOoBAACCAwAw6wEAAIIDADDsAQAA0QMAMO0BAACFAwAwEQYAALgDACALAACoAwAgDAAAqQMAIJoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMQBAQAAAAECAAAABQAgGwAA1AMAIAMAAAAFACAbAADUAwAgHAAA0wMAIAEUAADqAwAwAgAAAAUAIBQAANMDACACAAAAhgMAIBQAANIDACAOmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgxAEBALcCACERBgAAtwMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgxAEBALcCACERBgAAuAMAIAsAAKgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgxAEBAAAAAQQbAADMAwAw5QEAAM0DADDnAQAAzwMAIOsBAACCAwAwAAAAAAAAAAAFGwAA5QMAIBwAAOgDACDlAQAA5gMAIOYBAADnAwAg6wEAAMABACADGwAA5QMAIOUBAADmAwAg6wEAAMABACAIAwAArgMAIAsAAK8DACAMAACwAwAgDQAAsQMAIJ0BAACxAgAgngEAALECACCfAQAAsQIAIKABAACxAgAgBAUAAOQDACAGAADgAwAgCwAArwMAIAwAALADACADBwAA4AMAIAgAAOEDACAKAADjAwAgAAEDAACuAwAgEgMAAKoDACALAACrAwAgDAAArAMAIJoBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQIAAADAAQAgGwAA5QMAIAMAAADDAQAgGwAA5QMAIBwAAOkDACAUAAAAwwEAIAMAAL8CACALAADAAgAgDAAAwQIAIBQAAOkDACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACESAwAAvwIAIAsAAMACACAMAADBAgAgmgEBALcCACGbAQEAtwIAIZwBAQC3AgAhnQEBALgCACGeAQEAuAIAIZ8BAQC4AgAhoAEBALgCACGiAQAAuQKiASKkAQAAugKkASKmAQAAuwKmASKnASAAvAIAIagBIAC8AgAhqQECAL0CACGqAUAAvgIAIasBQAC-AgAhDpoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMQBAQAAAAELBwAApAMAIAgAAPwCACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABAgAAAAsAIBsAAOsDACADAAAACQAgGwAA6wMAIBwAAO8DACANAAAACQAgBwAAogMAIAgAAOsCACAUAADvAwAgmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQsHAACiAwAgCAAA6wIAIJoBAQC3AgAhpAEAAOkC3QEiqgFAAL4CACGrAUAAvgIAIckBAQC3AgAhygEBALcCACHZAUAAvgIAIdoBAgC9AgAh2wEQAOgCACESCwAAqwMAIAwAAKwDACANAACtAwAgmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABAgAAAMABACAbAADwAwAgAwAAAMMBACAbAADwAwAgHAAA9AMAIBQAAADDAQAgCwAAwAIAIAwAAMECACANAADCAgAgFAAA9AMAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIRILAADAAgAgDAAAwQIAIA0AAMICACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACEFmgEBAAAAAZsBAQAAAAGqAUAAAAABqwFAAAAAAbsBAQAAAAECAAAATAAgGwAA9QMAIBIDAACqAwAgDAAArAMAIA0AAK0DACCaAQEAAAABmwEBAAAAAZwBAQAAAAGdAQEAAAABngEBAAAAAZ8BAQAAAAGgAQEAAAABogEAAACiAQKkAQAAAKQBAqYBAAAApgECpwEgAAAAAagBIAAAAAGpAQIAAAABqgFAAAAAAasBQAAAAAECAAAAwAEAIBsAAPcDACADAAAAwwEAIBsAAPcDACAcAAD7AwAgFAAAAMMBACADAAC_AgAgDAAAwQIAIA0AAMICACAUAAD7AwAgmgEBALcCACGbAQEAtwIAIZwBAQC3AgAhnQEBALgCACGeAQEAuAIAIZ8BAQC4AgAhoAEBALgCACGiAQAAuQKiASKkAQAAugKkASKmAQAAuwKmASKnASAAvAIAIagBIAC8AgAhqQECAL0CACGqAUAAvgIAIasBQAC-AgAhEgMAAL8CACAMAADBAgAgDQAAwgIAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIQiaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHZAUAAAAAB2gECAAAAAdsBEAAAAAESAwAAqgMAIAsAAKsDACANAACtAwAgmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABAgAAAMABACAbAAD9AwAgAwAAAMMBACAbAAD9AwAgHAAAgQQAIBQAAADDAQAgAwAAvwIAIAsAAMACACANAADCAgAgFAAAgQQAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIRIDAAC_AgAgCwAAwAIAIA0AAMICACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACEGmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABAwAAAE8AIBsAAPUDACAcAACFBAAgBwAAAE8AIBQAAIUEACCaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhBZoBAQC3AgAhmwEBALcCACGqAUAAvgIAIasBQAC-AgAhuwEBALcCACEOmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAARIFAACnAwAgBgAAuAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDDAQEAAAABxAEBAAAAAQIAAAAFACAbAACHBAAgDZoBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABzAEBAAAAAc0BAQAAAAHOARAAAAABzwEBAAAAAdEBAQAAAAHSAQEAAAAB0wEBAAAAAdQBAQAAAAHVAUAAAAABAwAAAAMAIBsAAIcEACAcAACMBAAgFAAAAAMAIAUAAIwDACAGAAC3AwAgDAAAjgMAIBQAAIwEACCaAQEAtwIAIaQBAACKA8MBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACG8AQEAtwIAIb0BAQC3AgAhvgEQAOgCACG_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_tQEDgAG3AQyBAbgBP4IBuQEDgwG6AQOEAbsBDIUBvgFAhgG_AUaHAcEBAogBwgECiQHFAQKKAcYBAosBxwECjAHJAQKNAcsBDI4BzAFHjwHOAQKQAdABDJEB0QFIkgHSAQKTAdMBApQB1AEMlQHXAUmWAdgBTw"
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
    paidAt: true
  }
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
    { package: bookingPackageSelect, payments: bookingPaymentSelect },
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
    { package: bookingPackageSelect, payments: bookingPaymentSelect },
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
      payments: bookingPaymentSelect
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
      payments: bookingPaymentSelect
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
import { randomUUID } from "node:crypto";
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
  const base = slugify(title) || `package-${randomUUID().slice(0, 8)}`;
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
import { randomUUID as randomUUID2 } from "node:crypto";
var publicAuthorSelect = {
  select: { id: true, name: true, avatarUrl: true }
};
var generateUniqueSlug2 = async (title) => {
  const base = slugify(title) || `blog-${randomUUID2().slice(0, 8)}`;
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

// src/lib/sslcommerz.ts
import { randomUUID as randomUUID3 } from "node:crypto";
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
  return `TRNX_ID-${Date.now()}-${randomUUID3().replace(/-/g, "").slice(0, 8)}`;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvc2x1Z2lmeS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBleHByZXNzLCB7IEFwcGxpY2F0aW9uLCBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBjb3JzIGZyb20gXCJjb3JzXCI7XG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XG5pbXBvcnQgaGVsbWV0IGZyb20gXCJoZWxtZXRcIjtcbmltcG9ydCBtb3JnYW4gZnJvbSBcIm1vcmdhblwiO1xuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuL2NvbmZpZ1wiO1xuaW1wb3J0IG5vdEZvdW5kSGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL25vdEZvdW5kXCI7XG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBhdXRoUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9hdXRoL2F1dGgucm91dGVcIjtcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xuaW1wb3J0IHsgdXBsb2FkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGVcIjtcbmltcG9ydCB7IGNvbnRhY3RSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZVwiO1xuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XG5pbXBvcnQgeyByZXZpZXdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGVcIjtcbmltcG9ydCB7IGNhdGVnb3J5Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS5yb3V0ZVwiO1xuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XG5pbXBvcnQgeyBibG9nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ibG9nL2Jsb2cucm91dGVcIjtcbmltcG9ydCB7IGRhc2hib2FyZFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZVwiO1xuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XG5cbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XG5cbi8vIFJlbmRlci9SYWlsd2F5IHNpdCBiZWhpbmQgYSByZXZlcnNlIHByb3h5IFx1MjAxNCBtdXN0IGJlIHNldCBiZWZvcmUgdGhlXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXG4vLyBlZmZlY3RpdmVseSByYXRlLWxpbWl0IGFsbCB1c2VycyB0b2dldGhlci5cbmFwcC5zZXQoXCJ0cnVzdCBwcm94eVwiLCAxKTtcblxuYXBwLnVzZShoZWxtZXQoKSk7XG5cbmFwcC51c2UoXG4gIGNvcnMoe1xuICAgIC8vIERldiBob3N0IChsb2NhbGhvc3QpICsgcHJvZCBob3N0IChWZXJjZWwpIGJvdGggYWxsb3dlZCBzaWRlLWJ5LXNpZGUuXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxuICAgIG9yaWdpbjogW2NvbmZpZy5mcm9udGVuZF91cmxfZGV2LCBjb25maWcuZnJvbnRlbmRfdXJsX3Byb2RdLmZpbHRlcihcbiAgICAgIChvKTogbyBpcyBzdHJpbmcgPT4gQm9vbGVhbihvKSxcbiAgICApLFxuICAgIGNyZWRlbnRpYWxzOiB0cnVlLFxuICB9KSxcbik7XG5cbmlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcbn1cblxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcbmFwcC51c2UoZXhwcmVzcy51cmxlbmNvZGVkKHsgZXh0ZW5kZWQ6IHRydWUsIGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xuYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbi8vIFN0cmljdCBsaW1pdGVyIFx1MjAxNCBhdXRoIGVuZHBvaW50cywgYnJ1dGUtZm9yY2UgcHJvdGVjdGlvblxuY29uc3QgYXV0aExpbWl0ZXIgPSByYXRlTGltaXQoe1xuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXG4gIGxpbWl0OiA1LFxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxuICBtZXNzYWdlOiB7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxuICB9LFxufSk7XG5cbi8vIFN0YW5kYXJkIGxpbWl0ZXIgXHUyMDE0IGV2ZXJ5dGhpbmcgZWxzZSB1bmRlciAvYXBpXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxuICBsaW1pdDogMTAwLFxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxuICBtZXNzYWdlOiB7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcbiAgfSxcbn0pO1xuXG5hcHAudXNlKFwiL2FwaS9hdXRoL2xvZ2luXCIsIGF1dGhMaW1pdGVyKTtcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVnaXN0ZXJcIiwgYXV0aExpbWl0ZXIpO1xuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcbmFwcC51c2UoXCIvYXBpL2F1dGgvZ29vZ2xlXCIsIGF1dGhMaW1pdGVyKTtcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xuXG4vLyBSb290IHJvdXRlXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5zZW5kKFwiV2VsY29tZSB0byB0aGUgVHJpcFZlcnNlIEFQSSFcIik7XG59KTtcblxuLy8gSGVhbHRoIGNoZWNrIFx1MjAxNCByZWFsIERCIGNvbm5lY3Rpdml0eSBjaGVjaywgbm90IGEgc3RhdGljIDIwMC5cbmFwcC5nZXQoXCIvaGVhbHRoXCIsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3YFNFTEVDVCAxYDtcbiAgICByZXMuc3RhdHVzKDIwMCkuanNvbih7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbWVzc2FnZTogXCJPS1wiLFxuICAgICAgZGI6IFwiY29ubmVjdGVkXCIsXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1lc3NhZ2U6IFwiU2VydmljZSB1bmF2YWlsYWJsZVwiLFxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxuYXBwLnVzZShcIi9hcGkvYXV0aFwiLCBhdXRoUm91dGVzKTtcbmFwcC51c2UoXCIvYXBpL3VzZXJzXCIsIHVzZXJSb3V0ZXMpO1xuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xuYXBwLnVzZShcIi9hcGkvY29udGFjdFwiLCBjb250YWN0Um91dGVzKTtcbmFwcC51c2UoXCIvYXBpL2NhdGVnb3JpZXNcIiwgY2F0ZWdvcnlSb3V0ZXMpO1xuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XG5hcHAudXNlKFwiL2FwaS9yZXZpZXdzXCIsIHJldmlld1JvdXRlcyk7XG5hcHAudXNlKFwiL2FwaS9ib29raW5nc1wiLCBib29raW5nUm91dGVzKTtcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XG5hcHAudXNlKFwiL2FwaS9kYXNoYm9hcmRcIiwgZGFzaGJvYXJkUm91dGVzKTtcbmFwcC51c2UoXCIvYXBpL3BheW1lbnRzXCIsIHBheW1lbnRSb3V0ZXMpO1xuXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XG5hcHAudXNlKGdsb2JhbEVycm9ySGFuZGxlcik7XG5cbmV4cG9ydCBkZWZhdWx0IGFwcDtcbiIsICJpbXBvcnQgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5kb3RlbnYuY29uZmlnKHtcbiAgcXVpZXQ6IHRydWUsXG4gIHBhdGg6IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcIi5lbnZcIiksXG59KTtcblxuLy8gRXZlcnkgbW9kdWxlIHJlYWRzIGNvbmZpZyB0aHJvdWdoIHRoaXMgdmFsaWRhdGVkIG9iamVjdCwgbmV2ZXJcbi8vIHByb2Nlc3MuZW52IGRpcmVjdGx5IFx1MjAxNCBhIG1pc3NpbmcvbWFsZm9ybWVkIHZhciBmYWlscyBsb3VkbHkgYXQgYm9vdFxuLy8gaW5zdGVhZCBvZiBzdXJmYWNpbmcgYXMgYSBjb25mdXNpbmcgcnVudGltZSBlcnJvciBtaWQtcmVxdWVzdC5cbmNvbnN0IGVudlNjaGVtYSA9IHoub2JqZWN0KHtcbiAgUE9SVDogei5zdHJpbmcoKS5kZWZhdWx0KFwiNDAwMFwiKSxcbiAgTk9ERV9FTlY6IHouZW51bShbXCJkZXZlbG9wbWVudFwiLCBcInByb2R1Y3Rpb25cIl0pLmRlZmF1bHQoXCJkZXZlbG9wbWVudFwiKSxcblxuICAvLyBGcm9udGVuZCBvcmlnaW5zIGZvciBDT1JTICsgcGF5bWVudCByZWRpcmVjdHMuIFRoZSBmcm9udGVuZCBtYXkgbm90IGJlXG4gIC8vIGRlcGxveWVkIHlldCAob3IgbWF5IGJlIHJlYnVpbHQpLCBzbyBib3RoIGFyZSBvcHRpb25hbDogdGhlIGJhY2tlbmQgbXVzdFxuICAvLyBuZXZlciByZWZ1c2UgdG8gYm9vdCBqdXN0IGJlY2F1c2UgYSBVSSBob3N0IGlzbid0IGxpdmUuIFJvdXRlcyB0aGF0IG5lZWQgYVxuICAvLyByZWFsIG9yaWdpbiAocGF5bWVudCBjYWxsYmFjayByZWRpcmVjdHMpIGZhbGwgYmFjayB0byB0aGUgYmFja2VuZCBVUkwuXG4gIEZST05URU5EX1VSTF9ERVY6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcbiAgRlJPTlRFTkRfVVJMX1BST0Q6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBEQVRBQkFTRV9VUkw6IHouc3RyaW5nKCkubWluKDEsIFwiREFUQUJBU0VfVVJMIGlzIHJlcXVpcmVkXCIpLFxuXG4gIEJDUllQVF9TQUxUX1JPVU5EUzogei5zdHJpbmcoKS5kZWZhdWx0KFwiMTBcIiksXG5cbiAgLy8gT3B0aW9uYWwgYWRtaW4gY3JlZGVudGlhbHMgdXNlZCBieSB0aGUgc2VlZCBzY3JpcHQgKFN0ZXAgMTMpLiBGYWxscyBiYWNrXG4gIC8vIHRvIGRlbW8tYWRtaW5AdHJpcHZlcnNlLmNvbSAvIGRlbW8xMjMgd2hlbiB1bnNldC5cbiAgQURNSU5fRU1BSUw6IHouc3RyaW5nKCkuZW1haWwoKS5vcHRpb25hbCgpLFxuICBBRE1JTl9QQVNTV09SRDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcblxuICAvLyBTU0xDb21tZXJ6IChTdGVwIDE2KSBcdTIwMTQgc2FuZGJveCBzdG9yZSBjcmVkcyB1bnRpbCBnby1saXZlLiBTU0xfQ09NTUVSWl9TQU5EQk9YXG4gIC8vIHBpY2tzIHRoZSBzYW5kYm94IHZzIGxpdmUgQVBJIGJhc2UgVVJMLiBPcHRpb25hbCBzbyB0aGUgQVBJIGJvb3RzIChoZWFsdGgsXG4gIC8vIGF1dGgsIGNhdGFsb2csIGV0Yy4pIGV2ZW4gd2hlbiB0aGUgcGF5bWVudCBzdG9yZSBpc24ndCBjb25maWd1cmVkIHlldCBcdTIwMTQgdGhlXG4gIC8vIHBheW1lbnQgZW5kcG9pbnRzIHRoZW4gZmFpbCB3aXRoIGEgY2xlYW4gXCJub3QgY29uZmlndXJlZFwiIGVycm9yIGluc3RlYWQgb2ZcbiAgLy8gdGFraW5nIHRoZSB3aG9sZSBkZXBsb3ltZW50IGRvd24uXG4gIFNTTF9DT01NRVJaX1NUT1JFX0lEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFNTTF9DT01NRVJaX1NBTkRCT1g6IHouc3RyaW5nKCkuZGVmYXVsdChcInRydWVcIiksXG4gIC8vIE9wdGlvbmFsIGV4cGxpY2l0IGdhdGV3YXkvdmFsaWRhdG9yIGJhc2UgVVJMcyAoR2VhclVwIHBhdHRlcm4pLiBEZWZhdWx0cyBhcmVcbiAgLy8gZGVyaXZlZCBmcm9tIFNTTF9DT01NRVJaX1NBTkRCT1ggd2hlbiBhYnNlbnQuXG4gIFNTTENPTU1FUlpfSU5JVF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcbiAgU1NMQ09NTUVSWl9WQUxJREFURV9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIGJhY2tlbmRfcHVibGljX3VybDogZW52LkJBQ0tFTkRfUFVCTElDX1VSTCxcblxuICBqd3RfYWNjZXNzX3NlY3JldDogZW52LkpXVF9BQ0NFU1NfU0VDUkVULFxuICBqd3RfcmVmcmVzaF9zZWNyZXQ6IGVudi5KV1RfUkVGUkVTSF9TRUNSRVQsXG4gIGp3dF9hY2Nlc3NfZXhwaXJlc19pbjogZW52LkpXVF9BQ0NFU1NfRVhQSVJFU19JTixcbiAgand0X3JlZnJlc2hfZXhwaXJlc19pbjogZW52LkpXVF9SRUZSRVNIX0VYUElSRVNfSU4sXG5cbiAgZ29vZ2xlX2NsaWVudF9pZDogZW52LkdPT0dMRV9DTElFTlRfSUQsXG5cbiAgcmVzZW5kX2FwaV9rZXk6IGVudi5SRVNFTkRfQVBJX0tFWSxcbiAgY29udGFjdF9yZWNlaXZlcl9lbWFpbDogZW52LkNPTlRBQ1RfUkVDRUlWRVJfRU1BSUwsXG4gIGVtYWlsX2Zyb206IGVudi5FTUFJTF9GUk9NLFxuXG4gIGNsb3VkaW5hcnlfY2xvdWRfbmFtZTogZW52LkNMT1VESU5BUllfQ0xPVURfTkFNRSxcbiAgY2xvdWRpbmFyeV9hcGlfa2V5OiBlbnYuQ0xPVURJTkFSWV9BUElfS0VZLFxuICBjbG91ZGluYXJ5X2FwaV9zZWNyZXQ6IGVudi5DTE9VRElOQVJZX0FQSV9TRUNSRVQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5jb25zdCBub3RGb3VuZEhhbmRsZXIgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5zdGF0dXMoNDA0KS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgbWVzc2FnZTogXCJSb3V0ZSBub3QgZm91bmRcIixcbiAgICBwYXRoOiByZXEub3JpZ2luYWxVcmwsXG4gICAgZGF0ZTogbmV3IERhdGUoKSxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBub3RGb3VuZEhhbmRsZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgWm9kRXJyb3IgfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuY29uc3QgZ2xvYmFsRXJyb3JIYW5kbGVyID0gKFxuICBlcnI6IGFueSxcbiAgcmVxOiBSZXF1ZXN0LFxuICByZXM6IFJlc3BvbnNlLFxuICBuZXh0OiBOZXh0RnVuY3Rpb24sXG4pID0+IHtcbiAgaWYgKGNvbmZpZy5ub2RlX2VudiAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3I6XCIsIGVycik7XG4gIH1cblxuICAvLyBkZWZhdWx0IGZhbGxiYWNrXG4gIGxldCBzdGF0dXNDb2RlOiBudW1iZXIgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgbGV0IGVycm9yTWVzc2FnZTogc3RyaW5nID0gZXJyPy5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gIGxldCBlcnJvck5hbWU6IHN0cmluZyA9IGVycj8ubmFtZSB8fCBcIkVycm9yXCI7XG5cbiAgLy8gWm9kIHZhbGlkYXRpb24gZXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFpvZEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLmlzc3Vlcy5tYXAoKGkpID0+IGkubWVzc2FnZSkuam9pbihcIiwgXCIpO1xuICAgIGVycm9yTmFtZSA9IFwiWm9kRXJyb3JcIjtcbiAgfVxuXG4gIC8vIE11bHRlciBmaWxlIHVwbG9hZCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBtdWx0ZXIuTXVsdGVyRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck5hbWUgPSBcIk11bHRlckVycm9yXCI7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIGVyci5jb2RlID09PSBcIkxJTUlUX0ZJTEVfU0laRVwiXG4gICAgICAgID8gXCJGaWxlIHRvbyBsYXJnZS4gTWF4aW11bSBzaXplIGlzIDVNQi5cIlxuICAgICAgICA6IGBVcGxvYWQgZmFpbGVkOiAke2Vyci5jb2RlfWA7XG4gIH1cblxuICAvLyBDdXN0b20gZmlsZSB0eXBlIHJlamVjdGlvbiBmcm9tIHRoZSBtdWx0ZXIgZmlsZUZpbHRlclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiAoZXJyIGFzIGFueSkuY29kZSA9PT0gXCJJTlZBTElEX0ZJTEVfVFlQRVwiKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gIH1cblxuICAvLyBQcmlzbWEgdmFsaWRhdGlvbiBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIFwiWW91IGhhdmUgcHJvdmlkZWQgaW5jb3JyZWN0IGZpZWxkIHR5cGUgb3IgbWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclwiO1xuICB9XG5cbiAgLy8gUHJpc21hIGtub3duIGVycm9yc1xuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IpIHtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMDJcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQ09ORkxJQ1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIlRoaXMgdmFsdWUgYWxyZWFkeSBleGlzdHNcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDAzXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJGb3JlaWduIGtleSBjb25zdHJhaW50IGZhaWxlZFwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMjVcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuTk9UX0ZPVU5EO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBbiBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2Ugb25lIG9yIG1vcmUgcmVxdWlyZWQgcmVjb3JkcyB3ZXJlIG5vdCBmb3VuZC5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgREIgY29ubmVjdGlvbi9pbml0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMFwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQ7XG4gICAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBcIkF1dGhlbnRpY2F0aW9uIGZhaWxlZCBhZ2FpbnN0IHRoZSBkYXRhYmFzZSBzZXJ2ZXIuIFBsZWFzZSBjaGVjayB5b3VyIGRhdGFiYXNlIGNyZWRlbnRpYWxzLlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMVwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5TRVJWSUNFX1VOQVZBSUxBQkxFO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJDYW4ndCByZWFjaCB0aGUgZGF0YWJhc2Ugc2VydmVyLlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgdW5rbm93biByZXF1ZXN0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9IFwiRXJyb3Igb2NjdXJyZWQgZHVyaW5nIHF1ZXJ5IGV4ZWN1dGlvblwiO1xuICB9XG5cbiAgLy8gWW91ciBjdXN0b20gQXBwRXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgQXBwRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gZXJyLnN0YXR1c0NvZGU7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJBcHBFcnJvclwiO1xuICB9XG5cbiAgLy8gRmFsbGJhY2sgZm9yIG90aGVyIHRocm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIjtcbiAgICBlcnJvck5hbWUgPSBlcnIubmFtZSB8fCBcIkVycm9yXCI7XG4gIH1cblxuICByZXMuc3RhdHVzKHN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIHN0YXR1c0NvZGUsXG4gICAgbmFtZTogZXJyb3JOYW1lLFxuICAgIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcbiAgICBlcnJvcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IGVyci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBnbG9iYWxFcnJvckhhbmRsZXI7XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBUaGlzIGZpbGUgc2hvdWxkIGJlIHlvdXIgbWFpbiBpbXBvcnQgdG8gdXNlIFByaXNtYS4gVGhyb3VnaCBpdCB5b3UgZ2V0IGFjY2VzcyB0byBhbGwgdGhlIG1vZGVscywgZW51bXMsIGFuZCBpbnB1dCB0eXBlcy5cbiAqIElmIHlvdSdyZSBsb29raW5nIGZvciBzb21ldGhpbmcgeW91IGNhbiBpbXBvcnQgaW4gdGhlIGNsaWVudC1zaWRlIG9mIHlvdXIgYXBwbGljYXRpb24sIHBsZWFzZSByZWZlciB0byB0aGUgYGJyb3dzZXIudHNgIGZpbGUgaW5zdGVhZC5cbiAqXG4gKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuICovXG5cbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5nbG9iYWxUaGlzWydfX2Rpcm5hbWUnXSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCAqIGFzICRFbnVtcyBmcm9tIFwiLi9lbnVtc1wiXG5pbXBvcnQgKiBhcyAkQ2xhc3MgZnJvbSBcIi4vaW50ZXJuYWwvY2xhc3NcIlxuaW1wb3J0ICogYXMgUHJpc21hIGZyb20gXCIuL2ludGVybmFsL3ByaXNtYU5hbWVzcGFjZVwiXG5cbmV4cG9ydCAqIGFzICRFbnVtcyBmcm9tICcuL2VudW1zJ1xuZXhwb3J0ICogZnJvbSBcIi4vZW51bXNcIlxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnQgPSAkQ2xhc3MuZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKVxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50PExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlciwgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0sIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPiA9ICRDbGFzcy5QcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG5leHBvcnQgeyBQcmlzbWEgfVxuXG4vKipcbiAqIE1vZGVsIEJsb2dQb3N0XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQmxvZ1Bvc3QgPSBQcmlzbWEuQmxvZ1Bvc3RNb2RlbFxuLyoqXG4gKiBNb2RlbCBCb29raW5nXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQm9va2luZyA9IFByaXNtYS5Cb29raW5nTW9kZWxcbi8qKlxuICogTW9kZWwgQ2F0ZWdvcnlcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDYXRlZ29yeSA9IFByaXNtYS5DYXRlZ29yeU1vZGVsXG4vKipcbiAqIE1vZGVsIENvbnRhY3RNZXNzYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2UgPSBQcmlzbWEuQ29udGFjdE1lc3NhZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmV2aWV3XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmV2aWV3ID0gUHJpc21hLlJldmlld01vZGVsXG4vKipcbiAqIE1vZGVsIFRvdXJQYWNrYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVG91clBhY2thZ2UgPSBQcmlzbWEuVG91clBhY2thZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBVc2VyXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVXNlciA9IFByaXNtYS5Vc2VyTW9kZWxcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogUGxlYXNlIGltcG9ydCB0aGUgYFByaXNtYUNsaWVudGAgY2xhc3MgZnJvbSB0aGUgYGNsaWVudC50c2AgZmlsZSBpbnN0ZWFkLlxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuL3ByaXNtYU5hbWVzcGFjZVwiXG5cblxuY29uc3QgY29uZmlnOiBydW50aW1lLkdldFByaXNtYUNsaWVudENvbmZpZyA9IHtcbiAgXCJwcmV2aWV3RmVhdHVyZXNcIjogW10sXG4gIFwiY2xpZW50VmVyc2lvblwiOiBcIjcuOS4xXCIsXG4gIFwiZW5naW5lVmVyc2lvblwiOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIixcbiAgXCJhY3RpdmVQcm92aWRlclwiOiBcInBvc3RncmVzcWxcIixcbiAgXCJpbmxpbmVTY2hlbWFcIjogXCJtb2RlbCBCbG9nUG9zdCB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgIFN0cmluZyAgICAgQHVuaXF1ZVxcbiAgZXhjZXJwdCAgICBTdHJpbmdcXG4gIGNvbnRlbnQgICAgU3RyaW5nXFxuICBjb3ZlckltYWdlIFN0cmluZ1xcbiAgc3RhdHVzICAgICBQb3N0U3RhdHVzIEBkZWZhdWx0KERSQUZUKVxcbiAgaXNEZWxldGVkICBCb29sZWFuICAgIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgYXV0aG9ySWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYXV0aG9yIFVzZXIgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFthdXRob3JJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19wb3N0c1xcXCIpXFxufVxcblxcbm1vZGVsIEJvb2tpbmcge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0cmF2ZWxEYXRlIERhdGVUaW1lXFxuICB0cmF2ZWxlcnMgIEludFxcbiAgdG90YWxQcmljZSBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgc3RhdHVzICAgICBCb29raW5nU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGF5bWVudHMgUGF5bWVudFtdXFxuXFxuICBAQGluZGV4KFt1c2VySWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFt1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZV0pXFxuICBAQG1hcChcXFwiYm9va2luZ3NcXFwiKVxcbn1cXG5cXG5tb2RlbCBDYXRlZ29yeSB7XFxuICBpZCAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSBTdHJpbmcgQHVuaXF1ZVxcbiAgc2x1ZyBTdHJpbmcgQHVuaXF1ZVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW11cXG5cXG4gIEBAbWFwKFxcXCJjYXRlZ29yaWVzXFxcIilcXG59XFxuXFxubW9kZWwgQ29udGFjdE1lc3NhZ2Uge1xcbiAgaWQgICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICBTdHJpbmdcXG4gIHN1YmplY3QgICAgU3RyaW5nXFxuICBtZXNzYWdlICAgIFN0cmluZ1xcbiAgaXNSZXNvbHZlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIEBAaW5kZXgoW2lzUmVzb2x2ZWRdKVxcbiAgQEBtYXAoXFxcImNvbnRhY3RfbWVzc2FnZXNcXFwiKVxcbn1cXG5cXG5lbnVtIFJvbGUge1xcbiAgVVNFUlxcbiAgQUdFTlRcXG4gIEFETUlOXFxufVxcblxcbmVudW0gVXNlclN0YXR1cyB7XFxuICBBQ1RJVkVcXG4gIFNVU1BFTkRFRFxcbn1cXG5cXG5lbnVtIEF1dGhQcm92aWRlciB7XFxuICBDUkVERU5USUFMXFxuICBHT09HTEVcXG59XFxuXFxuZW51bSBQYWNrYWdlU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIEFQUFJPVkVEXFxuICBSRUpFQ1RFRFxcbn1cXG5cXG5lbnVtIEJvb2tpbmdTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgUEFJRFxcbiAgQ09ORklSTUVEXFxuICBDQU5DRUxMRURcXG4gIENPTVBMRVRFRFxcbn1cXG5cXG5lbnVtIFBheW1lbnRTdGF0dXMge1xcbiAgSU5JVElBVEVEXFxuICBTVUNDRVNTXFxuICBGQUlMRURcXG4gIENBTkNFTExFRFxcbiAgUkVGVU5ERURcXG59XFxuXFxuZW51bSBQb3N0U3RhdHVzIHtcXG4gIERSQUZUXFxuICBQVUJMSVNIRURcXG59XFxuXFxubW9kZWwgUGF5bWVudCB7XFxuICBpZCAgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBib29raW5nSWQgICAgICBTdHJpbmdcXG4gIHRyYW5JZCAgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZSAvLyBTU0xDb21tZXJ6IHRyYW5zYWN0aW9uIGlkLCBnZW5lcmF0ZWQgc2VydmVyLXNpZGVcXG4gIHZhbElkICAgICAgICAgIFN0cmluZz8gLy8gc2V0IGFmdGVyIGdhdGV3YXkgc3VjY2VzcywgdXNlZCBmb3Igc2VydmVyLXNpZGUgdmFsaWRhdGlvblxcbiAgYW1vdW50ICAgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMikgLy8gPSBib29raW5nLnRvdGFsUHJpY2UgYXQgc2Vzc2lvbiBjcmVhdGlvblxcbiAgY3VycmVuY3kgICAgICAgU3RyaW5nICAgICAgICBAZGVmYXVsdChcXFwiQkRUXFxcIilcXG4gIHN0YXR1cyAgICAgICAgIFBheW1lbnRTdGF0dXMgQGRlZmF1bHQoSU5JVElBVEVEKVxcbiAgZ2F0ZXdheVBhZ2VVcmwgU3RyaW5nP1xcbiAgc3NsU2Vzc2lvbktleSAgU3RyaW5nP1xcbiAgY2FyZFR5cGUgICAgICAgU3RyaW5nP1xcbiAgYmFua1RyYW5JZCAgICAgU3RyaW5nP1xcbiAgcGFpZEF0ICAgICAgICAgRGF0ZVRpbWU/XFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYm9va2luZyBCb29raW5nIEByZWxhdGlvbihmaWVsZHM6IFtib29raW5nSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEBpbmRleChbYm9va2luZ0lkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwicGF5bWVudHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZXZpZXcge1xcbiAgaWQgICAgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHJhdGluZyAgSW50XFxuICBjb21tZW50IFN0cmluZ1xcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBtYXAoXFxcInJldmlld3NcXFwiKVxcbn1cXG5cXG4vLyBUaGlzIGlzIHlvdXIgUHJpc21hIHNjaGVtYSBmaWxlLFxcbi8vIGxlYXJuIG1vcmUgYWJvdXQgaXQgaW4gdGhlIGRvY3M6IGh0dHBzOi8vcHJpcy5seS9kL3ByaXNtYS1zY2hlbWFcXG5cXG5nZW5lcmF0b3IgY2xpZW50IHtcXG4gIHByb3ZpZGVyID0gXFxcInByaXNtYS1jbGllbnRcXFwiXFxuICBvdXRwdXQgICA9IFxcXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hXFxcIlxcbn1cXG5cXG5kYXRhc291cmNlIGRiIHtcXG4gIHByb3ZpZGVyID0gXFxcInBvc3RncmVzcWxcXFwiXFxufVxcblxcbm1vZGVsIFRvdXJQYWNrYWdlIHtcXG4gIGlkICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlXFxuICBkZXNjcmlwdGlvbiBTdHJpbmdcXG4gIGxvY2F0aW9uICAgIFN0cmluZ1xcbiAgcHJpY2UgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIGR1cmF0aW9uICAgIEludFxcbiAgcmF0aW5nICAgICAgRmxvYXQgICAgICAgICBAZGVmYXVsdCgwKVxcbiAgaW1hZ2VzICAgICAgU3RyaW5nW11cXG4gIHN0YXR1cyAgICAgIFBhY2thZ2VTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG4gIGlzRGVsZXRlZCAgIEJvb2xlYW4gICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjYXRlZ29yeUlkIFN0cmluZ1xcbiAgYWdlbnRJZCAgICBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBjYXRlZ29yeSBDYXRlZ29yeSAgQHJlbGF0aW9uKGZpZWxkczogW2NhdGVnb3J5SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgYWdlbnQgICAgVXNlciAgICAgIEByZWxhdGlvbihcXFwiQWdlbnRQYWNrYWdlc1xcXCIsIGZpZWxkczogW2FnZW50SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgYm9va2luZ3MgQm9va2luZ1tdXFxuICByZXZpZXdzICBSZXZpZXdbXVxcblxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZF0pXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkLCBwcmljZV0pXFxuICBAQGluZGV4KFtwcmljZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInRvdXJfcGFja2FnZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBVc2VyIHtcXG4gIGlkICAgICAgICAgICAgU3RyaW5nICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgICAgQHVuaXF1ZVxcbiAgcGFzc3dvcmQgICAgICBTdHJpbmc/XFxuICBnb29nbGVJZCAgICAgIFN0cmluZz8gICAgICBAdW5pcXVlXFxuICBwaG9uZSAgICAgICAgIFN0cmluZz9cXG4gIGF2YXRhclVybCAgICAgU3RyaW5nP1xcbiAgcm9sZSAgICAgICAgICBSb2xlICAgICAgICAgQGRlZmF1bHQoVVNFUilcXG4gIHN0YXR1cyAgICAgICAgVXNlclN0YXR1cyAgIEBkZWZhdWx0KEFDVElWRSlcXG4gIGF1dGhQcm92aWRlciAgQXV0aFByb3ZpZGVyIEBkZWZhdWx0KENSRURFTlRJQUwpXFxuICBlbWFpbFZlcmlmaWVkIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIGlzRGVsZXRlZCAgICAgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgdG9rZW5WZXJzaW9uICBJbnQgICAgICAgICAgQGRlZmF1bHQoMClcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyBUb3VyUGFja2FnZVtdIEByZWxhdGlvbihcXFwiQWdlbnRQYWNrYWdlc1xcXCIpXFxuICBib29raW5ncyBCb29raW5nW10gICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIpXFxuICByZXZpZXdzICBSZXZpZXdbXSAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIilcXG4gIHBvc3RzICAgIEJsb2dQb3N0W10gICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIpXFxuXFxuICBAQGluZGV4KFtyb2xlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidXNlcnNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ1Bvc3RcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleGNlcnB0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb250ZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb3ZlckltYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQb3N0U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9ySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9yXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfcG9zdHNcXFwifSxcXFwiQm9va2luZ1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsRGF0ZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRvdGFsUHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGF5bWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJib29raW5nc1xcXCJ9LFxcXCJDYXRlZ29yeVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNhdGVnb3JpZXNcXFwifSxcXFwiQ29udGFjdE1lc3NhZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdWJqZWN0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1Jlc29sdmVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNvbnRhY3RfbWVzc2FnZXNcXFwifSxcXFwiUGF5bWVudFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ0lkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInZhbElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhbW91bnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjdXJyZW5jeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGF5bWVudFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImdhdGV3YXlQYWdlVXJsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXJkVHlwZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYmFua1RyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFpZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1BheW1lbnRcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwidG91cl9wYWNrYWdlc1xcXCJ9LFxcXCJVc2VyXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFzc3dvcmRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImdvb2dsZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwaG9uZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXZhdGFyVXJsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyb2xlXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUm9sZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJBdXRoUHJvdmlkZXJcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJSZXZpZXdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lclJldmlld3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwb3N0c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQmxvZ1Bvc3RcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBdXRob3JQb3N0c1xcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwidXNlcnNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwicG9zdHNcXFwiLFxcXCJhdXRob3JcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dQb3N0LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlT25lXFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cGRhdGVPbmVcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwc2VydE9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlT25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVNYW55XFxcIixcXFwiUGF5bWVudC5ncm91cEJ5XFxcIixcXFwiUGF5bWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJSZXZpZXcuZmluZFVuaXF1ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kRmlyc3RcXFwiLFxcXCJSZXZpZXcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVPbmVcXFwiLFxcXCJSZXZpZXcuY3JlYXRlTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU9uZVxcXCIsXFxcIlJldmlldy51cGRhdGVNYW55XFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBzZXJ0T25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU9uZVxcXCIsXFxcIlJldmlldy5kZWxldGVNYW55XFxcIixcXFwiUmV2aWV3Lmdyb3VwQnlcXFwiLFxcXCJSZXZpZXcuYWdncmVnYXRlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwc2VydE9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5ncm91cEJ5XFxcIixcXFwiVG91clBhY2thZ2UuYWdncmVnYXRlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlVzZXIuZmluZEZpcnN0XFxcIixcXFwiVXNlci5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVXNlci5maW5kTWFueVxcXCIsXFxcIlVzZXIuY3JlYXRlT25lXFxcIixcXFwiVXNlci5jcmVhdGVNYW55XFxcIixcXFwiVXNlci5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVXNlci51cGRhdGVPbmVcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwc2VydE9uZVxcXCIsXFxcIlVzZXIuZGVsZXRlT25lXFxcIixcXFwiVXNlci5kZWxldGVNYW55XFxcIixcXFwiVXNlci5ncm91cEJ5XFxcIixcXFwiVXNlci5hZ2dyZWdhdGVcXFwiLFxcXCJBTkRcXFwiLFxcXCJPUlxcXCIsXFxcIk5PVFxcXCIsXFxcImlkXFxcIixcXFwibmFtZVxcXCIsXFxcImVtYWlsXFxcIixcXFwicGFzc3dvcmRcXFwiLFxcXCJnb29nbGVJZFxcXCIsXFxcInBob25lXFxcIixcXFwiYXZhdGFyVXJsXFxcIixcXFwiUm9sZVxcXCIsXFxcInJvbGVcXFwiLFxcXCJVc2VyU3RhdHVzXFxcIixcXFwic3RhdHVzXFxcIixcXFwiQXV0aFByb3ZpZGVyXFxcIixcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImlzRGVsZXRlZFxcXCIsXFxcInRva2VuVmVyc2lvblxcXCIsXFxcImNyZWF0ZWRBdFxcXCIsXFxcInVwZGF0ZWRBdFxcXCIsXFxcImVxdWFsc1xcXCIsXFxcImluXFxcIixcXFwibm90SW5cXFwiLFxcXCJsdFxcXCIsXFxcImx0ZVxcXCIsXFxcImd0XFxcIixcXFwiZ3RlXFxcIixcXFwibm90XFxcIixcXFwiY29udGFpbnNcXFwiLFxcXCJzdGFydHNXaXRoXFxcIixcXFwiZW5kc1dpdGhcXFwiLFxcXCJldmVyeVxcXCIsXFxcInNvbWVcXFwiLFxcXCJub25lXFxcIixcXFwidGl0bGVcXFwiLFxcXCJzbHVnXFxcIixcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJsb2NhdGlvblxcXCIsXFxcInByaWNlXFxcIixcXFwiZHVyYXRpb25cXFwiLFxcXCJyYXRpbmdcXFwiLFxcXCJpbWFnZXNcXFwiLFxcXCJQYWNrYWdlU3RhdHVzXFxcIixcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImFnZW50SWRcXFwiLFxcXCJoYXNcXFwiLFxcXCJoYXNFdmVyeVxcXCIsXFxcImhhc1NvbWVcXFwiLFxcXCJjb21tZW50XFxcIixcXFwidXNlcklkXFxcIixcXFwicGFja2FnZUlkXFxcIixcXFwiYm9va2luZ0lkXFxcIixcXFwidHJhbklkXFxcIixcXFwidmFsSWRcXFwiLFxcXCJhbW91bnRcXFwiLFxcXCJjdXJyZW5jeVxcXCIsXFxcIlBheW1lbnRTdGF0dXNcXFwiLFxcXCJnYXRld2F5UGFnZVVybFxcXCIsXFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJjYXJkVHlwZVxcXCIsXFxcImJhbmtUcmFuSWRcXFwiLFxcXCJwYWlkQXRcXFwiLFxcXCJzdWJqZWN0XFxcIixcXFwibWVzc2FnZVxcXCIsXFxcImlzUmVzb2x2ZWRcXFwiLFxcXCJ0cmF2ZWxEYXRlXFxcIixcXFwidHJhdmVsZXJzXFxcIixcXFwidG90YWxQcmljZVxcXCIsXFxcIkJvb2tpbmdTdGF0dXNcXFwiLFxcXCJleGNlcnB0XFxcIixcXFwiY29udGVudFxcXCIsXFxcImNvdmVySW1hZ2VcXFwiLFxcXCJQb3N0U3RhdHVzXFxcIixcXFwiYXV0aG9ySWRcXFwiLFxcXCJ1c2VySWRfcGFja2FnZUlkXFxcIixcXFwiaXNcXFwiLFxcXCJpc05vdFxcXCIsXFxcImNvbm5lY3RPckNyZWF0ZVxcXCIsXFxcInVwc2VydFxcXCIsXFxcImNyZWF0ZU1hbnlcXFwiLFxcXCJzZXRcXFwiLFxcXCJkaXNjb25uZWN0XFxcIixcXFwiZGVsZXRlXFxcIixcXFwiY29ubmVjdFxcXCIsXFxcInVwZGF0ZU1hbnlcXFwiLFxcXCJkZWxldGVNYW55XFxcIixcXFwicHVzaFxcXCIsXFxcImluY3JlbWVudFxcXCIsXFxcImRlY3JlbWVudFxcXCIsXFxcIm11bHRpcGx5XFxcIixcXFwiZGl2aWRlXFxcIl1cIiksXG4gIGdyYXBoOiBcImxBUlBnQUVQRGdBQW9RSUFJSmNCQUFDZkFnQXdtQUVBQUJvQUVKa0JBQUNmQWdBd21nRUJBQUFBQWFRQkFBQ2dBdUVCSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQUFBQUFkMEJBUUQxQVFBaDNnRUJBUFVCQUNIZkFRRUE5UUVBSWVFQkFRRDFBUUFoQVFBQUFBRUFJQllGQUFDd0FnQWdCZ0FBb1FJQUlBc0FBUDRCQUNBTUFBRF9BUUFnbHdFQUFLMENBRENZQVFBQUF3QVFtUUVBQUswQ0FEQ2FBUUVBOVFFQUlhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0c4QVFFQTlRRUFJYjBCQVFEMUFRQWh2Z0VRQUtZQ0FDR19BUUlBLXdFQUljQUJDQUN1QWdBaHdRRUFBSVFDQUNEREFRRUE5UUVBSWNRQkFRRDFBUUFoQkFVQUFPUURBQ0FHQUFEZ0F3QWdDd0FBcndNQUlBd0FBTEFEQUNBV0JRQUFzQUlBSUFZQUFLRUNBQ0FMQUFELUFRQWdEQUFBX3dFQUlKY0JBQUN0QWdBd21BRUFBQU1BRUprQkFBQ3RBZ0F3bWdFQkFBQUFBYVFCQUFDdkFzTUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBQUFBQWJ3QkFRRDFBUUFodlFFQkFQVUJBQ0ctQVJBQXBnSUFJYjhCQWdEN0FRQWh3QUVJQUs0Q0FDSEJBUUFBaEFJQUlNTUJBUUQxQVFBaHhBRUJBUFVCQUNFREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBRUFBQUFEQUNBUEJ3QUFvUUlBSUFnQUFLUUNBQ0FLQUFDc0FnQWdsd0VBQUtvQ0FEQ1lBUUFBQ1FBUW1RRUFBS29DQURDYUFRRUE5UUVBSWFRQkFBQ3JBdDBCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWgyUUZBQVB3QkFDSGFBUUlBLXdFQUlkc0JFQUNtQWdBaEF3Y0FBT0FEQUNBSUFBRGhBd0FnQ2dBQTR3TUFJQThIQUFDaEFnQWdDQUFBcEFJQUlBb0FBS3dDQUNDWEFRQUFxZ0lBTUpnQkFBQUpBQkNaQVFBQXFnSUFNSm9CQVFBQUFBR2tBUUFBcXdMZEFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHlRRUJBUFVCQUNIS0FRRUE5UUVBSWRrQlFBRDhBUUFoMmdFQ0FQc0JBQ0hiQVJBQXBnSUFJUU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FTQ1FBQXFRSUFJSmNCQUFDbEFnQXdtQUVBQUEwQUVKa0JBQUNsQWdBd21nRUJBUFVCQUNHa0FRQUFwd0xSQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeXdFQkFQVUJBQ0hNQVFFQTlRRUFJYzBCQVFEMkFRQWh6Z0VRQUtZQ0FDSFBBUUVBOVFFQUlkRUJBUUQyQVFBaDBnRUJBUFlCQUNIVEFRRUE5Z0VBSWRRQkFRRDJBUUFoMVFGQUFLZ0NBQ0VIQ1FBQTRnTUFJTTBCQUFDeEFnQWcwUUVBQUxFQ0FDRFNBUUFBc1FJQUlOTUJBQUN4QWdBZzFBRUFBTEVDQUNEVkFRQUFzUUlBSUJJSkFBQ3BBZ0FnbHdFQUFLVUNBRENZQVFBQURRQVFtUUVBQUtVQ0FEQ2FBUUVBQUFBQnBBRUFBS2NDMFFFaXFnRkFBUHdCQUNHckFVQUFfQUVBSWNzQkFRRDFBUUFoekFFQkFBQUFBYzBCQVFEMkFRQWh6Z0VRQUtZQ0FDSFBBUUVBOVFFQUlkRUJBUUQyQVFBaDBnRUJBUFlCQUNIVEFRRUE5Z0VBSWRRQkFRRDJBUUFoMVFGQUFLZ0NBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQXdIQUFDaEFnQWdDQUFBcEFJQUlKY0JBQUNqQWdBd21BRUFBQklBRUprQkFBQ2pBZ0F3bWdFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNFQ0J3QUE0QU1BSUFnQUFPRURBQ0FOQndBQW9RSUFJQWdBQUtRQ0FDQ1hBUUFBb3dJQU1KZ0JBQUFTQUJDWkFRQUFvd0lBTUpvQkFRQUFBQUdxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNIaUFRQUFvZ0lBSUFNQUFBQVNBQ0FCQUFBVEFEQUNBQUFVQUNBQkFBQUFDUUFnQVFBQUFCSUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRHc0QUFLRUNBQ0NYQVFBQW53SUFNSmdCQUFBYUFCQ1pBUUFBbndJQU1Kb0JBUUQxQVFBaHBBRUFBS0FDNFFFaXFBRWdBUG9CQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFodWdFQkFQVUJBQ0c3QVFFQTlRRUFJZDBCQVFEMUFRQWgzZ0VCQVBVQkFDSGZBUUVBOVFFQUllRUJBUUQxQVFBaEFRNEFBT0FEQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUJvQUlBRUFBQUFCQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0F3QUFBQm9BSUFFQUFCc0FNQUlBQUFFQUlBTUFBQUFhQUNBQkFBQWJBREFDQUFBQkFDQU1EZ0FBM3dNQUlKb0JBUUFBQUFHa0FRQUFBT0VCQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCM1FFQkFBQUFBZDRCQVFBQUFBSGZBUUVBQUFBQjRRRUJBQUFBQVFFVUFBQWxBQ0FMbWdFQkFBQUFBYVFCQUFBQTRRRUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBSGRBUUVBQUFBQjNnRUJBQUFBQWQ4QkFRQUFBQUhoQVFFQUFBQUJBUlFBQUNjQU1BRVVBQUFuQURBTURnQUEzZ01BSUpvQkFRQzNBZ0FocEFFQUFNMEM0UUVpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlkMEJBUUMzQWdBaDNnRUJBTGNDQUNIZkFRRUF0d0lBSWVFQkFRQzNBZ0FoQWdBQUFBRUFJQlFBQUNvQUlBdWFBUUVBdHdJQUlhUUJBQUROQXVFQklxZ0JJQUM4QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJvQkFRQzNBZ0FodXdFQkFMY0NBQ0hkQVFFQXR3SUFJZDRCQVFDM0FnQWgzd0VCQUxjQ0FDSGhBUUVBdHdJQUlRSUFBQUFhQUNBVUFBQXNBQ0FDQUFBQUdnQWdGQUFBTEFBZ0F3QUFBQUVBSUJzQUFDVUFJQndBQUNvQUlBRUFBQUFCQUNBQkFBQUFHZ0FnQXdRQUFOc0RBQ0FoQUFEZEF3QWdJZ0FBM0FNQUlBNlhBUUFBbXdJQU1KZ0JBQUF6QUJDWkFRQUFtd0lBTUpvQkFRRGFBUUFocEFFQUFKd0M0UUVpcUFFZ0FOOEJBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh1Z0VCQU5vQkFDRzdBUUVBMmdFQUlkMEJBUURhQVFBaDNnRUJBTm9CQUNIZkFRRUEyZ0VBSWVFQkFRRGFBUUFoQXdBQUFCb0FJQUVBQURJQU1DQUFBRE1BSUFNQUFBQWFBQ0FCQUFBYkFEQUNBQUFCQUNBQkFBQUFDd0FnQVFBQUFBc0FJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQXdBQUFBa0FJQUVBQUFvQU1BSUFBQXNBSUF3SEFBQ2tBd0FnQ0FBQV9BSUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURkQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJRRkFBQUFBQWRvQkFnQUFBQUhiQVJBQUFBQUJBUlFBQURzQUlBbWFBUUVBQUFBQnBBRUFBQURkQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJRRkFBQUFBQWRvQkFnQUFBQUhiQVJBQUFBQUJBUlFBQUQwQU1BRVVBQUE5QURBTUJ3QUFvZ01BSUFnQUFPc0NBQ0FLQUFEc0FnQWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZEFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSWRrQlFBQy1BZ0FoMmdFQ0FMMENBQ0hiQVJBQTZBSUFJUUlBQUFBTEFDQVVBQUJBQUNBSm1nRUJBTGNDQUNHa0FRQUE2UUxkQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeVFFQkFMY0NBQ0hLQVFFQXR3SUFJZGtCUUFDLUFnQWgyZ0VDQUwwQ0FDSGJBUkFBNkFJQUlRSUFBQUFKQUNBVUFBQkNBQ0FDQUFBQUNRQWdGQUFBUWdBZ0F3QUFBQXNBSUJzQUFEc0FJQndBQUVBQUlBRUFBQUFMQUNBQkFBQUFDUUFnQlFRQUFOWURBQ0FoQUFEWkF3QWdJZ0FBMkFNQUlETUFBTmNEQUNBMEFBRGFBd0FnREpjQkFBQ1hBZ0F3bUFFQUFFa0FFSmtCQUFDWEFnQXdtZ0VCQU5vQkFDR2tBUUFBbUFMZEFTS3FBVUFBNFFFQUlhc0JRQURoQVFBaHlRRUJBTm9CQUNIS0FRRUEyZ0VBSWRrQlFBRGhBUUFoMmdFQ0FPQUJBQ0hiQVJBQWdnSUFJUU1BQUFBSkFDQUJBQUJJQURBZ0FBQkpBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQ1FNQUFQMEJBQ0NYQVFBQWxnSUFNSmdCQUFCUEFCQ1pBUUFBbGdJQU1Kb0JBUUFBQUFHYkFRRUFBQUFCcWdGQUFQd0JBQ0dyQVVBQV9BRUFJYnNCQVFBQUFBRUJBQUFBVEFBZ0FRQUFBRXdBSUFrREFBRDlBUUFnbHdFQUFKWUNBRENZQVFBQVR3QVFtUUVBQUpZQ0FEQ2FBUUVBOVFFQUlac0JBUUQxQVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJzQkFRRDFBUUFoQVFNQUFLNERBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQXdBQUFFOEFJQUVBQUZBQU1BSUFBRXdBSUFNQUFBQlBBQ0FCQUFCUUFEQUNBQUJNQUNBR0F3QUExUU1BSUpvQkFRQUFBQUdiQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFHN0FRRUFBQUFCQVJRQUFGUUFJQVdhQVFFQUFBQUJtd0VCQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdXdFQkFBQUFBUUVVQUFCV0FEQUJGQUFBVmdBd0JnTUFBTXNEQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUV3QUlCUUFBRmtBSUFXYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUU4QUlCUUFBRnNBSUFJQUFBQlBBQ0FVQUFCYkFDQURBQUFBVEFBZ0d3QUFWQUFnSEFBQVdRQWdBUUFBQUV3QUlBRUFBQUJQQUNBREJBQUF5QU1BSUNFQUFNb0RBQ0FpQUFESkF3QWdDSmNCQUFDVkFnQXdtQUVBQUdJQUVKa0JBQUNWQWdBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0c3QVFFQTJnRUFJUU1BQUFCUEFDQUJBQUJoQURBZ0FBQmlBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQzVjQkFBQ1VBZ0F3bUFFQUFHZ0FFSmtCQUFDVUFnQXdtZ0VCQUFBQUFac0JBUUQxQVFBaG5BRUJBUFVCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoMWdFQkFQVUJBQ0hYQVFFQTlRRUFJZGdCSUFENkFRQWhBUUFBQUdVQUlBRUFBQUJsQUNBTGx3RUFBSlFDQURDWUFRQUFhQUFRbVFFQUFKUUNBRENhQVFFQTlRRUFJWnNCQVFEMUFRQWhuQUVCQVBVQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaDFnRUJBUFVCQUNIWEFRRUE5UUVBSWRnQklBRDZBUUFoQUFNQUFBQm9BQ0FCQUFCcEFEQUNBQUJsQUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0F3QUFBR2dBSUFFQUFHa0FNQUlBQUdVQUlBaWFBUUVBQUFBQm13RUJBQUFBQVp3QkFRQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFkWUJBUUFBQUFIWEFRRUFBQUFCMkFFZ0FBQUFBUUVVQUFCdEFDQUltZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSFdBUUVBQUFBQjF3RUJBQUFBQWRnQklBQUFBQUVCRkFBQWJ3QXdBUlFBQUc4QU1BaWFBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoMWdFQkFMY0NBQ0hYQVFFQXR3SUFJZGdCSUFDOEFnQWhBZ0FBQUdVQUlCUUFBSElBSUFpYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWgxZ0VCQUxjQ0FDSFhBUUVBdHdJQUlkZ0JJQUM4QWdBaEFnQUFBR2dBSUJRQUFIUUFJQUlBQUFCb0FDQVVBQUIwQUNBREFBQUFaUUFnR3dBQWJRQWdIQUFBY2dBZ0FRQUFBR1VBSUFFQUFBQm9BQ0FEQkFBQXhRTUFJQ0VBQU1jREFDQWlBQURHQXdBZ0M1Y0JBQUNUQWdBd21BRUFBSHNBRUprQkFBQ1RBZ0F3bWdFQkFOb0JBQ0diQVFFQTJnRUFJWndCQVFEYUFRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlkWUJBUURhQVFBaDF3RUJBTm9CQUNIWUFTQUEzd0VBSVFNQUFBQm9BQ0FCQUFCNkFEQWdBQUI3QUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0FRQUFBQThBSUFFQUFBQVBBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBUENRQUF4QU1BSUpvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnl3RUJBQUFBQWN3QkFRQUFBQUhOQVFFQUFBQUJ6Z0VRQUFBQUFjOEJBUUFBQUFIUkFRRUFBQUFCMGdFQkFBQUFBZE1CQVFBQUFBSFVBUUVBQUFBQjFRRkFBQUFBQVFFVUFBQ0RBUUFnRHBvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnl3RUJBQUFBQWN3QkFRQUFBQUhOQVFFQUFBQUJ6Z0VRQUFBQUFjOEJBUUFBQUFIUkFRRUFBQUFCMGdFQkFBQUFBZE1CQVFBQUFBSFVBUUVBQUFBQjFRRkFBQUFBQVFFVUFBQ0ZBUUF3QVJRQUFJVUJBREFQQ1FBQXd3TUFJSm9CQVFDM0FnQWhwQUVBQVBjQzBRRWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljc0JBUUMzQWdBaHpBRUJBTGNDQUNITkFRRUF1QUlBSWM0QkVBRG9BZ0FoendFQkFMY0NBQ0hSQVFFQXVBSUFJZElCQVFDNEFnQWgwd0VCQUxnQ0FDSFVBUUVBdUFJQUlkVUJRQUQ0QWdBaEFnQUFBQThBSUJRQUFJZ0JBQ0FPbWdFQkFMY0NBQ0drQVFBQTl3TFJBU0txQVVBQXZnSUFJYXNCUUFDLUFnQWh5d0VCQUxjQ0FDSE1BUUVBdHdJQUljMEJBUUM0QWdBaHpnRVFBT2dDQUNIUEFRRUF0d0lBSWRFQkFRQzRBZ0FoMGdFQkFMZ0NBQ0hUQVFFQXVBSUFJZFFCQVFDNEFnQWgxUUZBQVBnQ0FDRUNBQUFBRFFBZ0ZBQUFpZ0VBSUFJQUFBQU5BQ0FVQUFDS0FRQWdBd0FBQUE4QUlCc0FBSU1CQUNBY0FBQ0lBUUFnQVFBQUFBOEFJQUVBQUFBTkFDQUxCQUFBdmdNQUlDRUFBTUVEQUNBaUFBREFBd0FnTXdBQXZ3TUFJRFFBQU1JREFDRE5BUUFBc1FJQUlORUJBQUN4QWdBZzBnRUFBTEVDQUNEVEFRQUFzUUlBSU5RQkFBQ3hBZ0FnMVFFQUFMRUNBQ0FSbHdFQUFJd0NBRENZQVFBQWtRRUFFSmtCQUFDTUFnQXdtZ0VCQU5vQkFDR2tBUUFBalFMUkFTS3FBVUFBNFFFQUlhc0JRQURoQVFBaHl3RUJBTm9CQUNITUFRRUEyZ0VBSWMwQkFRRGJBUUFoemdFUUFJSUNBQ0hQQVFFQTJnRUFJZEVCQVFEYkFRQWgwZ0VCQU5zQkFDSFRBUUVBMndFQUlkUUJBUURiQVFBaDFRRkFBSTRDQUNFREFBQUFEUUFnQVFBQWtBRUFNQ0FBQUpFQkFDQURBQUFBRFFBZ0FRQUFEZ0F3QWdBQUR3QWdBUUFBQUJRQUlBRUFBQUFVQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0F3QUFBQklBSUFFQUFCTUFNQUlBQUJRQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQUpCd0FBbVFNQUlBZ0FBTjBDQUNDYUFRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSEFBUUlBQUFBQnlBRUJBQUFBQWNrQkFRQUFBQUhLQVFFQUFBQUJBUlFBQUprQkFDQUhtZ0VCQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCd0FFQ0FBQUFBY2dCQVFBQUFBSEpBUUVBQUFBQnlnRUJBQUFBQVFFVUFBQ2JBUUF3QVJRQUFKc0JBREFKQndBQWx3TUFJQWdBQU5zQ0FDQ2FBUUVBdHdJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNIQUFRSUF2UUlBSWNnQkFRQzNBZ0FoeVFFQkFMY0NBQ0hLQVFFQXR3SUFJUUlBQUFBVUFDQVVBQUNlQVFBZ0I1b0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWNBQkFnQzlBZ0FoeUFFQkFMY0NBQ0hKQVFFQXR3SUFJY29CQVFDM0FnQWhBZ0FBQUJJQUlCUUFBS0FCQUNBQ0FBQUFFZ0FnRkFBQW9BRUFJQU1BQUFBVUFDQWJBQUNaQVFBZ0hBQUFuZ0VBSUFFQUFBQVVBQ0FCQUFBQUVnQWdCUVFBQUxrREFDQWhBQUM4QXdBZ0lnQUF1d01BSURNQUFMb0RBQ0EwQUFDOUF3QWdDcGNCQUFDTEFnQXdtQUVBQUtjQkFCQ1pBUUFBaXdJQU1Kb0JBUURhQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWNBQkFnRGdBUUFoeUFFQkFOb0JBQ0hKQVFFQTJnRUFJY29CQVFEYUFRQWhBd0FBQUJJQUlBRUFBS1lCQURBZ0FBQ25BUUFnQXdBQUFCSUFJQUVBQUJNQU1BSUFBQlFBSUFFQUFBQUZBQ0FCQUFBQUJRQWdBd0FBQUFNQUlBRUFBQVFBTUFJQUFBVUFJQU1BQUFBREFDQUJBQUFFQURBQ0FBQUZBQ0FEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnRXdVQUFLY0RBQ0FHQUFDNEF3QWdDd0FBcUFNQUlBd0FBS2tEQUNDYUFRRUFBQUFCcEFFQUFBRERBUUtvQVNBQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFHNkFRRUFBQUFCdXdFQkFBQUFBYndCQVFBQUFBRzlBUUVBQUFBQnZnRVFBQUFBQWI4QkFnQUFBQUhBQVFnQUFBQUJ3UUVBQUtZREFDRERBUUVBQUFBQnhBRUJBQUFBQVFFVUFBQ3ZBUUFnRDVvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNTUJBUUFBQUFIRUFRRUFBQUFCQVJRQUFMRUJBREFCRkFBQXNRRUFNQk1GQUFDTUF3QWdCZ0FBdHdNQUlBc0FBSTBEQUNBTUFBQ09Bd0FnbWdFQkFMY0NBQ0drQVFBQWlnUERBU0tvQVNBQXZBSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzZBUUVBdHdJQUlic0JBUUMzQWdBaHZBRUJBTGNDQUNHOUFRRUF0d0lBSWI0QkVBRG9BZ0FodndFQ0FMMENBQ0hBQVFnQWlBTUFJY0VCQUFDSkF3QWd3d0VCQUxjQ0FDSEVBUUVBdHdJQUlRSUFBQUFGQUNBVUFBQzBBUUFnRDVvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRUNBQUFBQXdBZ0ZBQUF0Z0VBSUFJQUFBQURBQ0FVQUFDMkFRQWdBd0FBQUFVQUlCc0FBSzhCQUNBY0FBQzBBUUFnQVFBQUFBVUFJQUVBQUFBREFDQUZCQUFBc2dNQUlDRUFBTFVEQUNBaUFBQzBBd0FnTXdBQXN3TUFJRFFBQUxZREFDQVNsd0VBQUlFQ0FEQ1lBUUFBdlFFQUVKa0JBQUNCQWdBd21nRUJBTm9CQUNHa0FRQUFoUUxEQVNLb0FTQUEzd0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0c2QVFFQTJnRUFJYnNCQVFEYUFRQWh2QUVCQU5vQkFDRzlBUUVBMmdFQUliNEJFQUNDQWdBaHZ3RUNBT0FCQUNIQUFRZ0Fnd0lBSWNFQkFBQ0VBZ0Fnd3dFQkFOb0JBQ0hFQVFFQTJnRUFJUU1BQUFBREFDQUJBQUM4QVFBd0lBQUF2UUVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBV0F3QUFfUUVBSUFzQUFQNEJBQ0FNQUFEX0FRQWdEUUFBZ0FJQUlKY0JBQUQwQVFBd21BRUFBTU1CQUJDWkFRQUE5QUVBTUpvQkFRQUFBQUdiQVFFQTlRRUFJWndCQVFBQUFBR2RBUUVBOWdFQUlaNEJBUUFBQUFHZkFRRUE5Z0VBSWFBQkFRRDJBUUFob2dFQUFQY0JvZ0VpcEFFQUFQZ0JwQUVpcGdFQUFQa0JwZ0VpcHdFZ0FQb0JBQ0dvQVNBQS1nRUFJYWtCQWdEN0FRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlRRUFBQURBQVFBZ0FRQUFBTUFCQUNBV0F3QUFfUUVBSUFzQUFQNEJBQ0FNQUFEX0FRQWdEUUFBZ0FJQUlKY0JBQUQwQVFBd21BRUFBTU1CQUJDWkFRQUE5QUVBTUpvQkFRRDFBUUFobXdFQkFQVUJBQ0djQVFFQTlRRUFJWjBCQVFEMkFRQWhuZ0VCQVBZQkFDR2ZBUUVBOWdFQUlhQUJBUUQyQVFBaG9nRUFBUGNCb2dFaXBBRUFBUGdCcEFFaXBnRUFBUGtCcGdFaXB3RWdBUG9CQUNHb0FTQUEtZ0VBSWFrQkFnRDdBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJUWdEQUFDdUF3QWdDd0FBcndNQUlBd0FBTEFEQUNBTkFBQ3hBd0FnblFFQUFMRUNBQ0NlQVFBQXNRSUFJSjhCQUFDeEFnQWdvQUVBQUxFQ0FDQURBQUFBd3dFQUlBRUFBTVFCQURBQ0FBREFBUUFnQXdBQUFNTUJBQ0FCQUFERUFRQXdBZ0FBd0FFQUlBTUFBQUREQVFBZ0FRQUF4QUVBTUFJQUFNQUJBQ0FUQXdBQXFnTUFJQXNBQUtzREFDQU1BQUNzQXdBZ0RRQUFyUU1BSUpvQkFRQUFBQUdiQVFFQUFBQUJuQUVCQUFBQUFaMEJBUUFBQUFHZUFRRUFBQUFCbndFQkFBQUFBYUFCQVFBQUFBR2lBUUFBQUtJQkFxUUJBQUFBcEFFQ3BnRUFBQUNtQVFLbkFTQUFBQUFCcUFFZ0FBQUFBYWtCQWdBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQVFFVUFBRElBUUFnRDVvQkFRQUFBQUdiQVFFQUFBQUJuQUVCQUFBQUFaMEJBUUFBQUFHZUFRRUFBQUFCbndFQkFBQUFBYUFCQVFBQUFBR2lBUUFBQUtJQkFxUUJBQUFBcEFFQ3BnRUFBQUNtQVFLbkFTQUFBQUFCcUFFZ0FBQUFBYWtCQWdBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQVFFVUFBREtBUUF3QVJRQUFNb0JBREFUQXdBQXZ3SUFJQXNBQU1BQ0FDQU1BQURCQWdBZ0RRQUF3Z0lBSUpvQkFRQzNBZ0FobXdFQkFMY0NBQ0djQVFFQXR3SUFJWjBCQVFDNEFnQWhuZ0VCQUxnQ0FDR2ZBUUVBdUFJQUlhQUJBUUM0QWdBaG9nRUFBTGtDb2dFaXBBRUFBTG9DcEFFaXBnRUFBTHNDcGdFaXB3RWdBTHdDQUNHb0FTQUF2QUlBSWFrQkFnQzlBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJUUlBQUFEQUFRQWdGQUFBelFFQUlBLWFBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHZEFRRUF1QUlBSVo0QkFRQzRBZ0FobndFQkFMZ0NBQ0dnQVFFQXVBSUFJYUlCQUFDNUFxSUJJcVFCQUFDNkFxUUJJcVlCQUFDN0FxWUJJcWNCSUFDOEFnQWhxQUVnQUx3Q0FDR3BBUUlBdlFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNFQ0FBQUF3d0VBSUJRQUFNOEJBQ0FDQUFBQXd3RUFJQlFBQU04QkFDQURBQUFBd0FFQUlCc0FBTWdCQUNBY0FBRE5BUUFnQVFBQUFNQUJBQ0FCQUFBQXd3RUFJQWtFQUFDeUFnQWdJUUFBdFFJQUlDSUFBTFFDQUNBekFBQ3pBZ0FnTkFBQXRnSUFJSjBCQUFDeEFnQWduZ0VBQUxFQ0FDQ2ZBUUFBc1FJQUlLQUJBQUN4QWdBZ0VwY0JBQURaQVFBd21BRUFBTllCQUJDWkFRQUEyUUVBTUpvQkFRRGFBUUFobXdFQkFOb0JBQ0djQVFFQTJnRUFJWjBCQVFEYkFRQWhuZ0VCQU5zQkFDR2ZBUUVBMndFQUlhQUJBUURiQVFBaG9nRUFBTndCb2dFaXBBRUFBTjBCcEFFaXBnRUFBTjRCcGdFaXB3RWdBTjhCQUNHb0FTQUEzd0VBSWFrQkFnRGdBUUFocWdGQUFPRUJBQ0dyQVVBQTRRRUFJUU1BQUFEREFRQWdBUUFBMVFFQU1DQUFBTllCQUNBREFBQUF3d0VBSUFFQUFNUUJBREFDQUFEQUFRQWdFcGNCQUFEWkFRQXdtQUVBQU5ZQkFCQ1pBUUFBMlFFQU1Kb0JBUURhQVFBaG13RUJBTm9CQUNHY0FRRUEyZ0VBSVowQkFRRGJBUUFobmdFQkFOc0JBQ0dmQVFFQTJ3RUFJYUFCQVFEYkFRQWhvZ0VBQU53Qm9nRWlwQUVBQU4wQnBBRWlwZ0VBQU40QnBnRWlwd0VnQU44QkFDR29BU0FBM3dFQUlha0JBZ0RnQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSVE0RUFBRGpBUUFnSVFBQTh3RUFJQ0lBQVBNQkFDQ3NBUUVBQUFBQnJRRUJBQUFBQks0QkFRQUFBQVN2QVFFQUFBQUJzQUVCQUFBQUFiRUJBUUFBQUFHeUFRRUFBQUFCc3dFQkFQSUJBQ0cwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFFT0JBQUE4QUVBSUNFQUFQRUJBQ0FpQUFEeEFRQWdyQUVCQUFBQUFhMEJBUUFBQUFXdUFRRUFBQUFGcndFQkFBQUFBYkFCQVFBQUFBR3hBUUVBQUFBQnNnRUJBQUFBQWJNQkFRRHZBUUFodEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQkJ3UUFBT01CQUNBaEFBRHVBUUFnSWdBQTdnRUFJS3dCQUFBQW9nRUNyUUVBQUFDaUFRaXVBUUFBQUtJQkNMTUJBQUR0QWFJQklnY0VBQURqQVFBZ0lRQUE3QUVBSUNJQUFPd0JBQ0NzQVFBQUFLUUJBcTBCQUFBQXBBRUlyZ0VBQUFDa0FRaXpBUUFBNndHa0FTSUhCQUFBNHdFQUlDRUFBT29CQUNBaUFBRHFBUUFnckFFQUFBQ21BUUt0QVFBQUFLWUJDSzRCQUFBQXBnRUlzd0VBQU9rQnBnRWlCUVFBQU9NQkFDQWhBQURvQVFBZ0lnQUE2QUVBSUt3QklBQUFBQUd6QVNBQTV3RUFJUTBFQUFEakFRQWdJUUFBNHdFQUlDSUFBT01CQUNBekFBRG1BUUFnTkFBQTR3RUFJS3dCQWdBQUFBR3RBUUlBQUFBRXJnRUNBQUFBQks4QkFnQUFBQUd3QVFJQUFBQUJzUUVDQUFBQUFiSUJBZ0FBQUFHekFRSUE1UUVBSVFzRUFBRGpBUUFnSVFBQTVBRUFJQ0lBQU9RQkFDQ3NBVUFBQUFBQnJRRkFBQUFBQks0QlFBQUFBQVN2QVVBQUFBQUJzQUZBQUFBQUFiRUJRQUFBQUFHeUFVQUFBQUFCc3dGQUFPSUJBQ0VMQkFBQTR3RUFJQ0VBQU9RQkFDQWlBQURrQVFBZ3JBRkFBQUFBQWEwQlFBQUFBQVN1QVVBQUFBQUVyd0ZBQUFBQUFiQUJRQUFBQUFHeEFVQUFBQUFCc2dGQUFBQUFBYk1CUUFEaUFRQWhDS3dCQWdBQUFBR3RBUUlBQUFBRXJnRUNBQUFBQks4QkFnQUFBQUd3QVFJQUFBQUJzUUVDQUFBQUFiSUJBZ0FBQUFHekFRSUE0d0VBSVFpc0FVQUFBQUFCclFGQUFBQUFCSzRCUUFBQUFBU3ZBVUFBQUFBQnNBRkFBQUFBQWJFQlFBQUFBQUd5QVVBQUFBQUJzd0ZBQU9RQkFDRU5CQUFBNHdFQUlDRUFBT01CQUNBaUFBRGpBUUFnTXdBQTVnRUFJRFFBQU9NQkFDQ3NBUUlBQUFBQnJRRUNBQUFBQks0QkFnQUFBQVN2QVFJQUFBQUJzQUVDQUFBQUFiRUJBZ0FBQUFHeUFRSUFBQUFCc3dFQ0FPVUJBQ0VJckFFSUFBQUFBYTBCQ0FBQUFBU3VBUWdBQUFBRXJ3RUlBQUFBQWJBQkNBQUFBQUd4QVFnQUFBQUJzZ0VJQUFBQUFiTUJDQURtQVFBaEJRUUFBT01CQUNBaEFBRG9BUUFnSWdBQTZBRUFJS3dCSUFBQUFBR3pBU0FBNXdFQUlRS3NBU0FBQUFBQnN3RWdBT2dCQUNFSEJBQUE0d0VBSUNFQUFPb0JBQ0FpQUFEcUFRQWdyQUVBQUFDbUFRS3RBUUFBQUtZQkNLNEJBQUFBcGdFSXN3RUFBT2tCcGdFaUJLd0JBQUFBcGdFQ3JRRUFBQUNtQVFpdUFRQUFBS1lCQ0xNQkFBRHFBYVlCSWdjRUFBRGpBUUFnSVFBQTdBRUFJQ0lBQU93QkFDQ3NBUUFBQUtRQkFxMEJBQUFBcEFFSXJnRUFBQUNrQVFpekFRQUE2d0drQVNJRXJBRUFBQUNrQVFLdEFRQUFBS1FCQ0s0QkFBQUFwQUVJc3dFQUFPd0JwQUVpQndRQUFPTUJBQ0FoQUFEdUFRQWdJZ0FBN2dFQUlLd0JBQUFBb2dFQ3JRRUFBQUNpQVFpdUFRQUFBS0lCQ0xNQkFBRHRBYUlCSWdTc0FRQUFBS0lCQXEwQkFBQUFvZ0VJcmdFQUFBQ2lBUWl6QVFBQTdnR2lBU0lPQkFBQThBRUFJQ0VBQVBFQkFDQWlBQUR4QVFBZ3JBRUJBQUFBQWEwQkFRQUFBQVd1QVFFQUFBQUZyd0VCQUFBQUFiQUJBUUFBQUFHeEFRRUFBQUFCc2dFQkFBQUFBYk1CQVFEdkFRQWh0QUVCQUFBQUFiVUJBUUFBQUFHMkFRRUFBQUFCQ0t3QkFnQUFBQUd0QVFJQUFBQUZyZ0VDQUFBQUJhOEJBZ0FBQUFHd0FRSUFBQUFCc1FFQ0FBQUFBYklCQWdBQUFBR3pBUUlBOEFFQUlRdXNBUUVBQUFBQnJRRUJBQUFBQmE0QkFRQUFBQVd2QVFFQUFBQUJzQUVCQUFBQUFiRUJBUUFBQUFHeUFRRUFBQUFCc3dFQkFQRUJBQ0cwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFFT0JBQUE0d0VBSUNFQUFQTUJBQ0FpQUFEekFRQWdyQUVCQUFBQUFhMEJBUUFBQUFTdUFRRUFBQUFFcndFQkFBQUFBYkFCQVFBQUFBR3hBUUVBQUFBQnNnRUJBQUFBQWJNQkFRRHlBUUFodEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQkM2d0JBUUFBQUFHdEFRRUFBQUFFcmdFQkFBQUFCSzhCQVFBQUFBR3dBUUVBQUFBQnNRRUJBQUFBQWJJQkFRQUFBQUd6QVFFQTh3RUFJYlFCQVFBQUFBRzFBUUVBQUFBQnRnRUJBQUFBQVJZREFBRDlBUUFnQ3dBQV9nRUFJQXdBQVA4QkFDQU5BQUNBQWdBZ2x3RUFBUFFCQURDWUFRQUF3d0VBRUprQkFBRDBBUUF3bWdFQkFQVUJBQ0diQVFFQTlRRUFJWndCQVFEMUFRQWhuUUVCQVBZQkFDR2VBUUVBOWdFQUlaOEJBUUQyQVFBaG9BRUJBUFlCQUNHaUFRQUE5d0dpQVNLa0FRQUEtQUdrQVNLbUFRQUEtUUdtQVNLbkFTQUEtZ0VBSWFnQklBRDZBUUFocVFFQ0FQc0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWhDNndCQVFBQUFBR3RBUUVBQUFBRXJnRUJBQUFBQks4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4d0VBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRdXNBUUVBQUFBQnJRRUJBQUFBQmE0QkFRQUFBQVd2QVFFQUFBQUJzQUVCQUFBQUFiRUJBUUFBQUFHeUFRRUFBQUFCc3dFQkFQRUJBQ0cwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFFRXJBRUFBQUNpQVFLdEFRQUFBS0lCQ0s0QkFBQUFvZ0VJc3dFQUFPNEJvZ0VpQkt3QkFBQUFwQUVDclFFQUFBQ2tBUWl1QVFBQUFLUUJDTE1CQUFEc0FhUUJJZ1NzQVFBQUFLWUJBcTBCQUFBQXBnRUlyZ0VBQUFDbUFRaXpBUUFBNmdHbUFTSUNyQUVnQUFBQUFiTUJJQURvQVFBaENLd0JBZ0FBQUFHdEFRSUFBQUFFcmdFQ0FBQUFCSzhCQWdBQUFBR3dBUUlBQUFBQnNRRUNBQUFBQWJJQkFnQUFBQUd6QVFJQTR3RUFJUWlzQVVBQUFBQUJyUUZBQUFBQUJLNEJRQUFBQUFTdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBT1FCQUNFRHR3RUFBQU1BSUxnQkFBQURBQ0M1QVFBQUF3QWdBN2NCQUFBSkFDQzRBUUFBQ1FBZ3VRRUFBQWtBSUFPM0FRQUFFZ0FndUFFQUFCSUFJTGtCQUFBU0FDQUR0d0VBQUJvQUlMZ0JBQUFhQUNDNUFRQUFHZ0FnRXBjQkFBQ0JBZ0F3bUFFQUFMMEJBQkNaQVFBQWdRSUFNSm9CQVFEYUFRQWhwQUVBQUlVQ3d3RWlxQUVnQU44QkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHVnRUJBTm9CQUNHN0FRRUEyZ0VBSWJ3QkFRRGFBUUFodlFFQkFOb0JBQ0ctQVJBQWdnSUFJYjhCQWdEZ0FRQWh3QUVJQUlNQ0FDSEJBUUFBaEFJQUlNTUJBUURhQVFBaHhBRUJBTm9CQUNFTkJBQUE0d0VBSUNFQUFJb0NBQ0FpQUFDS0FnQWdNd0FBaWdJQUlEUUFBSW9DQUNDc0FSQUFBQUFCclFFUUFBQUFCSzRCRUFBQUFBU3ZBUkFBQUFBQnNBRVFBQUFBQWJFQkVBQUFBQUd5QVJBQUFBQUJzd0VRQUlrQ0FDRU5CQUFBNHdFQUlDRUFBT1lCQUNBaUFBRG1BUUFnTXdBQTVnRUFJRFFBQU9ZQkFDQ3NBUWdBQUFBQnJRRUlBQUFBQks0QkNBQUFBQVN2QVFnQUFBQUJzQUVJQUFBQUFiRUJDQUFBQUFHeUFRZ0FBQUFCc3dFSUFJZ0NBQ0VFckFFQkFBQUFCY1VCQVFBQUFBSEdBUUVBQUFBRXh3RUJBQUFBQkFjRUFBRGpBUUFnSVFBQWh3SUFJQ0lBQUljQ0FDQ3NBUUFBQU1NQkFxMEJBQUFBd3dFSXJnRUFBQUREQVFpekFRQUFoZ0xEQVNJSEJBQUE0d0VBSUNFQUFJY0NBQ0FpQUFDSEFnQWdyQUVBQUFEREFRS3RBUUFBQU1NQkNLNEJBQUFBd3dFSXN3RUFBSVlDd3dFaUJLd0JBQUFBd3dFQ3JRRUFBQUREQVFpdUFRQUFBTU1CQ0xNQkFBQ0hBc01CSWcwRUFBRGpBUUFnSVFBQTVnRUFJQ0lBQU9ZQkFDQXpBQURtQVFBZ05BQUE1Z0VBSUt3QkNBQUFBQUd0QVFnQUFBQUVyZ0VJQUFBQUJLOEJDQUFBQUFHd0FRZ0FBQUFCc1FFSUFBQUFBYklCQ0FBQUFBR3pBUWdBaUFJQUlRMEVBQURqQVFBZ0lRQUFpZ0lBSUNJQUFJb0NBQ0F6QUFDS0FnQWdOQUFBaWdJQUlLd0JFQUFBQUFHdEFSQUFBQUFFcmdFUUFBQUFCSzhCRUFBQUFBR3dBUkFBQUFBQnNRRVFBQUFBQWJJQkVBQUFBQUd6QVJBQWlRSUFJUWlzQVJBQUFBQUJyUUVRQUFBQUJLNEJFQUFBQUFTdkFSQUFBQUFCc0FFUUFBQUFBYkVCRUFBQUFBR3lBUkFBQUFBQnN3RVFBSW9DQUNFS2x3RUFBSXNDQURDWUFRQUFwd0VBRUprQkFBQ0xBZ0F3bWdFQkFOb0JBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh3QUVDQU9BQkFDSElBUUVBMmdFQUlja0JBUURhQVFBaHlnRUJBTm9CQUNFUmx3RUFBSXdDQURDWUFRQUFrUUVBRUprQkFBQ01BZ0F3bWdFQkFOb0JBQ0drQVFBQWpRTFJBU0txQVVBQTRRRUFJYXNCUUFEaEFRQWh5d0VCQU5vQkFDSE1BUUVBMmdFQUljMEJBUURiQVFBaHpnRVFBSUlDQUNIUEFRRUEyZ0VBSWRFQkFRRGJBUUFoMGdFQkFOc0JBQ0hUQVFFQTJ3RUFJZFFCQVFEYkFRQWgxUUZBQUk0Q0FDRUhCQUFBNHdFQUlDRUFBSklDQUNBaUFBQ1NBZ0FnckFFQUFBRFJBUUt0QVFBQUFORUJDSzRCQUFBQTBRRUlzd0VBQUpFQzBRRWlDd1FBQVBBQkFDQWhBQUNRQWdBZ0lnQUFrQUlBSUt3QlFBQUFBQUd0QVVBQUFBQUZyZ0ZBQUFBQUJhOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBandJQUlRc0VBQUR3QVFBZ0lRQUFrQUlBSUNJQUFKQUNBQ0NzQVVBQUFBQUJyUUZBQUFBQUJhNEJRQUFBQUFXdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBSThDQUNFSXJBRkFBQUFBQWEwQlFBQUFBQVd1QVVBQUFBQUZyd0ZBQUFBQUFiQUJRQUFBQUFHeEFVQUFBQUFCc2dGQUFBQUFBYk1CUUFDUUFnQWhCd1FBQU9NQkFDQWhBQUNTQWdBZ0lnQUFrZ0lBSUt3QkFBQUEwUUVDclFFQUFBRFJBUWl1QVFBQUFORUJDTE1CQUFDUkF0RUJJZ1NzQVFBQUFORUJBcTBCQUFBQTBRRUlyZ0VBQUFEUkFRaXpBUUFBa2dMUkFTSUxsd0VBQUpNQ0FEQ1lBUUFBZXdBUW1RRUFBSk1DQURDYUFRRUEyZ0VBSVpzQkFRRGFBUUFobkFFQkFOb0JBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWgxZ0VCQU5vQkFDSFhBUUVBMmdFQUlkZ0JJQURmQVFBaEM1Y0JBQUNVQWdBd21BRUFBR2dBRUprQkFBQ1VBZ0F3bWdFQkFQVUJBQ0diQVFFQTlRRUFJWndCQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlkWUJBUUQxQVFBaDF3RUJBUFVCQUNIWUFTQUEtZ0VBSVFpWEFRQUFsUUlBTUpnQkFBQmlBQkNaQVFBQWxRSUFNSm9CQVFEYUFRQWhtd0VCQU5vQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHV3RUJBTm9CQUNFSkF3QUFfUUVBSUpjQkFBQ1dBZ0F3bUFFQUFFOEFFSmtCQUFDV0FnQXdtZ0VCQVBVQkFDR2JBUUVBOVFFQUlhb0JRQUQ4QVFBaHF3RkFBUHdCQUNHN0FRRUE5UUVBSVF5WEFRQUFsd0lBTUpnQkFBQkpBQkNaQVFBQWx3SUFNSm9CQVFEYUFRQWhwQUVBQUpnQzNRRWlxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlja0JBUURhQVFBaHlnRUJBTm9CQUNIWkFVQUE0UUVBSWRvQkFnRGdBUUFoMndFUUFJSUNBQ0VIQkFBQTR3RUFJQ0VBQUpvQ0FDQWlBQUNhQWdBZ3JBRUFBQURkQVFLdEFRQUFBTjBCQ0s0QkFBQUEzUUVJc3dFQUFKa0MzUUVpQndRQUFPTUJBQ0FoQUFDYUFnQWdJZ0FBbWdJQUlLd0JBQUFBM1FFQ3JRRUFBQURkQVFpdUFRQUFBTjBCQ0xNQkFBQ1pBdDBCSWdTc0FRQUFBTjBCQXEwQkFBQUEzUUVJcmdFQUFBRGRBUWl6QVFBQW1nTGRBU0lPbHdFQUFKc0NBRENZQVFBQU13QVFtUUVBQUpzQ0FEQ2FBUUVBMmdFQUlhUUJBQUNjQXVFQklxZ0JJQURmQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWJvQkFRRGFBUUFodXdFQkFOb0JBQ0hkQVFFQTJnRUFJZDRCQVFEYUFRQWgzd0VCQU5vQkFDSGhBUUVBMmdFQUlRY0VBQURqQVFBZ0lRQUFuZ0lBSUNJQUFKNENBQ0NzQVFBQUFPRUJBcTBCQUFBQTRRRUlyZ0VBQUFEaEFRaXpBUUFBblFMaEFTSUhCQUFBNHdFQUlDRUFBSjRDQUNBaUFBQ2VBZ0FnckFFQUFBRGhBUUt0QVFBQUFPRUJDSzRCQUFBQTRRRUlzd0VBQUowQzRRRWlCS3dCQUFBQTRRRUNyUUVBQUFEaEFRaXVBUUFBQU9FQkNMTUJBQUNlQXVFQklnOE9BQUNoQWdBZ2x3RUFBSjhDQURDWUFRQUFHZ0FRbVFFQUFKOENBRENhQVFFQTlRRUFJYVFCQUFDZ0F1RUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNIZEFRRUE5UUVBSWQ0QkFRRDFBUUFoM3dFQkFQVUJBQ0hoQVFFQTlRRUFJUVNzQVFBQUFPRUJBcTBCQUFBQTRRRUlyZ0VBQUFEaEFRaXpBUUFBbmdMaEFTSVlBd0FBX1FFQUlBc0FBUDRCQUNBTUFBRF9BUUFnRFFBQWdBSUFJSmNCQUFEMEFRQXdtQUVBQU1NQkFCQ1pBUUFBOUFFQU1Kb0JBUUQxQVFBaG13RUJBUFVCQUNHY0FRRUE5UUVBSVowQkFRRDJBUUFobmdFQkFQWUJBQ0dmQVFFQTlnRUFJYUFCQVFEMkFRQWhvZ0VBQVBjQm9nRWlwQUVBQVBnQnBBRWlwZ0VBQVBrQnBnRWlwd0VnQVBvQkFDR29BU0FBLWdFQUlha0JBZ0Q3QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWVNQkFBRERBUUFnNUFFQUFNTUJBQ0FDeVFFQkFBQUFBY29CQVFBQUFBRU1Cd0FBb1FJQUlBZ0FBS1FDQUNDWEFRQUFvd0lBTUpnQkFBQVNBQkNaQVFBQW93SUFNSm9CQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljQUJBZ0Q3QVFBaHlBRUJBUFVCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoR0FVQUFMQUNBQ0FHQUFDaEFnQWdDd0FBX2dFQUlBd0FBUDhCQUNDWEFRQUFyUUlBTUpnQkFBQURBQkNaQVFBQXJRSUFNSm9CQVFEMUFRQWhwQUVBQUs4Q3d3RWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWJ3QkFRRDFBUUFodlFFQkFQVUJBQ0ctQVJBQXBnSUFJYjhCQWdEN0FRQWh3QUVJQUs0Q0FDSEJBUUFBaEFJQUlNTUJBUUQxQVFBaHhBRUJBUFVCQUNIakFRQUFBd0FnNUFFQUFBTUFJQklKQUFDcEFnQWdsd0VBQUtVQ0FEQ1lBUUFBRFFBUW1RRUFBS1VDQURDYUFRRUE5UUVBSWFRQkFBQ25BdEVCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hMQVFFQTlRRUFJY3dCQVFEMUFRQWh6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJUWlzQVJBQUFBQUJyUUVRQUFBQUJLNEJFQUFBQUFTdkFSQUFBQUFCc0FFUUFBQUFBYkVCRUFBQUFBR3lBUkFBQUFBQnN3RVFBSW9DQUNFRXJBRUFBQURSQVFLdEFRQUFBTkVCQ0s0QkFBQUEwUUVJc3dFQUFKSUMwUUVpQ0t3QlFBQUFBQUd0QVVBQUFBQUZyZ0ZBQUFBQUJhOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBa0FJQUlSRUhBQUNoQWdBZ0NBQUFwQUlBSUFvQUFLd0NBQ0NYQVFBQXFnSUFNSmdCQUFBSkFCQ1pBUUFBcWdJQU1Kb0JBUUQxQVFBaHBBRUFBS3NDM1FFaXFnRkFBUHdCQUNHckFVQUFfQUVBSWNrQkFRRDFBUUFoeWdFQkFQVUJBQ0haQVVBQV9BRUFJZG9CQWdEN0FRQWgyd0VRQUtZQ0FDSGpBUUFBQ1FBZzVBRUFBQWtBSUE4SEFBQ2hBZ0FnQ0FBQXBBSUFJQW9BQUt3Q0FDQ1hBUUFBcWdJQU1KZ0JBQUFKQUJDWkFRQUFxZ0lBTUpvQkFRRDFBUUFocEFFQUFLc0MzUUVpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSFpBVUFBX0FFQUlkb0JBZ0Q3QVFBaDJ3RVFBS1lDQUNFRXJBRUFBQURkQVFLdEFRQUFBTjBCQ0s0QkFBQUEzUUVJc3dFQUFKb0MzUUVpQTdjQkFBQU5BQ0M0QVFBQURRQWd1UUVBQUEwQUlCWUZBQUN3QWdBZ0JnQUFvUUlBSUFzQUFQNEJBQ0FNQUFEX0FRQWdsd0VBQUswQ0FEQ1lBUUFBQXdBUW1RRUFBSzBDQURDYUFRRUE5UUVBSWFRQkFBQ3ZBc01CSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQVBVQkFDRzhBUUVBOVFFQUliMEJBUUQxQVFBaHZnRVFBS1lDQUNHX0FRSUEtd0VBSWNBQkNBQ3VBZ0Fod1FFQUFJUUNBQ0REQVFFQTlRRUFJY1FCQVFEMUFRQWhDS3dCQ0FBQUFBR3RBUWdBQUFBRXJnRUlBQUFBQks4QkNBQUFBQUd3QVFnQUFBQUJzUUVJQUFBQUFiSUJDQUFBQUFHekFRZ0E1Z0VBSVFTc0FRQUFBTU1CQXEwQkFBQUF3d0VJcmdFQUFBRERBUWl6QVFBQWh3TERBU0lMQXdBQV9RRUFJSmNCQUFDV0FnQXdtQUVBQUU4QUVKa0JBQUNXQWdBd21nRUJBUFVCQUNHYkFRRUE5UUVBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0c3QVFFQTlRRUFJZU1CQUFCUEFDRGtBUUFBVHdBZ0FBQUFBQUFBQWVnQkFRQUFBQUVCNkFFQkFBQUFBUUhvQVFBQUFLSUJBZ0hvQVFBQUFLUUJBZ0hvQVFBQUFLWUJBZ0hvQVNBQUFBQUJCZWdCQWdBQUFBSHZBUUlBQUFBQjhBRUNBQUFBQWZFQkFnQUFBQUh5QVFJQUFBQUJBZWdCUUFBQUFBRUxHd0FBX2dJQU1Cd0FBSU1EQUREbEFRQUFfd0lBTU9ZQkFBQ0FBd0F3NXdFQUFJRURBQ0RvQVFBQWdnTUFNT2tCQUFDQ0F3QXc2Z0VBQUlJREFERHJBUUFBZ2dNQU1Pd0JBQUNFQXdBdzdRRUFBSVVEQURBTEd3QUEzZ0lBTUJ3QUFPTUNBRERsQVFBQTN3SUFNT1lCQUFEZ0FnQXc1d0VBQU9FQ0FDRG9BUUFBNGdJQU1Pa0JBQURpQWdBdzZnRUFBT0lDQUREckFRQUE0Z0lBTU93QkFBRGtBZ0F3N1FFQUFPVUNBREFMR3dBQTBBSUFNQndBQU5VQ0FERGxBUUFBMFFJQU1PWUJBQURTQWdBdzV3RUFBTk1DQUNEb0FRQUExQUlBTU9rQkFBRFVBZ0F3NmdFQUFOUUNBRERyQVFBQTFBSUFNT3dCQUFEV0FnQXc3UUVBQU5jQ0FEQUxHd0FBd3dJQU1Cd0FBTWdDQUREbEFRQUF4QUlBTU9ZQkFBREZBZ0F3NXdFQUFNWUNBQ0RvQVFBQXh3SUFNT2tCQUFESEFnQXc2Z0VBQU1jQ0FERHJBUUFBeHdJQU1Pd0JBQURKQWdBdzdRRUFBTW9DQURBS21nRUJBQUFBQWFRQkFBQUE0UUVDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhkQVFFQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFFQ0FBQUFBUUFnR3dBQXp3SUFJQU1BQUFBQkFDQWJBQURQQWdBZ0hBQUF6Z0lBSUFFVUFBQ1VCQUF3RHc0QUFLRUNBQ0NYQVFBQW53SUFNSmdCQUFBYUFCQ1pBUUFBbndJQU1Kb0JBUUFBQUFHa0FRQUFvQUxoQVNLb0FTQUEtZ0VBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0c2QVFFQTlRRUFJYnNCQVFBQUFBSGRBUUVBOVFFQUlkNEJBUUQxQVFBaDN3RUJBUFVCQUNIaEFRRUE5UUVBSVFJQUFBQUJBQ0FVQUFET0FnQWdBZ0FBQU1zQ0FDQVVBQURNQWdBZ0RwY0JBQURLQWdBd21BRUFBTXNDQUJDWkFRQUF5Z0lBTUpvQkFRRDFBUUFocEFFQUFLQUM0UUVpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBOVFFQUlkMEJBUUQxQVFBaDNnRUJBUFVCQUNIZkFRRUE5UUVBSWVFQkFRRDFBUUFoRHBjQkFBREtBZ0F3bUFFQUFNc0NBQkNaQVFBQXlnSUFNSm9CQVFEMUFRQWhwQUVBQUtBQzRRRWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWQwQkFRRDFBUUFoM2dFQkFQVUJBQ0hmQVFFQTlRRUFJZUVCQVFEMUFRQWhDcG9CQVFDM0FnQWhwQUVBQU0wQzRRRWlxQUVnQUx3Q0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHVnRUJBTGNDQUNHN0FRRUF0d0lBSWQwQkFRQzNBZ0FoM2dFQkFMY0NBQ0hmQVFFQXR3SUFJUUhvQVFBQUFPRUJBZ3FhQVFFQXR3SUFJYVFCQUFETkF1RUJJcWdCSUFDOEFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlib0JBUUMzQWdBaHV3RUJBTGNDQUNIZEFRRUF0d0lBSWQ0QkFRQzNBZ0FoM3dFQkFMY0NBQ0VLbWdFQkFBQUFBYVFCQUFBQTRRRUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBSGRBUUVBQUFBQjNnRUJBQUFBQWQ4QkFRQUFBQUVIQ0FBQTNRSUFJSm9CQVFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWNBQkFnQUFBQUhJQVFFQUFBQUJ5Z0VCQUFBQUFRSUFBQUFVQUNBYkFBRGNBZ0FnQXdBQUFCUUFJQnNBQU53Q0FDQWNBQURhQWdBZ0FSUUFBSk1FQURBTkJ3QUFvUUlBSUFnQUFLUUNBQ0NYQVFBQW93SUFNSmdCQUFBU0FCQ1pBUUFBb3dJQU1Kb0JBUUFBQUFHcUFVQUFfQUVBSWFzQlFBRDhBUUFod0FFQ0FQc0JBQ0hJQVFFQTlRRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGlBUUFBb2dJQUlBSUFBQUFVQUNBVUFBRGFBZ0FnQWdBQUFOZ0NBQ0FVQUFEWkFnQWdDcGNCQUFEWEFnQXdtQUVBQU5nQ0FCQ1pBUUFBMXdJQU1Kb0JBUUQxQVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWNBQkFnRDdBUUFoeUFFQkFQVUJBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWhDcGNCQUFEWEFnQXdtQUVBQU5nQ0FCQ1pBUUFBMXdJQU1Kb0JBUUQxQVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWNBQkFnRDdBUUFoeUFFQkFQVUJBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWhCcG9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNIS0FRRUF0d0lBSVFjSUFBRGJBZ0FnbWdFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh3QUVDQUwwQ0FDSElBUUVBdHdJQUljb0JBUUMzQWdBaEJSc0FBSTRFQUNBY0FBQ1JCQUFnNVFFQUFJOEVBQ0RtQVFBQWtBUUFJT3NCQUFBRkFDQUhDQUFBM1FJQUlKb0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBY0FCQWdBQUFBSElBUUVBQUFBQnlnRUJBQUFBQVFNYkFBQ09CQUFnNVFFQUFJOEVBQ0RyQVFBQUJRQWdDZ2dBQVB3Q0FDQUtBQUQ5QWdBZ21nRUJBQUFBQWFRQkFBQUEzUUVDcWdGQUFBQUFBYXNCUUFBQUFBSEtBUUVBQUFBQjJRRkFBQUFBQWRvQkFnQUFBQUhiQVJBQUFBQUJBZ0FBQUFzQUlCc0FBUHNDQUNBREFBQUFDd0FnR3dBQS13SUFJQndBQU9vQ0FDQUJGQUFBalFRQU1BOEhBQUNoQWdBZ0NBQUFwQUlBSUFvQUFLd0NBQ0NYQVFBQXFnSUFNSmdCQUFBSkFCQ1pBUUFBcWdJQU1Kb0JBUUFBQUFHa0FRQUFxd0xkQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeVFFQkFQVUJBQ0hLQVFFQTlRRUFJZGtCUUFEOEFRQWgyZ0VDQVBzQkFDSGJBUkFBcGdJQUlRSUFBQUFMQUNBVUFBRHFBZ0FnQWdBQUFPWUNBQ0FVQUFEbkFnQWdESmNCQUFEbEFnQXdtQUVBQU9ZQ0FCQ1pBUUFBNVFJQU1Kb0JBUUQxQVFBaHBBRUFBS3NDM1FFaXFnRkFBUHdCQUNHckFVQUFfQUVBSWNrQkFRRDFBUUFoeWdFQkFQVUJBQ0haQVVBQV9BRUFJZG9CQWdEN0FRQWgyd0VRQUtZQ0FDRU1sd0VBQU9VQ0FEQ1lBUUFBNWdJQUVKa0JBQURsQWdBd21nRUJBUFVCQUNHa0FRQUFxd0xkQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeVFFQkFQVUJBQ0hLQVFFQTlRRUFJZGtCUUFEOEFRQWgyZ0VDQVBzQkFDSGJBUkFBcGdJQUlRaWFBUUVBdHdJQUlhUUJBQURwQXQwQklxb0JRQUMtQWdBaHF3RkFBTDRDQUNIS0FRRUF0d0lBSWRrQlFBQy1BZ0FoMmdFQ0FMMENBQ0hiQVJBQTZBSUFJUVhvQVJBQUFBQUI3d0VRQUFBQUFmQUJFQUFBQUFIeEFSQUFBQUFCOGdFUUFBQUFBUUhvQVFBQUFOMEJBZ29JQUFEckFnQWdDZ0FBN0FJQUlKb0JBUUMzQWdBaHBBRUFBT2tDM1FFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWNvQkFRQzNBZ0FoMlFGQUFMNENBQ0hhQVFJQXZRSUFJZHNCRUFEb0FnQWhCUnNBQUljRUFDQWNBQUNMQkFBZzVRRUFBSWdFQUNEbUFRQUFpZ1FBSU9zQkFBQUZBQ0FMR3dBQTdRSUFNQndBQVBJQ0FERGxBUUFBN2dJQU1PWUJBQUR2QWdBdzV3RUFBUEFDQUNEb0FRQUE4UUlBTU9rQkFBRHhBZ0F3NmdFQUFQRUNBRERyQVFBQThRSUFNT3dCQUFEekFnQXc3UUVBQVBRQ0FEQU5tZ0VCQUFBQUFhUUJBQUFBMFFFQ3FnRkFBQUFBQWFzQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFjNEJFQUFBQUFIUEFRRUFBQUFCMFFFQkFBQUFBZElCQVFBQUFBSFRBUUVBQUFBQjFBRUJBQUFBQWRVQlFBQUFBQUVDQUFBQUR3QWdHd0FBLWdJQUlBTUFBQUFQQUNBYkFBRDZBZ0FnSEFBQS1RSUFJQUVVQUFDSkJBQXdFZ2tBQUtrQ0FDQ1hBUUFBcFFJQU1KZ0JBQUFOQUJDWkFRQUFwUUlBTUpvQkFRQUFBQUdrQVFBQXB3TFJBU0txQVVBQV9BRUFJYXNCUUFEOEFRQWh5d0VCQVBVQkFDSE1BUUVBQUFBQnpRRUJBUFlCQUNIT0FSQUFwZ0lBSWM4QkFRRDFBUUFoMFFFQkFQWUJBQ0hTQVFFQTlnRUFJZE1CQVFEMkFRQWgxQUVCQVBZQkFDSFZBVUFBcUFJQUlRSUFBQUFQQUNBVUFBRDVBZ0FnQWdBQUFQVUNBQ0FVQUFEMkFnQWdFWmNCQUFEMEFnQXdtQUVBQVBVQ0FCQ1pBUUFBOUFJQU1Kb0JBUUQxQVFBaHBBRUFBS2NDMFFFaXFnRkFBUHdCQUNHckFVQUFfQUVBSWNzQkFRRDFBUUFoekFFQkFQVUJBQ0hOQVFFQTlnRUFJYzRCRUFDbUFnQWh6d0VCQVBVQkFDSFJBUUVBOWdFQUlkSUJBUUQyQVFBaDB3RUJBUFlCQUNIVUFRRUE5Z0VBSWRVQlFBQ29BZ0FoRVpjQkFBRDBBZ0F3bUFFQUFQVUNBQkNaQVFBQTlBSUFNSm9CQVFEMUFRQWhwQUVBQUtjQzBRRWlxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljc0JBUUQxQVFBaHpBRUJBUFVCQUNITkFRRUE5Z0VBSWM0QkVBQ21BZ0FoendFQkFQVUJBQ0hSQVFFQTlnRUFJZElCQVFEMkFRQWgwd0VCQVBZQkFDSFVBUUVBOWdFQUlkVUJRQUNvQWdBaERab0JBUUMzQWdBaHBBRUFBUGNDMFFFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWN3QkFRQzNBZ0FoelFFQkFMZ0NBQ0hPQVJBQTZBSUFJYzhCQVFDM0FnQWgwUUVCQUxnQ0FDSFNBUUVBdUFJQUlkTUJBUUM0QWdBaDFBRUJBTGdDQUNIVkFVQUEtQUlBSVFIb0FRQUFBTkVCQWdIb0FVQUFBQUFCRFpvQkFRQzNBZ0FocEFFQUFQY0MwUUVpcWdGQUFMNENBQ0dyQVVBQXZnSUFJY3dCQVFDM0FnQWh6UUVCQUxnQ0FDSE9BUkFBNkFJQUljOEJBUUMzQWdBaDBRRUJBTGdDQUNIU0FRRUF1QUlBSWRNQkFRQzRBZ0FoMUFFQkFMZ0NBQ0hWQVVBQS1BSUFJUTJhQVFFQUFBQUJwQUVBQUFEUkFRS3FBVUFBQUFBQnF3RkFBQUFBQWN3QkFRQUFBQUhOQVFFQUFBQUJ6Z0VRQUFBQUFjOEJBUUFBQUFIUkFRRUFBQUFCMGdFQkFBQUFBZE1CQVFBQUFBSFVBUUVBQUFBQjFRRkFBQUFBQVFvSUFBRDhBZ0FnQ2dBQV9RSUFJSm9CQVFBQUFBR2tBUUFBQU4wQkFxb0JRQUFBQUFHckFVQUFBQUFCeWdFQkFBQUFBZGtCUUFBQUFBSGFBUUlBQUFBQjJ3RVFBQUFBQVFNYkFBQ0hCQUFnNVFFQUFJZ0VBQ0RyQVFBQUJRQWdCQnNBQU8wQ0FERGxBUUFBN2dJQU1PY0JBQUR3QWdBZzZ3RUFBUEVDQURBUkJRQUFwd01BSUFzQUFLZ0RBQ0FNQUFDcEF3QWdtZ0VCQUFBQUFhUUJBQUFBd3dFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCRUFBQUFBR19BUUlBQUFBQndBRUlBQUFBQWNFQkFBQ21Bd0Fnd3dFQkFBQUFBUUlBQUFBRkFDQWJBQUNsQXdBZ0F3QUFBQVVBSUJzQUFLVURBQ0FjQUFDTEF3QWdBUlFBQUlZRUFEQVdCUUFBc0FJQUlBWUFBS0VDQUNBTEFBRC1BUUFnREFBQV93RUFJSmNCQUFDdEFnQXdtQUVBQUFNQUVKa0JBQUN0QWdBd21nRUJBQUFBQWFRQkFBQ3ZBc01CSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQUFBQUFid0JBUUQxQVFBaHZRRUJBUFVCQUNHLUFSQUFwZ0lBSWI4QkFnRDdBUUFod0FFSUFLNENBQ0hCQVFBQWhBSUFJTU1CQVFEMUFRQWh4QUVCQVBVQkFDRUNBQUFBQlFBZ0ZBQUFpd01BSUFJQUFBQ0dBd0FnRkFBQWh3TUFJQktYQVFBQWhRTUFNSmdCQUFDR0F3QVFtUUVBQUlVREFEQ2FBUUVBOVFFQUlhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0c4QVFFQTlRRUFJYjBCQVFEMUFRQWh2Z0VRQUtZQ0FDR19BUUlBLXdFQUljQUJDQUN1QWdBaHdRRUFBSVFDQUNEREFRRUE5UUVBSWNRQkFRRDFBUUFoRXBjQkFBQ0ZBd0F3bUFFQUFJWURBQkNaQVFBQWhRTUFNSm9CQVFEMUFRQWhwQUVBQUs4Q3d3RWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWJ3QkFRRDFBUUFodlFFQkFQVUJBQ0ctQVJBQXBnSUFJYjhCQWdEN0FRQWh3QUVJQUs0Q0FDSEJBUUFBaEFJQUlNTUJBUUQxQVFBaHhBRUJBUFVCQUNFT21nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0Fnd3dFQkFMY0NBQ0VGNkFFSUFBQUFBZThCQ0FBQUFBSHdBUWdBQUFBQjhRRUlBQUFBQWZJQkNBQUFBQUVDNkFFQkFBQUFCTzRCQVFBQUFBVUI2QUVBQUFEREFRSVJCUUFBakFNQUlBc0FBSTBEQUNBTUFBQ09Bd0FnbWdFQkFMY0NBQ0drQVFBQWlnUERBU0tvQVNBQXZBSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzZBUUVBdHdJQUlic0JBUUMzQWdBaHZBRUJBTGNDQUNHOUFRRUF0d0lBSWI0QkVBRG9BZ0FodndFQ0FMMENBQ0hBQVFnQWlBTUFJY0VCQUFDSkF3QWd3d0VCQUxjQ0FDRUZHd0FBOVFNQUlCd0FBSVFFQUNEbEFRQUE5Z01BSU9ZQkFBQ0RCQUFnNndFQUFFd0FJQXNiQUFDYUF3QXdIQUFBbmdNQU1PVUJBQUNiQXdBdzVnRUFBSndEQUREbkFRQUFuUU1BSU9nQkFBRGlBZ0F3NlFFQUFPSUNBRERxQVFBQTRnSUFNT3NCQUFEaUFnQXc3QUVBQUo4REFERHRBUUFBNVFJQU1Bc2JBQUNQQXdBd0hBQUFrd01BTU9VQkFBQ1FBd0F3NWdFQUFKRURBRERuQVFBQWtnTUFJT2dCQUFEVUFnQXc2UUVBQU5RQ0FERHFBUUFBMUFJQU1Pc0JBQURVQWdBdzdBRUFBSlFEQUREdEFRQUExd0lBTUFjSEFBQ1pBd0FnbWdFQkFBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQndBRUNBQUFBQWNnQkFRQUFBQUhKQVFFQUFBQUJBZ0FBQUJRQUlCc0FBSmdEQUNBREFBQUFGQUFnR3dBQW1BTUFJQndBQUpZREFDQUJGQUFBZ2dRQU1BSUFBQUFVQUNBVUFBQ1dBd0FnQWdBQUFOZ0NBQ0FVQUFDVkF3QWdCcG9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSVFjSEFBQ1hBd0FnbWdFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh3QUVDQUwwQ0FDSElBUUVBdHdJQUlja0JBUUMzQWdBaEJSc0FBUDBEQUNBY0FBQ0FCQUFnNVFFQUFQNERBQ0RtQVFBQV93TUFJT3NCQUFEQUFRQWdCd2NBQUprREFDQ2FBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFja0JBUUFBQUFFREd3QUFfUU1BSU9VQkFBRC1Bd0FnNndFQUFNQUJBQ0FLQndBQXBBTUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURkQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSFpBVUFBQUFBQjJnRUNBQUFBQWRzQkVBQUFBQUVDQUFBQUN3QWdHd0FBb3dNQUlBTUFBQUFMQUNBYkFBQ2pBd0FnSEFBQW9RTUFJQUVVQUFEOEF3QXdBZ0FBQUFzQUlCUUFBS0VEQUNBQ0FBQUE1Z0lBSUJRQUFLQURBQ0FJbWdFQkFMY0NBQ0drQVFBQTZRTGRBU0txQVVBQXZnSUFJYXNCUUFDLUFnQWh5UUVCQUxjQ0FDSFpBVUFBdmdJQUlkb0JBZ0M5QWdBaDJ3RVFBT2dDQUNFS0J3QUFvZ01BSUFvQUFPd0NBQ0NhQVFFQXR3SUFJYVFCQUFEcEF0MEJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSEpBUUVBdHdJQUlka0JRQUMtQWdBaDJnRUNBTDBDQUNIYkFSQUE2QUlBSVFVYkFBRDNBd0FnSEFBQS1nTUFJT1VCQUFENEF3QWc1Z0VBQVBrREFDRHJBUUFBd0FFQUlBb0hBQUNrQXdBZ0NnQUFfUUlBSUpvQkFRQUFBQUdrQVFBQUFOMEJBcW9CUUFBQUFBR3JBVUFBQUFBQnlRRUJBQUFBQWRrQlFBQUFBQUhhQVFJQUFBQUIyd0VRQUFBQUFRTWJBQUQzQXdBZzVRRUFBUGdEQUNEckFRQUF3QUVBSUJFRkFBQ25Bd0FnQ3dBQXFBTUFJQXdBQUtrREFDQ2FBUUVBQUFBQnBBRUFBQUREQVFLb0FTQUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRzZBUUVBQUFBQnV3RUJBQUFBQWJ3QkFRQUFBQUc5QVFFQUFBQUJ2Z0VRQUFBQUFiOEJBZ0FBQUFIQUFRZ0FBQUFCd1FFQUFLWURBQ0REQVFFQUFBQUJBZWdCQVFBQUFBUURHd0FBOVFNQUlPVUJBQUQyQXdBZzZ3RUFBRXdBSUFRYkFBQ2FBd0F3NVFFQUFKc0RBRERuQVFBQW5RTUFJT3NCQUFEaUFnQXdCQnNBQUk4REFERGxBUUFBa0FNQU1PY0JBQUNTQXdBZzZ3RUFBTlFDQURBRUd3QUFfZ0lBTU9VQkFBRF9BZ0F3NXdFQUFJRURBQ0RyQVFBQWdnTUFNQVFiQUFEZUFnQXc1UUVBQU44Q0FERG5BUUFBNFFJQUlPc0JBQURpQWdBd0JCc0FBTkFDQUREbEFRQUEwUUlBTU9jQkFBRFRBZ0FnNndFQUFOUUNBREFFR3dBQXd3SUFNT1VCQUFERUFnQXc1d0VBQU1ZQ0FDRHJBUUFBeHdJQU1BQUFBQUFBQUFBQUFBVWJBQUR3QXdBZ0hBQUE4d01BSU9VQkFBRHhBd0FnNWdFQUFQSURBQ0RyQVFBQXdBRUFJQU1iQUFEd0F3QWc1UUVBQVBFREFDRHJBUUFBd0FFQUlBQUFBQUFBQUFBQUFBQUZHd0FBNndNQUlCd0FBTzREQUNEbEFRQUE3QU1BSU9ZQkFBRHRBd0FnNndFQUFBc0FJQU1iQUFEckF3QWc1UUVBQU93REFDRHJBUUFBQ3dBZ0FBQUFBQUFBQ3hzQUFNd0RBREFjQUFEUUF3QXc1UUVBQU0wREFERG1BUUFBemdNQU1PY0JBQURQQXdBZzZBRUFBSUlEQUREcEFRQUFnZ01BTU9vQkFBQ0NBd0F3NndFQUFJSURBRERzQVFBQTBRTUFNTzBCQUFDRkF3QXdFUVlBQUxnREFDQUxBQUNvQXdBZ0RBQUFxUU1BSUpvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNUUJBUUFBQUFFQ0FBQUFCUUFnR3dBQTFBTUFJQU1BQUFBRkFDQWJBQURVQXdBZ0hBQUEwd01BSUFFVUFBRHFBd0F3QWdBQUFBVUFJQlFBQU5NREFDQUNBQUFBaGdNQUlCUUFBTklEQUNBT21nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0FneEFFQkFMY0NBQ0VSQmdBQXR3TUFJQXNBQUkwREFDQU1BQUNPQXdBZ21nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0FneEFFQkFMY0NBQ0VSQmdBQXVBTUFJQXNBQUtnREFDQU1BQUNwQXdBZ21nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd4QUVCQUFBQUFRUWJBQURNQXdBdzVRRUFBTTBEQUREbkFRQUF6d01BSU9zQkFBQ0NBd0F3QUFBQUFBQUFBQUFGR3dBQTVRTUFJQndBQU9nREFDRGxBUUFBNWdNQUlPWUJBQURuQXdBZzZ3RUFBTUFCQUNBREd3QUE1UU1BSU9VQkFBRG1Bd0FnNndFQUFNQUJBQ0FJQXdBQXJnTUFJQXNBQUs4REFDQU1BQUN3QXdBZ0RRQUFzUU1BSUowQkFBQ3hBZ0FnbmdFQUFMRUNBQ0NmQVFBQXNRSUFJS0FCQUFDeEFnQWdCQVVBQU9RREFDQUdBQURnQXdBZ0N3QUFyd01BSUF3QUFMQURBQ0FEQndBQTRBTUFJQWdBQU9FREFDQUtBQURqQXdBZ0FBRURBQUN1QXdBZ0VnTUFBS29EQUNBTEFBQ3JBd0FnREFBQXJBTUFJSm9CQVFBQUFBR2JBUUVBQUFBQm5BRUJBQUFBQVowQkFRQUFBQUdlQVFFQUFBQUJud0VCQUFBQUFhQUJBUUFBQUFHaUFRQUFBS0lCQXFRQkFBQUFwQUVDcGdFQUFBQ21BUUtuQVNBQUFBQUJxQUVnQUFBQUFha0JBZ0FBQUFHcUFVQUFBQUFCcXdGQUFBQUFBUUlBQUFEQUFRQWdHd0FBNVFNQUlBTUFBQUREQVFBZ0d3QUE1UU1BSUJ3QUFPa0RBQ0FVQUFBQXd3RUFJQU1BQUw4Q0FDQUxBQURBQWdBZ0RBQUF3UUlBSUJRQUFPa0RBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRVNBd0FBdndJQUlBc0FBTUFDQUNBTUFBREJBZ0FnbWdFQkFMY0NBQ0diQVFFQXR3SUFJWndCQVFDM0FnQWhuUUVCQUxnQ0FDR2VBUUVBdUFJQUlaOEJBUUM0QWdBaG9BRUJBTGdDQUNHaUFRQUF1UUtpQVNLa0FRQUF1Z0trQVNLbUFRQUF1d0ttQVNLbkFTQUF2QUlBSWFnQklBQzhBZ0FocVFFQ0FMMENBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWhEcG9CQVFBQUFBR2tBUUFBQU1NQkFxZ0JJQUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBYm9CQVFBQUFBRzdBUUVBQUFBQnZBRUJBQUFBQWIwQkFRQUFBQUctQVJBQUFBQUJ2d0VDQUFBQUFjQUJDQUFBQUFIQkFRQUFwZ01BSU1RQkFRQUFBQUVMQndBQXBBTUFJQWdBQVB3Q0FDQ2FBUUVBQUFBQnBBRUFBQURkQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJRRkFBQUFBQWRvQkFnQUFBQUhiQVJBQUFBQUJBZ0FBQUFzQUlCc0FBT3NEQUNBREFBQUFDUUFnR3dBQTZ3TUFJQndBQU84REFDQU5BQUFBQ1FBZ0J3QUFvZ01BSUFnQUFPc0NBQ0FVQUFEdkF3QWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZEFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSWRrQlFBQy1BZ0FoMmdFQ0FMMENBQ0hiQVJBQTZBSUFJUXNIQUFDaUF3QWdDQUFBNndJQUlKb0JBUUMzQWdBaHBBRUFBT2tDM1FFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWNrQkFRQzNBZ0FoeWdFQkFMY0NBQ0haQVVBQXZnSUFJZG9CQWdDOUFnQWgyd0VRQU9nQ0FDRVNDd0FBcXdNQUlBd0FBS3dEQUNBTkFBQ3RBd0FnbWdFQkFBQUFBWnNCQVFBQUFBR2NBUUVBQUFBQm5RRUJBQUFBQVo0QkFRQUFBQUdmQVFFQUFBQUJvQUVCQUFBQUFhSUJBQUFBb2dFQ3BBRUFBQUNrQVFLbUFRQUFBS1lCQXFjQklBQUFBQUdvQVNBQUFBQUJxUUVDQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCQWdBQUFNQUJBQ0FiQUFEd0F3QWdBd0FBQU1NQkFDQWJBQUR3QXdBZ0hBQUE5QU1BSUJRQUFBRERBUUFnQ3dBQXdBSUFJQXdBQU1FQ0FDQU5BQURDQWdBZ0ZBQUE5QU1BSUpvQkFRQzNBZ0FobXdFQkFMY0NBQ0djQVFFQXR3SUFJWjBCQVFDNEFnQWhuZ0VCQUxnQ0FDR2ZBUUVBdUFJQUlhQUJBUUM0QWdBaG9nRUFBTGtDb2dFaXBBRUFBTG9DcEFFaXBnRUFBTHNDcGdFaXB3RWdBTHdDQUNHb0FTQUF2QUlBSWFrQkFnQzlBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJUklMQUFEQUFnQWdEQUFBd1FJQUlBMEFBTUlDQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dkQVFFQXVBSUFJWjRCQVFDNEFnQWhud0VCQUxnQ0FDR2dBUUVBdUFJQUlhSUJBQUM1QXFJQklxUUJBQUM2QXFRQklxWUJBQUM3QXFZQklxY0JJQUM4QWdBaHFBRWdBTHdDQUNHcEFRSUF2UUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0VGbWdFQkFBQUFBWnNCQVFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJzQkFRQUFBQUVDQUFBQVRBQWdHd0FBOVFNQUlCSURBQUNxQXdBZ0RBQUFyQU1BSUEwQUFLMERBQ0NhQVFFQUFBQUJtd0VCQUFBQUFad0JBUUFBQUFHZEFRRUFBQUFCbmdFQkFBQUFBWjhCQVFBQUFBR2dBUUVBQUFBQm9nRUFBQUNpQVFLa0FRQUFBS1FCQXFZQkFBQUFwZ0VDcHdFZ0FBQUFBYWdCSUFBQUFBR3BBUUlBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUVDQUFBQXdBRUFJQnNBQVBjREFDQURBQUFBd3dFQUlCc0FBUGNEQUNBY0FBRDdBd0FnRkFBQUFNTUJBQ0FEQUFDX0FnQWdEQUFBd1FJQUlBMEFBTUlDQUNBVUFBRDdBd0FnbWdFQkFMY0NBQ0diQVFFQXR3SUFJWndCQVFDM0FnQWhuUUVCQUxnQ0FDR2VBUUVBdUFJQUlaOEJBUUM0QWdBaG9BRUJBTGdDQUNHaUFRQUF1UUtpQVNLa0FRQUF1Z0trQVNLbUFRQUF1d0ttQVNLbkFTQUF2QUlBSWFnQklBQzhBZ0FocVFFQ0FMMENBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWhFZ01BQUw4Q0FDQU1BQURCQWdBZ0RRQUF3Z0lBSUpvQkFRQzNBZ0FobXdFQkFMY0NBQ0djQVFFQXR3SUFJWjBCQVFDNEFnQWhuZ0VCQUxnQ0FDR2ZBUUVBdUFJQUlhQUJBUUM0QWdBaG9nRUFBTGtDb2dFaXBBRUFBTG9DcEFFaXBnRUFBTHNDcGdFaXB3RWdBTHdDQUNHb0FTQUF2QUlBSWFrQkFnQzlBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJUWlhQVFFQUFBQUJwQUVBQUFEZEFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhaQVVBQUFBQUIyZ0VDQUFBQUFkc0JFQUFBQUFFU0F3QUFxZ01BSUFzQUFLc0RBQ0FOQUFDdEF3QWdtZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCblFFQkFBQUFBWjRCQVFBQUFBR2ZBUUVBQUFBQm9BRUJBQUFBQWFJQkFBQUFvZ0VDcEFFQUFBQ2tBUUttQVFBQUFLWUJBcWNCSUFBQUFBR29BU0FBQUFBQnFRRUNBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJBZ0FBQU1BQkFDQWJBQUQ5QXdBZ0F3QUFBTU1CQUNBYkFBRDlBd0FnSEFBQWdRUUFJQlFBQUFEREFRQWdBd0FBdndJQUlBc0FBTUFDQUNBTkFBRENBZ0FnRkFBQWdRUUFJSm9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlSSURBQUNfQWdBZ0N3QUF3QUlBSUEwQUFNSUNBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRUdtZ0VCQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCd0FFQ0FBQUFBY2dCQVFBQUFBSEpBUUVBQUFBQkF3QUFBRThBSUJzQUFQVURBQ0FjQUFDRkJBQWdCd0FBQUU4QUlCUUFBSVVFQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhCWm9CQVFDM0FnQWhtd0VCQUxjQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHV3RUJBTGNDQUNFT21nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd3d0VCQUFBQUFSSUZBQUNuQXdBZ0JnQUF1QU1BSUF3QUFLa0RBQ0NhQVFFQUFBQUJwQUVBQUFEREFRS29BU0FBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc2QVFFQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFUUFBQUFBYjhCQWdBQUFBSEFBUWdBQUFBQndRRUFBS1lEQUNEREFRRUFBQUFCeEFFQkFBQUFBUUlBQUFBRkFDQWJBQUNIQkFBZ0Rab0JBUUFBQUFHa0FRQUFBTkVCQXFvQlFBQUFBQUdyQVVBQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FSQUFBQUFCendFQkFBQUFBZEVCQVFBQUFBSFNBUUVBQUFBQjB3RUJBQUFBQWRRQkFRQUFBQUhWQVVBQUFBQUJBd0FBQUFNQUlCc0FBSWNFQUNBY0FBQ01CQUFnRkFBQUFBTUFJQVVBQUl3REFDQUdBQUMzQXdBZ0RBQUFqZ01BSUJRQUFJd0VBQ0NhQVFFQXR3SUFJYVFCQUFDS0E4TUJJcWdCSUFDOEFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlib0JBUUMzQWdBaHV3RUJBTGNDQUNHOEFRRUF0d0lBSWIwQkFRQzNBZ0FodmdFUUFPZ0NBQ0dfQVFJQXZRSUFJY0FCQ0FDSUF3QWh3UUVBQUlrREFDRERBUUVBdHdJQUljUUJBUUMzQWdBaEVnVUFBSXdEQUNBR0FBQzNBd0FnREFBQWpnTUFJSm9CQVFDM0FnQWhwQUVBQUlvRHd3RWlxQUVnQUx3Q0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHVnRUJBTGNDQUNHN0FRRUF0d0lBSWJ3QkFRQzNBZ0FodlFFQkFMY0NBQ0ctQVJBQTZBSUFJYjhCQWdDOUFnQWh3QUVJQUlnREFDSEJBUUFBaVFNQUlNTUJBUUMzQWdBaHhBRUJBTGNDQUNFSW1nRUJBQUFBQWFRQkFBQUEzUUVDcWdGQUFBQUFBYXNCUUFBQUFBSEtBUUVBQUFBQjJRRkFBQUFBQWRvQkFnQUFBQUhiQVJBQUFBQUJFZ1VBQUtjREFDQUdBQUM0QXdBZ0N3QUFxQU1BSUpvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNTUJBUUFBQUFIRUFRRUFBQUFCQWdBQUFBVUFJQnNBQUk0RUFDQURBQUFBQXdBZ0d3QUFqZ1FBSUJ3QUFKSUVBQ0FVQUFBQUF3QWdCUUFBakFNQUlBWUFBTGNEQUNBTEFBQ05Bd0FnRkFBQWtnUUFJSm9CQVFDM0FnQWhwQUVBQUlvRHd3RWlxQUVnQUx3Q0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHVnRUJBTGNDQUNHN0FRRUF0d0lBSWJ3QkFRQzNBZ0FodlFFQkFMY0NBQ0ctQVJBQTZBSUFJYjhCQWdDOUFnQWh3QUVJQUlnREFDSEJBUUFBaVFNQUlNTUJBUUMzQWdBaHhBRUJBTGNDQUNFU0JRQUFqQU1BSUFZQUFMY0RBQ0FMQUFDTkF3QWdtZ0VCQUxjQ0FDR2tBUUFBaWdQREFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FodkFFQkFMY0NBQ0c5QVFFQXR3SUFJYjRCRUFEb0FnQWh2d0VDQUwwQ0FDSEFBUWdBaUFNQUljRUJBQUNKQXdBZ3d3RUJBTGNDQUNIRUFRRUF0d0lBSVFhYUFRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSEFBUUlBQUFBQnlBRUJBQUFBQWNvQkFRQUFBQUVLbWdFQkFBQUFBYVFCQUFBQTRRRUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBSGRBUUVBQUFBQjNnRUJBQUFBQWQ4QkFRQUFBQUVCRGdBQ0JRTUdBd1FBQ3dzWUJnd1pDUTBjQVFVRUFBb0ZBQVFHQUFJTERBWU1GUWtDQXdjREJBQUZBUU1JQUFRRUFBZ0hBQUlJQUFNS0VBY0JDUUFHQVFvUkFBSUhBQUlJQUFNQ0N4WUFEQmNBQkFNZEFBc2VBQXdmQUEwZ0FBQUJEZ0FDQVE0QUFnTUVBQkFoQUJFaUFCSUFBQUFEQkFBUUlRQVJJZ0FTQWdjQUFnZ0FBd0lIQUFJSUFBTUZCQUFYSVFBYUlnQWJNd0FZTkFBWkFBQUFBQUFGQkFBWElRQWFJZ0FiTXdBWU5BQVpBQUFEQkFBZ0lRQWhJZ0FpQUFBQUF3UUFJQ0VBSVNJQUlnQUFBQU1FQUNnaEFDa2lBQ29BQUFBREJBQW9JUUFwSWdBcUFRa0FCZ0VKQUFZRkJBQXZJUUF5SWdBek13QXdOQUF4QUFBQUFBQUZCQUF2SVFBeUlnQXpNd0F3TkFBeEFnY0FBZ2dBQXdJSEFBSUlBQU1GQkFBNElRQTdJZ0E4TXdBNU5BQTZBQUFBQUFBRkJBQTRJUUE3SWdBOE13QTVOQUE2QWdVQUJBWUFBZ0lGQUFRR0FBSUZCQUJCSVFCRUlnQkZNd0JDTkFCREFBQUFBQUFGQkFCQklRQkVJZ0JGTXdCQ05BQkRBQUFGQkFCS0lRQk5JZ0JPTXdCTE5BQk1BQUFBQUFBRkJBQktJUUJOSWdCT013QkxOQUJNRHdJQkVDRUJFU0lCRWlNQkV5UUJGU1lCRmlnTUZ5a05HQ3NCR1MwTUdpNE9IUzhCSGpBQkh6RU1JelFQSkRVVEpUWUdKamNHSnpnR0tEa0dLVG9HS2p3R0t6NE1MRDhVTFVFR0xrTU1MMFFWTUVVR01VWUdNa2NNTlVvV05rc2NOMDBFT0U0RU9WRUVPbElFTzFNRVBGVUVQVmNNUGxnZFAxb0VRRndNUVYwZVFsNEVRMThFUkdBTVJXTWZSbVFqUjJZa1NHY2tTV29rU21za1Myd2tURzRrVFhBTVRuRWxUM01rVUhVTVVYWW1VbmNrVTNna1ZIa01WWHduVm4wclYzNEhXSDhIV1lBQkIxcUJBUWRiZ2dFSFhJUUJCMTJHQVF4ZWh3RXNYNGtCQjJDTEFReGhqQUV0WW8wQkIyT09BUWRrandFTVpaSUJMbWFUQVRSbmxBRUphSlVCQ1dtV0FRbHFsd0VKYTVnQkNXeWFBUWx0bkFFTWJwMEJOVy1mQVFsd29RRU1jYUlCTm5LakFRbHpwQUVKZEtVQkRIV29BVGQycVFFOWQ2b0JBM2lyQVFONXJBRURlcTBCQTN1dUFRTjhzQUVEZmJJQkRINnpBVDVfdFFFRGdBRzNBUXlCQWJnQlA0SUJ1UUVEZ3dHNkFRT0VBYnNCRElVQnZnRkFoZ0dfQVVhSEFjRUJBb2dCd2dFQ2lRSEZBUUtLQWNZQkFvc0J4d0VDakFISkFRS05BY3NCREk0QnpBRkhqd0hPQVFLUUFkQUJESkVCMFFGSWtnSFNBUUtUQWRNQkFwUUIxQUVNbFFIWEFVbVdBZGdCVHdcIlxufVxuXG5hc3luYyBmdW5jdGlvbiBkZWNvZGVCYXNlNjRBc1dhc20od2FzbUJhc2U2NDogc3RyaW5nKTogUHJvbWlzZTxXZWJBc3NlbWJseS5Nb2R1bGU+IHtcbiAgY29uc3QgeyBCdWZmZXIgfSA9IGF3YWl0IGltcG9ydCgnbm9kZTpidWZmZXInKVxuICBjb25zdCB3YXNtQXJyYXkgPSBCdWZmZXIuZnJvbSh3YXNtQmFzZTY0LCAnYmFzZTY0JylcbiAgcmV0dXJuIG5ldyBXZWJBc3NlbWJseS5Nb2R1bGUod2FzbUFycmF5KVxufVxuXG5jb25maWcuY29tcGlsZXJXYXNtID0ge1xuICBnZXRSdW50aW1lOiBhc3luYyAoKSA9PiBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC5tanNcIiksXG5cbiAgZ2V0UXVlcnlDb21waWxlcldhc21Nb2R1bGU6IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB7IHdhc20gfSA9IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLndhc20tYmFzZTY0Lm1qc1wiKVxuICAgIHJldHVybiBhd2FpdCBkZWNvZGVCYXNlNjRBc1dhc20od2FzbSlcbiAgfSxcblxuICBpbXBvcnROYW1lOiBcIi4vcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5qc1wiXG59XG5cblxuXG5leHBvcnQgdHlwZSBMb2dPcHRpb25zPENsaWVudE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICAnbG9nJyBleHRlbmRzIGtleW9mIENsaWVudE9wdGlvbnMgPyBDbGllbnRPcHRpb25zWydsb2cnXSBleHRlbmRzIEFycmF5PFByaXNtYS5Mb2dMZXZlbCB8IFByaXNtYS5Mb2dEZWZpbml0aW9uPiA/IFByaXNtYS5HZXRFdmVudHM8Q2xpZW50T3B0aW9uc1snbG9nJ10+IDogbmV2ZXIgOiBuZXZlclxuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgICAvKipcbiAgICogIyMgUHJpc21hIENsaWVudFxuICAgKiBcbiAgICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIH0pXG4gICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICAgKi9cblxuICBuZXcgPFxuICAgIE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zLFxuICAgIExvZ09wdHMgZXh0ZW5kcyBMb2dPcHRpb25zPE9wdGlvbnM+ID0gTG9nT3B0aW9uczxPcHRpb25zPixcbiAgICBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBPcHRpb25zIGV4dGVuZHMgeyBvbWl0OiBpbmZlciBVIH0gPyBVIDogUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgICBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuICA+KG9wdGlvbnM6IFByaXNtYS5QcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucz4pOiBQcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG59XG5cbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50PFxuICBpbiBMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsXG4gIGluIG91dCBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICBpbiBvdXQgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3Ncbj4ge1xuICBbSzogc3ltYm9sXTogeyB0eXBlczogUHJpc21hLlR5cGVNYXA8RXh0QXJncz5bJ290aGVyJ10gfVxuXG4gICRvbjxWIGV4dGVuZHMgTG9nT3B0cz4oZXZlbnRUeXBlOiBWLCBjYWxsYmFjazogKGV2ZW50OiBWIGV4dGVuZHMgJ3F1ZXJ5JyA/IFByaXNtYS5RdWVyeUV2ZW50IDogUHJpc21hLkxvZ0V2ZW50KSA9PiB2b2lkKTogUHJpc21hQ2xpZW50O1xuXG4gIC8qKlxuICAgKiBDb25uZWN0IHdpdGggdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuICAvKipcbiAgICogRGlzY29ubmVjdCBmcm9tIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGRpc2Nvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbi8qKlxuICAgKiBFeGVjdXRlcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdgVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAke3RydWV9IFdIRVJFIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3VW5zYWZlKCdVUERBVEUgVXNlciBTRVQgY29vbCA9ICQxIFdIRVJFIGVtYWlsID0gJDIgOycsIHRydWUsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd2BTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkezF9IE9SIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmUoJ1NFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICQxIE9SIGVtYWlsID0gJDI7JywgMSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG5cbiAgLyoqXG4gICAqIEFsbG93cyB0aGUgcnVubmluZyBvZiBhIHNlcXVlbmNlIG9mIHJlYWQvd3JpdGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBndWFyYW50ZWVkIHRvIGVpdGhlciBzdWNjZWVkIG9yIGZhaWwgYXMgYSB3aG9sZS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IFtnZW9yZ2UsIGJvYiwgYWxpY2VdID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihbXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnR2VvcmdlJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0JvYicgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdBbGljZScgfSB9KSxcbiAgICogXSlcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9vcm0vcHJpc21hLWNsaWVudC9xdWVyaWVzL3RyYW5zYWN0aW9ucykuXG4gICAqL1xuICAkdHJhbnNhY3Rpb248UCBleHRlbmRzIFByaXNtYS5QcmlzbWFQcm9taXNlPGFueT5bXT4oYXJnOiBbLi4uUF0sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHJ1bnRpbWUuVHlwZXMuVXRpbHMuVW53cmFwVHVwbGU8UD4+XG5cbiAgJHRyYW5zYWN0aW9uPFI+KGZuOiAocHJpc21hOiBPbWl0PFByaXNtYUNsaWVudCwgcnVudGltZS5JVFhDbGllbnREZW55TGlzdD4pID0+IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+LCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPlxuXG4gICRleHRlbmRzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJleHRlbmRzXCIsIFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCBFeHRBcmdzLCBydW50aW1lLlR5cGVzLlV0aWxzLkNhbGw8UHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIHtcbiAgICBleHRBcmdzOiBFeHRBcmdzXG4gIH0+PlxuXG4gICAgICAvKipcbiAgICogYHByaXNtYS5ibG9nUG9zdGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCbG9nUG9zdCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gICAgKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJsb2dQb3N0KCk6IFByaXNtYS5CbG9nUG9zdERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuYm9va2luZ2A6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCb29raW5nKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCb29raW5nc1xuICAgICogY29uc3QgYm9va2luZ3MgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYm9va2luZygpOiBQcmlzbWEuQm9va2luZ0RlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuY2F0ZWdvcnlgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQ2F0ZWdvcnkqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIENhdGVnb3JpZXNcbiAgICAqIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNhdGVnb3J5KCk6IFByaXNtYS5DYXRlZ29yeURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuY29udGFjdE1lc3NhZ2VgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQ29udGFjdE1lc3NhZ2UqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIENvbnRhY3RNZXNzYWdlc1xuICAgICogY29uc3QgY29udGFjdE1lc3NhZ2VzID0gYXdhaXQgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjb250YWN0TWVzc2FnZSgpOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnBheW1lbnRgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUGF5bWVudCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUGF5bWVudHNcbiAgICAqIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHBheW1lbnQoKTogUHJpc21hLlBheW1lbnREZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnJldmlld2A6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipSZXZpZXcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFJldmlld3NcbiAgICAqIGNvbnN0IHJldmlld3MgPSBhd2FpdCBwcmlzbWEucmV2aWV3LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCByZXZpZXcoKTogUHJpc21hLlJldmlld0RlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudG91clBhY2thZ2VgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVG91clBhY2thZ2UqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFRvdXJQYWNrYWdlc1xuICAgICogY29uc3QgdG91clBhY2thZ2VzID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB0b3VyUGFja2FnZSgpOiBQcmlzbWEuVG91clBhY2thZ2VEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnVzZXJgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVXNlcioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVXNlcnNcbiAgICAqIGNvbnN0IHVzZXJzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHVzZXIoKTogUHJpc21hLlVzZXJEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKTogUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICByZXR1cm4gcnVudGltZS5nZXRQcmlzbWFDbGllbnQoY29uZmlnKSBhcyB1bmtub3duIGFzIFByaXNtYUNsaWVudENvbnN0cnVjdG9yXG59XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBXQVJOSU5HOiBUaGlzIGlzIGFuIGludGVybmFsIGZpbGUgdGhhdCBpcyBzdWJqZWN0IHRvIGNoYW5nZSFcbiAqXG4gKiBcdUQ4M0RcdURFRDEgVW5kZXIgbm8gY2lyY3Vtc3RhbmNlcyBzaG91bGQgeW91IGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkhIFx1RDgzRFx1REVEMVxuICpcbiAqIEFsbCBleHBvcnRzIGZyb20gdGhpcyBmaWxlIGFyZSB3cmFwcGVkIHVuZGVyIGEgYFByaXNtYWAgbmFtZXNwYWNlIG9iamVjdCBpbiB0aGUgY2xpZW50LnRzIGZpbGUuXG4gKiBXaGlsZSB0aGlzIGVuYWJsZXMgcGFydGlhbCBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LCBpdCBpcyBub3QgcGFydCBvZiB0aGUgc3RhYmxlIHB1YmxpYyBBUEkuXG4gKlxuICogSWYgeW91IGFyZSBsb29raW5nIGZvciB5b3VyIE1vZGVscywgRW51bXMsIGFuZCBJbnB1dCBUeXBlcywgcGxlYXNlIGltcG9ydCB0aGVtIGZyb20gdGhlIHJlc3BlY3RpdmVcbiAqIG1vZGVsIGZpbGVzIGluIHRoZSBgbW9kZWxgIGRpcmVjdG9yeSFcbiAqL1xuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgdHlwZSAqIGFzIFByaXNtYSBmcm9tIFwiLi4vbW9kZWxzXCJcbmltcG9ydCB7IHR5cGUgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4vY2xhc3NcIlxuXG5leHBvcnQgdHlwZSAqIGZyb20gJy4uL21vZGVscydcblxuZXhwb3J0IHR5cGUgRE1NRiA9IHR5cGVvZiBydW50aW1lLkRNTUZcblxuZXhwb3J0IHR5cGUgUHJpc21hUHJvbWlzZTxUPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlByaXNtYVByb21pc2U8VD5cblxuLyoqXG4gKiBQcmlzbWEgRXJyb3JzXG4gKi9cblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5cbi8qKlxuICogUmUtZXhwb3J0IG9mIHNxbC10ZW1wbGF0ZS10YWdcbiAqL1xuZXhwb3J0IGNvbnN0IHNxbCA9IHJ1bnRpbWUuc3FsdGFnXG5leHBvcnQgY29uc3QgZW1wdHkgPSBydW50aW1lLmVtcHR5XG5leHBvcnQgY29uc3Qgam9pbiA9IHJ1bnRpbWUuam9pblxuZXhwb3J0IGNvbnN0IHJhdyA9IHJ1bnRpbWUucmF3XG5leHBvcnQgY29uc3QgU3FsID0gcnVudGltZS5TcWxcbmV4cG9ydCB0eXBlIFNxbCA9IHJ1bnRpbWUuU3FsXG5cblxuXG4vKipcbiAqIERlY2ltYWwuanNcbiAqL1xuZXhwb3J0IGNvbnN0IERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcbmV4cG9ydCB0eXBlIERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcblxuZXhwb3J0IHR5cGUgRGVjaW1hbEpzTGlrZSA9IHJ1bnRpbWUuRGVjaW1hbEpzTGlrZVxuXG4vKipcbiogRXh0ZW5zaW9uc1xuKi9cbmV4cG9ydCB0eXBlIEV4dGVuc2lvbiA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5Vc2VyQXJnc1xuZXhwb3J0IGNvbnN0IGdldEV4dGVuc2lvbkNvbnRleHQgPSBydW50aW1lLkV4dGVuc2lvbnMuZ2V0RXh0ZW5zaW9uQ29udGV4dFxuZXhwb3J0IHR5cGUgQXJnczxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuQXJnczxULCBGPlxuZXhwb3J0IHR5cGUgUGF5bG9hZDxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24gPSBuZXZlcj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QYXlsb2FkPFQsIEY+XG5leHBvcnQgdHlwZSBSZXN1bHQ8VCwgQSwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlJlc3VsdDxULCBBLCBGPlxuZXhwb3J0IHR5cGUgRXhhY3Q8QSwgVz4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5FeGFjdDxBLCBXPlxuXG5leHBvcnQgdHlwZSBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IHN0cmluZ1xuICBlbmdpbmU6IHN0cmluZ1xufVxuXG4vKipcbiAqIFByaXNtYSBDbGllbnQgSlMgdmVyc2lvbjogNy45LjFcbiAqIFF1ZXJ5IEVuZ2luZSB2ZXJzaW9uOiBlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXG4gKi9cbmV4cG9ydCBjb25zdCBwcmlzbWFWZXJzaW9uOiBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IFwiNy45LjFcIixcbiAgZW5naW5lOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIlxufVxuXG4vKipcbiAqIFV0aWxpdHkgVHlwZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBCeXRlcyA9IHJ1bnRpbWUuQnl0ZXNcbmV4cG9ydCB0eXBlIEpzb25PYmplY3QgPSBydW50aW1lLkpzb25PYmplY3RcbmV4cG9ydCB0eXBlIEpzb25BcnJheSA9IHJ1bnRpbWUuSnNvbkFycmF5XG5leHBvcnQgdHlwZSBKc29uVmFsdWUgPSBydW50aW1lLkpzb25WYWx1ZVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uT2JqZWN0ID0gcnVudGltZS5JbnB1dEpzb25PYmplY3RcbmV4cG9ydCB0eXBlIElucHV0SnNvbkFycmF5ID0gcnVudGltZS5JbnB1dEpzb25BcnJheVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uVmFsdWUgPSBydW50aW1lLklucHV0SnNvblZhbHVlXG5cblxuZXhwb3J0IGNvbnN0IE51bGxUeXBlcyA9IHtcbiAgRGJOdWxsOiBydW50aW1lLk51bGxUeXBlcy5EYk51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuRGJOdWxsKSxcbiAgSnNvbk51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkpzb25OdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkpzb25OdWxsKSxcbiAgQW55TnVsbDogcnVudGltZS5OdWxsVHlwZXMuQW55TnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5BbnlOdWxsKSxcbn1cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBgbnVsbGAgb24gdGhlIGRhdGFiYXNlIChlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgRGJOdWxsID0gcnVudGltZS5EYk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBoYXZlIEpTT04gYG51bGxgIHZhbHVlcyAobm90IGVtcHR5IG9uIHRoZSBkYilcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBKc29uTnVsbCA9IHJ1bnRpbWUuSnNvbk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBhcmUgYFByaXNtYS5EYk51bGxgIG9yIGBQcmlzbWEuSnNvbk51bGxgXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgQW55TnVsbCA9IHJ1bnRpbWUuQW55TnVsbFxuXG5cbnR5cGUgU2VsZWN0QW5kSW5jbHVkZSA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgaW5jbHVkZTogYW55XG59XG5cbnR5cGUgU2VsZWN0QW5kT21pdCA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgb21pdDogYW55XG59XG5cbi8qKlxuICogRnJvbSBULCBwaWNrIGEgc2V0IG9mIHByb3BlcnRpZXMgd2hvc2Uga2V5cyBhcmUgaW4gdGhlIHVuaW9uIEtcbiAqL1xudHlwZSBQcmlzbWFfX1BpY2s8VCwgSyBleHRlbmRzIGtleW9mIFQ+ID0ge1xuICAgIFtQIGluIEtdOiBUW1BdO1xufTtcblxuZXhwb3J0IHR5cGUgRW51bWVyYWJsZTxUPiA9IFQgfCBBcnJheTxUPjtcblxuLyoqXG4gKiBTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uXG4gKi9cbmV4cG9ydCB0eXBlIFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyO1xufTtcblxuLyoqXG4gKiBSZXNvbHZlZCB0eXBlIG9mIHRoZSBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGBQcmlzbWFDbGllbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIFdoZW4gY2FsbGVkIHdpdGhvdXQgYSBuYXJyb3dlciBvcHRpb25zIHR5cGUgKHRoZSBjb21tb24gY2FzZSksIHRoaXMgcmVzb2x2ZXNcbiAqIHRvIGBQcmlzbWFDbGllbnRPcHRpb25zYCBkaXJlY3RseSwgd2hpY2ggcHJvZHVjZXMgYSBjbGVhciBUeXBlU2NyaXB0IGVycm9yXG4gKiBtZXNzYWdlIChgbm90IGFzc2lnbmFibGUgdG8gcGFyYW1ldGVyIG9mIHR5cGUgJ1ByaXNtYUNsaWVudE9wdGlvbnMnYCkgd2hlblxuICogdGhlIGFyZ3VtZW50IGlzIG1pc3Npbmcgb3IgaW5jb21wbGV0ZS4gV2hlbiB0aGUgdXNlciBzdXBwbGllcyBhIG5hcnJvd2VyXG4gKiBvcHRpb25zIHR5cGUgKGUuZy4gdmlhIGEgbGl0ZXJhbCksIGl0IGZhbGxzIGJhY2sgdG8gYFN1YnNldGAgdG8ga2VlcFxuICogZmlsdGVyaW5nIG91dCB1bmtub3duIHByb3BlcnRpZXMuXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zIGV4dGVuZHMgUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICBbUHJpc21hQ2xpZW50T3B0aW9uc10gZXh0ZW5kcyBbT3B0aW9uc10gPyBQcmlzbWFDbGllbnRPcHRpb25zIDogU3Vic2V0PE9wdGlvbnMsIFByaXNtYUNsaWVudE9wdGlvbnM+O1xuXG4vKipcbiAqIFNlbGVjdFN1YnNldFxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgLiBTaW1wbGUgdmVyc2lvbiBvZiBJbnRlcnNlY3Rpb24uXG4gKiBBZGRpdGlvbmFsbHksIGl0IHZhbGlkYXRlcywgaWYgYm90aCBzZWxlY3QgYW5kIGluY2x1ZGUgYXJlIHByZXNlbnQuIElmIHRoZSBjYXNlLCBpdCBlcnJvcnMuXG4gKi9cbmV4cG9ydCB0eXBlIFNlbGVjdFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyXG59ICZcbiAgKFQgZXh0ZW5kcyBTZWxlY3RBbmRJbmNsdWRlXG4gICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYGluY2x1ZGVgLidcbiAgICA6IFQgZXh0ZW5kcyBTZWxlY3RBbmRPbWl0XG4gICAgICA/ICdQbGVhc2UgZWl0aGVyIGNob29zZSBgc2VsZWN0YCBvciBgb21pdGAuJ1xuICAgICAgOiB7fSlcblxuLyoqXG4gKiBTdWJzZXQgKyBJbnRlcnNlY3Rpb25cbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYCBhbmQgaW50ZXJzZWN0IGBLYFxuICovXG5leHBvcnQgdHlwZSBTdWJzZXRJbnRlcnNlY3Rpb248VCwgVSwgSz4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIEtcblxudHlwZSBXaXRob3V0PFQsIFU+ID0geyBbUCBpbiBFeGNsdWRlPGtleW9mIFQsIGtleW9mIFU+XT86IG5ldmVyIH07XG5cbi8qKlxuICogWE9SIGlzIG5lZWRlZCB0byBoYXZlIGEgcmVhbCBtdXR1YWxseSBleGNsdXNpdmUgdW5pb24gdHlwZVxuICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDIxMjM0MDcvZG9lcy10eXBlc2NyaXB0LXN1cHBvcnQtbXV0dWFsbHktZXhjbHVzaXZlLXR5cGVzXG4gKi9cbmV4cG9ydCB0eXBlIFhPUjxULCBVPiA9XG4gIFQgZXh0ZW5kcyBvYmplY3QgP1xuICBVIGV4dGVuZHMgb2JqZWN0ID9cbiAgICAoKFdpdGhvdXQ8VCwgVT4gJiBVKSB8IChXaXRob3V0PFUsIFQ+ICYgVCkpICYgb2JqZWN0XG4gIDogVSA6IFRcblxuXG4vKipcbiAqIElzIFQgYSBSZWNvcmQ/XG4gKi9cbnR5cGUgSXNPYmplY3Q8VCBleHRlbmRzIGFueT4gPSBUIGV4dGVuZHMgQXJyYXk8YW55PlxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgRGF0ZVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgVWludDhBcnJheVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgQmlnSW50XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBvYmplY3Rcbj8gVHJ1ZVxuOiBGYWxzZVxuXG5cbi8qKlxuICogSWYgaXQncyBUW10sIHJldHVybiBUXG4gKi9cbmV4cG9ydCB0eXBlIFVuRW51bWVyYXRlPFQgZXh0ZW5kcyB1bmtub3duPiA9IFQgZXh0ZW5kcyBBcnJheTxpbmZlciBVPiA/IFUgOiBUXG5cbi8qKlxuICogRnJvbSB0cy10b29sYmVsdFxuICovXG5cbnR5cGUgX19FaXRoZXI8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPbWl0PE8sIEs+ICZcbiAge1xuICAgIC8vIE1lcmdlIGFsbCBidXQgS1xuICAgIFtQIGluIEtdOiBQcmlzbWFfX1BpY2s8TywgUCAmIGtleW9mIE8+IC8vIFdpdGggSyBwb3NzaWJpbGl0aWVzXG4gIH1bS11cblxudHlwZSBFaXRoZXJTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBTdHJpY3Q8X19FaXRoZXI8TywgSz4+XG5cbnR5cGUgRWl0aGVyTG9vc2U8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBDb21wdXRlUmF3PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIF9FaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW5cbj4gPSB7XG4gIDE6IEVpdGhlclN0cmljdDxPLCBLPlxuICAwOiBFaXRoZXJMb29zZTxPLCBLPlxufVtzdHJpY3RdXG5cbmV4cG9ydCB0eXBlIEVpdGhlcjxcbiAgTyBleHRlbmRzIG9iamVjdCxcbiAgSyBleHRlbmRzIEtleSxcbiAgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDFcbj4gPSBPIGV4dGVuZHMgdW5rbm93biA/IF9FaXRoZXI8TywgSywgc3RyaWN0PiA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIFVuaW9uID0gYW55XG5cbmV4cG9ydCB0eXBlIFBhdGNoVW5kZWZpbmVkPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgW0sgaW4ga2V5b2YgT106IE9bS10gZXh0ZW5kcyB1bmRlZmluZWQgPyBBdDxPMSwgSz4gOiBPW0tdXG59ICYge31cblxuLyoqIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuZXhwb3J0IHR5cGUgSW50ZXJzZWN0T2Y8VSBleHRlbmRzIFVuaW9uPiA9IChcbiAgVSBleHRlbmRzIHVua25vd24gPyAoazogVSkgPT4gdm9pZCA6IG5ldmVyXG4pIGV4dGVuZHMgKGs6IGluZmVyIEkpID0+IHZvaWRcbiAgPyBJXG4gIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgT3ZlcndyaXRlPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgICBbSyBpbiBrZXlvZiBPXTogSyBleHRlbmRzIGtleW9mIE8xID8gTzFbS10gOiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9NZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IEludGVyc2VjdE9mPE92ZXJ3cml0ZTxVLCB7XG4gICAgW0sgaW4ga2V5b2YgVV0tPzogQXQ8VSwgSz47XG59Pj47XG5cbnR5cGUgS2V5ID0gc3RyaW5nIHwgbnVtYmVyIHwgc3ltYm9sO1xudHlwZSBBdFN0cmljdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE9bSyAmIGtleW9mIE9dO1xudHlwZSBBdExvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gTyBleHRlbmRzIHVua25vd24gPyBBdFN0cmljdDxPLCBLPiA6IG5ldmVyO1xuZXhwb3J0IHR5cGUgQXQ8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleSwgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDE+ID0ge1xuICAgIDE6IEF0U3RyaWN0PE8sIEs+O1xuICAgIDA6IEF0TG9vc2U8TywgSz47XG59W3N0cmljdF07XG5cbmV4cG9ydCB0eXBlIENvbXB1dGVSYXc8QSBleHRlbmRzIGFueT4gPSBBIGV4dGVuZHMgRnVuY3Rpb24gPyBBIDoge1xuICBbSyBpbiBrZXlvZiBBXTogQVtLXTtcbn0gJiB7fTtcblxuZXhwb3J0IHR5cGUgT3B0aW9uYWxGbGF0PE8+ID0ge1xuICBbSyBpbiBrZXlvZiBPXT86IE9bS107XG59ICYge307XG5cbnR5cGUgX1JlY29yZDxLIGV4dGVuZHMga2V5b2YgYW55LCBUPiA9IHtcbiAgW1AgaW4gS106IFQ7XG59O1xuXG4vLyBjYXVzZSB0eXBlc2NyaXB0IG5vdCB0byBleHBhbmQgdHlwZXMgYW5kIHByZXNlcnZlIG5hbWVzXG50eXBlIE5vRXhwYW5kPFQ+ID0gVCBleHRlbmRzIHVua25vd24gPyBUIDogbmV2ZXI7XG5cbi8vIHRoaXMgdHlwZSBhc3N1bWVzIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGVudGlyZWx5IG9wdGlvbmFsXG5leHBvcnQgdHlwZSBBdExlYXN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBzdHJpbmc+ID0gTm9FeHBhbmQ8XG4gIE8gZXh0ZW5kcyB1bmtub3duXG4gID8gfCAoSyBleHRlbmRzIGtleW9mIE8gPyB7IFtQIGluIEtdOiBPW1BdIH0gJiBPIDogTylcbiAgICB8IHtbUCBpbiBrZXlvZiBPIGFzIFAgZXh0ZW5kcyBLID8gUCA6IG5ldmVyXS0/OiBPW1BdfSAmIE9cbiAgOiBuZXZlcj47XG5cbnR5cGUgX1N0cmljdDxVLCBfVSA9IFU+ID0gVSBleHRlbmRzIHVua25vd24gPyBVICYgT3B0aW9uYWxGbGF0PF9SZWNvcmQ8RXhjbHVkZTxLZXlzPF9VPiwga2V5b2YgVT4sIG5ldmVyPj4gOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgU3RyaWN0PFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfU3RyaWN0PFU+Pjtcbi8qKiBFbmQgSGVscGVyIFR5cGVzIGZvciBcIk1lcmdlXCIgKiovXG5cbmV4cG9ydCB0eXBlIE1lcmdlPFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfTWVyZ2U8U3RyaWN0PFU+Pj47XG5cbmV4cG9ydCB0eXBlIEJvb2xlYW4gPSBUcnVlIHwgRmFsc2VcblxuZXhwb3J0IHR5cGUgVHJ1ZSA9IDFcblxuZXhwb3J0IHR5cGUgRmFsc2UgPSAwXG5cbmV4cG9ydCB0eXBlIE5vdDxCIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IDFcbiAgMTogMFxufVtCXVxuXG5leHBvcnQgdHlwZSBFeHRlbmRzPEExIGV4dGVuZHMgYW55LCBBMiBleHRlbmRzIGFueT4gPSBbQTFdIGV4dGVuZHMgW25ldmVyXVxuICA/IDAgLy8gYW55dGhpbmcgYG5ldmVyYCBpcyBmYWxzZVxuICA6IEExIGV4dGVuZHMgQTJcbiAgPyAxXG4gIDogMFxuXG5leHBvcnQgdHlwZSBIYXM8VSBleHRlbmRzIFVuaW9uLCBVMSBleHRlbmRzIFVuaW9uPiA9IE5vdDxcbiAgRXh0ZW5kczxFeGNsdWRlPFUxLCBVPiwgVTE+XG4+XG5cbmV4cG9ydCB0eXBlIE9yPEIxIGV4dGVuZHMgQm9vbGVhbiwgQjIgZXh0ZW5kcyBCb29sZWFuPiA9IHtcbiAgMDoge1xuICAgIDA6IDBcbiAgICAxOiAxXG4gIH1cbiAgMToge1xuICAgIDA6IDFcbiAgICAxOiAxXG4gIH1cbn1bQjFdW0IyXVxuXG5leHBvcnQgdHlwZSBLZXlzPFUgZXh0ZW5kcyBVbmlvbj4gPSBVIGV4dGVuZHMgdW5rbm93biA/IGtleW9mIFUgOiBuZXZlclxuXG5leHBvcnQgdHlwZSBHZXRTY2FsYXJUeXBlPFQsIE8+ID0gTyBleHRlbmRzIG9iamVjdCA/IHtcbiAgW1AgaW4ga2V5b2YgVF06IFAgZXh0ZW5kcyBrZXlvZiBPXG4gICAgPyBPW1BdXG4gICAgOiBuZXZlclxufSA6IG5ldmVyXG5cbnR5cGUgRmllbGRQYXRoczxcbiAgVCxcbiAgVSA9IE9taXQ8VCwgJ19hdmcnIHwgJ19zdW0nIHwgJ19jb3VudCcgfCAnX21pbicgfCAnX21heCc+XG4+ID0gSXNPYmplY3Q8VD4gZXh0ZW5kcyBUcnVlID8gVSA6IFRcblxuZXhwb3J0IHR5cGUgR2V0SGF2aW5nRmllbGRzPFQ+ID0ge1xuICBbSyBpbiBrZXlvZiBUXTogT3I8XG4gICAgT3I8RXh0ZW5kczwnT1InLCBLPiwgRXh0ZW5kczwnQU5EJywgSz4+LFxuICAgIEV4dGVuZHM8J05PVCcsIEs+XG4gID4gZXh0ZW5kcyBUcnVlXG4gICAgPyAvLyBpbmZlciBpcyBvbmx5IG5lZWRlZCB0byBub3QgaGl0IFRTIGxpbWl0XG4gICAgICAvLyBiYXNlZCBvbiB0aGUgYnJpbGxpYW50IGlkZWEgb2YgUGllcnJlLUFudG9pbmUgTWlsbHNcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzAxODgjaXNzdWVjb21tZW50LTQ3ODkzODQzN1xuICAgICAgVFtLXSBleHRlbmRzIGluZmVyIFRLXG4gICAgICA/IEdldEhhdmluZ0ZpZWxkczxVbkVudW1lcmF0ZTxUSz4gZXh0ZW5kcyBvYmplY3QgPyBNZXJnZTxVbkVudW1lcmF0ZTxUSz4+IDogbmV2ZXI+XG4gICAgICA6IG5ldmVyXG4gICAgOiB7fSBleHRlbmRzIEZpZWxkUGF0aHM8VFtLXT5cbiAgICA/IG5ldmVyXG4gICAgOiBLXG59W2tleW9mIFRdXG5cbi8qKlxuICogQ29udmVydCB0dXBsZSB0byB1bmlvblxuICovXG50eXBlIF9UdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgKGluZmVyIEUpW10gPyBFIDogbmV2ZXJcbnR5cGUgVHVwbGVUb1VuaW9uPEsgZXh0ZW5kcyByZWFkb25seSBhbnlbXT4gPSBfVHVwbGVUb1VuaW9uPEs+XG5leHBvcnQgdHlwZSBNYXliZVR1cGxlVG9VbmlvbjxUPiA9IFQgZXh0ZW5kcyBhbnlbXSA/IFR1cGxlVG9VbmlvbjxUPiA6IFRcblxuLyoqXG4gKiBMaWtlIGBQaWNrYCwgYnV0IGFkZGl0aW9uYWxseSBjYW4gYWxzbyBhY2NlcHQgYW4gYXJyYXkgb2Yga2V5c1xuICovXG5leHBvcnQgdHlwZSBQaWNrRW51bWVyYWJsZTxULCBLIGV4dGVuZHMgRW51bWVyYWJsZTxrZXlvZiBUPiB8IGtleW9mIFQ+ID0gUHJpc21hX19QaWNrPFQsIE1heWJlVHVwbGVUb1VuaW9uPEs+PlxuXG4vKipcbiAqIEV4Y2x1ZGUgYWxsIGtleXMgd2l0aCB1bmRlcnNjb3Jlc1xuICovXG5leHBvcnQgdHlwZSBFeGNsdWRlVW5kZXJzY29yZUtleXM8VCBleHRlbmRzIHN0cmluZz4gPSBUIGV4dGVuZHMgYF8ke3N0cmluZ31gID8gbmV2ZXIgOiBUXG5cblxuZXhwb3J0IHR5cGUgRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT4gPSBydW50aW1lLkZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+XG5cbnR5cGUgRmllbGRSZWZJbnB1dFR5cGU8TW9kZWwsIEZpZWxkVHlwZT4gPSBNb2RlbCBleHRlbmRzIG5ldmVyID8gbmV2ZXIgOiBGaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG5cbmV4cG9ydCBjb25zdCBNb2RlbE5hbWUgPSB7XG4gIEJsb2dQb3N0OiAnQmxvZ1Bvc3QnLFxuICBCb29raW5nOiAnQm9va2luZycsXG4gIENhdGVnb3J5OiAnQ2F0ZWdvcnknLFxuICBDb250YWN0TWVzc2FnZTogJ0NvbnRhY3RNZXNzYWdlJyxcbiAgUGF5bWVudDogJ1BheW1lbnQnLFxuICBSZXZpZXc6ICdSZXZpZXcnLFxuICBUb3VyUGFja2FnZTogJ1RvdXJQYWNrYWdlJyxcbiAgVXNlcjogJ1VzZXInXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE1vZGVsTmFtZSA9ICh0eXBlb2YgTW9kZWxOYW1lKVtrZXlvZiB0eXBlb2YgTW9kZWxOYW1lXVxuXG5cblxuZXhwb3J0IGludGVyZmFjZSBUeXBlTWFwQ2I8R2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gZXh0ZW5kcyBydW50aW1lLlR5cGVzLlV0aWxzLkZuPHtleHRBcmdzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzIH0sIHJ1bnRpbWUuVHlwZXMuVXRpbHMuUmVjb3JkPHN0cmluZywgYW55Pj4ge1xuICByZXR1cm5zOiBUeXBlTWFwPHRoaXNbJ3BhcmFtcyddWydleHRBcmdzJ10sIEdsb2JhbE9taXRPcHRpb25zPlxufVxuXG5leHBvcnQgdHlwZSBUeXBlTWFwPEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzLCBHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiA9IHtcbiAgZ2xvYmFsT21pdE9wdGlvbnM6IHtcbiAgICBvbWl0OiBHbG9iYWxPbWl0T3B0aW9uc1xuICB9XG4gIG1ldGE6IHtcbiAgICBtb2RlbFByb3BzOiBcImJsb2dQb3N0XCIgfCBcImJvb2tpbmdcIiB8IFwiY2F0ZWdvcnlcIiB8IFwiY29udGFjdE1lc3NhZ2VcIiB8IFwicGF5bWVudFwiIHwgXCJyZXZpZXdcIiB8IFwidG91clBhY2thZ2VcIiB8IFwidXNlclwiXG4gICAgdHhJc29sYXRpb25MZXZlbDogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIG1vZGVsOiB7XG4gICAgQmxvZ1Bvc3Q6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5CbG9nUG9zdEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCbG9nUG9zdD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQm9va2luZzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCb29raW5nUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQm9va2luZ0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQm9va2luZz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDYXRlZ29yeToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDYXRlZ29yeVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNhdGVnb3J5RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNhdGVnb3J5PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDb250YWN0TWVzc2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNvbnRhY3RNZXNzYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBQYXltZW50OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFBheW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5QYXltZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVQYXltZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFJldmlldzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRSZXZpZXdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5SZXZpZXdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVSZXZpZXc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBUb3VyUGFja2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlRvdXJQYWNrYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVRvdXJQYWNrYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBVc2VyOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFVzZXJQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Vc2VyRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVVc2VyPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59ICYge1xuICBvdGhlcjoge1xuICAgIHBheWxvYWQ6IGFueVxuICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICRleGVjdXRlUmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJGV4ZWN1dGVSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFbnVtc1xuICovXG5cbmV4cG9ydCBjb25zdCBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gcnVudGltZS5tYWtlU3RyaWN0RW51bSh7XG4gIFJlYWRVbmNvbW1pdHRlZDogJ1JlYWRVbmNvbW1pdHRlZCcsXG4gIFJlYWRDb21taXR0ZWQ6ICdSZWFkQ29tbWl0dGVkJyxcbiAgUmVwZWF0YWJsZVJlYWQ6ICdSZXBlYXRhYmxlUmVhZCcsXG4gIFNlcmlhbGl6YWJsZTogJ1NlcmlhbGl6YWJsZSdcbn0gYXMgY29uc3QpXG5cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSAodHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwpW2tleW9mIHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXVxuXG5cbmV4cG9ydCBjb25zdCBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGV4Y2VycHQ6ICdleGNlcnB0JyxcbiAgY29udGVudDogJ2NvbnRlbnQnLFxuICBjb3ZlckltYWdlOiAnY292ZXJJbWFnZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGF1dGhvcklkOiAnYXV0aG9ySWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBCb29raW5nU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdHJhdmVsRGF0ZTogJ3RyYXZlbERhdGUnLFxuICB0cmF2ZWxlcnM6ICd0cmF2ZWxlcnMnLFxuICB0b3RhbFByaWNlOiAndG90YWxQcmljZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQm9va2luZ1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgc3ViamVjdDogJ3N1YmplY3QnLFxuICBtZXNzYWdlOiAnbWVzc2FnZScsXG4gIGlzUmVzb2x2ZWQ6ICdpc1Jlc29sdmVkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGJvb2tpbmdJZDogJ2Jvb2tpbmdJZCcsXG4gIHRyYW5JZDogJ3RyYW5JZCcsXG4gIHZhbElkOiAndmFsSWQnLFxuICBhbW91bnQ6ICdhbW91bnQnLFxuICBjdXJyZW5jeTogJ2N1cnJlbmN5JyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgZ2F0ZXdheVBhZ2VVcmw6ICdnYXRld2F5UGFnZVVybCcsXG4gIHNzbFNlc3Npb25LZXk6ICdzc2xTZXNzaW9uS2V5JyxcbiAgY2FyZFR5cGU6ICdjYXJkVHlwZScsXG4gIGJhbmtUcmFuSWQ6ICdiYW5rVHJhbklkJyxcbiAgcGFpZEF0OiAncGFpZEF0JyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYXltZW50U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgY29tbWVudDogJ2NvbW1lbnQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJldmlld1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGRlc2NyaXB0aW9uOiAnZGVzY3JpcHRpb24nLFxuICBsb2NhdGlvbjogJ2xvY2F0aW9uJyxcbiAgcHJpY2U6ICdwcmljZScsXG4gIGR1cmF0aW9uOiAnZHVyYXRpb24nLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBpbWFnZXM6ICdpbWFnZXMnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBjYXRlZ29yeUlkOiAnY2F0ZWdvcnlJZCcsXG4gIGFnZW50SWQ6ICdhZ2VudElkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVXNlclNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHBhc3N3b3JkOiAncGFzc3dvcmQnLFxuICBnb29nbGVJZDogJ2dvb2dsZUlkJyxcbiAgcGhvbmU6ICdwaG9uZScsXG4gIGF2YXRhclVybDogJ2F2YXRhclVybCcsXG4gIHJvbGU6ICdyb2xlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgYXV0aFByb3ZpZGVyOiAnYXV0aFByb3ZpZGVyJyxcbiAgZW1haWxWZXJpZmllZDogJ2VtYWlsVmVyaWZpZWQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICB0b2tlblZlcnNpb246ICd0b2tlblZlcnNpb24nLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBTb3J0T3JkZXIgPSB7XG4gIGFzYzogJ2FzYycsXG4gIGRlc2M6ICdkZXNjJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBTb3J0T3JkZXIgPSAodHlwZW9mIFNvcnRPcmRlcilba2V5b2YgdHlwZW9mIFNvcnRPcmRlcl1cblxuXG5leHBvcnQgY29uc3QgUXVlcnlNb2RlID0ge1xuICBkZWZhdWx0OiAnZGVmYXVsdCcsXG4gIGluc2Vuc2l0aXZlOiAnaW5zZW5zaXRpdmUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5TW9kZSA9ICh0eXBlb2YgUXVlcnlNb2RlKVtrZXlvZiB0eXBlb2YgUXVlcnlNb2RlXVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsc09yZGVyID0ge1xuICBmaXJzdDogJ2ZpcnN0JyxcbiAgbGFzdDogJ2xhc3QnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE51bGxzT3JkZXIgPSAodHlwZW9mIE51bGxzT3JkZXIpW2tleW9mIHR5cGVvZiBOdWxsc09yZGVyXVxuXG5cblxuLyoqXG4gKiBGaWVsZCByZWZlcmVuY2VzXG4gKi9cblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZydcbiAqL1xuZXhwb3J0IHR5cGUgU3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZ1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0U3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2xlYW4nXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2xlYW5GaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29sZWFuJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lJ1xuICovXG5leHBvcnQgdHlwZSBEYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50J1xuICovXG5leHBvcnQgdHlwZSBJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsJ1xuICovXG5leHBvcnQgdHlwZSBEZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXQnXG4gKi9cbmV4cG9ydCB0eXBlIEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXInXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXInPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyW10nPlxuICAgIFxuXG4vKipcbiAqIEJhdGNoIFBheWxvYWQgZm9yIHVwZGF0ZU1hbnkgJiBkZWxldGVNYW55ICYgY3JlYXRlTWFueVxuICovXG5leHBvcnQgdHlwZSBCYXRjaFBheWxvYWQgPSB7XG4gIGNvdW50OiBudW1iZXJcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmluZUV4dGVuc2lvbiA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5kZWZpbmVFeHRlbnNpb24gYXMgdW5rbm93biBhcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJkZWZpbmVcIiwgVHlwZU1hcENiLCBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+XG5leHBvcnQgdHlwZSBEZWZhdWx0UHJpc21hQ2xpZW50ID0gUHJpc21hQ2xpZW50XG5leHBvcnQgdHlwZSBFcnJvckZvcm1hdCA9ICdwcmV0dHknIHwgJ2NvbG9ybGVzcycgfCAnbWluaW1hbCdcbi8qKlxuICogT3B0aW9ucyBjb21tb24gdG8gYWxsIHZhcmlhbnRzIG9mIGBQcmlzbWFDbGllbnRPcHRpb25zYCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyIG9yIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgXCJjb2xvcmxlc3NcIlxuICAgKi9cbiAgZXJyb3JGb3JtYXQ/OiBFcnJvckZvcm1hdFxuICAvKipcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIC8vIFNob3J0aGFuZCBmb3IgYGVtaXQ6ICdzdGRvdXQnYFxuICAgKiBsb2c6IFsncXVlcnknLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ11cbiAgICogXG4gICAqIC8vIEVtaXQgYXMgZXZlbnRzIG9ubHlcbiAgICogbG9nOiBbXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIF1cbiAgICogXG4gICAqIC8gRW1pdCBhcyBldmVudHMgYW5kIGxvZyB0byBzdGRvdXRcbiAgICogb2c6IFtcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXG4gICAqIGBgYFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9sb2dnaW5nKS5cbiAgICovXG4gIGxvZz86IChMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24pW11cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdHJhbnNhY3Rpb25PcHRpb25zXG4gICAqIG1heFdhaXQgPz0gMjAwMFxuICAgKiB0aW1lb3V0ID89IDUwMDBcbiAgICovXG4gIHRyYW5zYWN0aW9uT3B0aW9ucz86IHtcbiAgICBtYXhXYWl0PzogbnVtYmVyXG4gICAgdGltZW91dD86IG51bWJlclxuICAgIGlzb2xhdGlvbkxldmVsPzogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIC8qKlxuICAgKiBHbG9iYWwgY29uZmlndXJhdGlvbiBmb3Igb21pdHRpbmcgbW9kZWwgZmllbGRzIGJ5IGRlZmF1bHQuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgb21pdDoge1xuICAgKiAgICAgdXNlcjoge1xuICAgKiAgICAgICBwYXNzd29yZDogdHJ1ZVxuICAgKiAgICAgfVxuICAgKiAgIH1cbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBvbWl0PzogR2xvYmFsT21pdENvbmZpZ1xuICAvKipcbiAgICogU1FMIGNvbW1lbnRlciBwbHVnaW5zIHRoYXQgYWRkIG1ldGFkYXRhIHRvIFNRTCBxdWVyaWVzIGFzIGNvbW1lbnRzLlxuICAgKiBDb21tZW50cyBmb2xsb3cgdGhlIHNxbGNvbW1lbnRlciBmb3JtYXQ6IGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9zcWxjb21tZW50ZXIvXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBjb21tZW50czogW1xuICAgKiAgICAgdHJhY2VDb250ZXh0KCksXG4gICAqICAgICBxdWVyeUluc2lnaHRzKCksXG4gICAqICAgXSxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBjb21tZW50cz86IHJ1bnRpbWUuU3FsQ29tbWVudGVyUGx1Z2luW11cbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1heGltdW0gc2l6ZSBmb3IgdGhlIHF1ZXJ5IHBsYW4gY2FjaGUuIElmIG5vdCBwcm92aWRlZCwgYSBkZWZhdWx0IHNpemUgd2lsbCBiZSB1c2VkLlxuICAgKiBBIHZhbHVlIG9mIGAwYCBjYW4gYmUgdXNlZCB0byBkaXNhYmxlIHRoZSBjYWNoZSBlbnRpcmVseS4gQSBoaWdoZXIgY2FjaGUgc2l6ZSBjYW4gaW1wcm92ZVxuICAgKiBwZXJmb3JtYW5jZSBmb3IgYXBwbGljYXRpb25zIHRoYXQgZXhlY3V0ZSBhIGxhcmdlIG51bWJlciBvZiB1bmlxdWUgcXVlcmllcywgd2hpbGUgYSBzbWFsbGVyXG4gICAqIGNhY2hlIHNpemUgY2FuIHJlZHVjZSBtZW1vcnkgdXNhZ2UuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBxdWVyeVBsYW5DYWNoZU1heFNpemU6IDEwMCxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBxdWVyeVBsYW5DYWNoZU1heFNpemU/OiBudW1iZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIGEgZHJpdmVyIGFkYXB0ZXIuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgUHJpc21hIEFjY2VsZXJhdGUgY29ubmVjdGlvbiBVUkwuIFVzZSB0aGlzIG9wdGlvbiB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIHVzaW5nIGEgZHJpdmVyIGFkYXB0ZXIgdG8gY29ubmVjdCBkaXJlY3RseS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAgICovXG4gIGFjY2VsZXJhdGVVcmw6IHN0cmluZ1xuICBhZGFwdGVyPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyLiBUaGlzIGlzIHRoZSBjb21tb24gY2FzZSBpbiBQcmlzbWEgNy5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQSBkcml2ZXIgYWRhcHRlciB0aGF0IFByaXNtYUNsaWVudCB1c2VzIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSwgc3VjaCBhcyB0aGUgb25lcyBwcm92aWRlZCBieSBgQHByaXNtYS9hZGFwdGVyLXBnYCwgYEBwcmlzbWEvYWRhcHRlci1saWJzcWxgLCBgQHByaXNtYS9hZGFwdGVyLXBsYW5ldHNjYWxlYCwgZXRjLlxuICAgKiBcbiAgICogQSBkcml2ZXIgYWRhcHRlciBpcyAqKnJlcXVpcmVkKiogdW5sZXNzIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSAoaW4gd2hpY2ggY2FzZSB1c2UgYGFjY2VsZXJhdGVVcmxgIGluc3RlYWQpLlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gJ0BwcmlzbWEvYWRhcHRlci1wZydcbiAgICogaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudCdcbiAgICogXG4gICAqIGNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSlcbiAgICogYGBgXG4gICAqL1xuICBhZGFwdGVyOiBydW50aW1lLlNxbERyaXZlckFkYXB0ZXJGYWN0b3J5XG4gIGFjY2VsZXJhdGVVcmw/OiBuZXZlclxufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqIFxuICogQSBkcml2ZXIgYWRhcHRlciAob3IsIGFsdGVybmF0aXZlbHksIGEgUHJpc21hIEFjY2VsZXJhdGUgVVJMKSBpcyAqKnJlcXVpcmVkKiouIFNlZSB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyfSBhbmQge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybH0gZm9yIHRoZSB0d28gdmFyaWFudHMuIEFsbCBvdGhlciBwcm9wZXJ0aWVzIGxpdmUgaW4ge0BsaW5rIFByaXNtYUNsaWVudEJhc2VPcHRpb25zfSBhbmQgYXJlIG9wdGlvbmFsLlxuICogXG4gKiBMZWFybiBtb3JlIGFib3V0IGRyaXZlciBhZGFwdGVyczogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgfCBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJcbmV4cG9ydCB0eXBlIEdsb2JhbE9taXRDb25maWcgPSB7XG4gIGJsb2dQb3N0PzogUHJpc21hLkJsb2dQb3N0T21pdFxuICBib29raW5nPzogUHJpc21hLkJvb2tpbmdPbWl0XG4gIGNhdGVnb3J5PzogUHJpc21hLkNhdGVnb3J5T21pdFxuICBjb250YWN0TWVzc2FnZT86IFByaXNtYS5Db250YWN0TWVzc2FnZU9taXRcbiAgcGF5bWVudD86IFByaXNtYS5QYXltZW50T21pdFxuICByZXZpZXc/OiBQcmlzbWEuUmV2aWV3T21pdFxuICB0b3VyUGFja2FnZT86IFByaXNtYS5Ub3VyUGFja2FnZU9taXRcbiAgdXNlcj86IFByaXNtYS5Vc2VyT21pdFxufVxuXG4vKiBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuZXhwb3J0IHR5cGUgTG9nTGV2ZWwgPSAnaW5mbycgfCAncXVlcnknIHwgJ3dhcm4nIHwgJ2Vycm9yJ1xuZXhwb3J0IHR5cGUgTG9nRGVmaW5pdGlvbiA9IHtcbiAgbGV2ZWw6IExvZ0xldmVsXG4gIGVtaXQ6ICdzdGRvdXQnIHwgJ2V2ZW50J1xufVxuXG5leHBvcnQgdHlwZSBDaGVja0lzTG9nTGV2ZWw8VD4gPSBUIGV4dGVuZHMgTG9nTGV2ZWwgPyBUIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIEdldExvZ1R5cGU8VD4gPSBDaGVja0lzTG9nTGV2ZWw8XG4gIFQgZXh0ZW5kcyBMb2dEZWZpbml0aW9uID8gVFsnbGV2ZWwnXSA6IFRcbj47XG5cbmV4cG9ydCB0eXBlIEdldEV2ZW50czxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIEFycmF5PExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbj5cbiAgPyBHZXRMb2dUeXBlPFRbbnVtYmVyXT5cbiAgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgUXVlcnlFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIHF1ZXJ5OiBzdHJpbmdcbiAgcGFyYW1zOiBzdHJpbmdcbiAgZHVyYXRpb246IG51bWJlclxuICB0YXJnZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBMb2dFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICB0YXJnZXQ6IHN0cmluZ1xufVxuLyogRW5kIFR5cGVzIGZvciBMb2dnaW5nICovXG5cblxuZXhwb3J0IHR5cGUgUHJpc21hQWN0aW9uID1cbiAgfCAnZmluZFVuaXF1ZSdcbiAgfCAnZmluZFVuaXF1ZU9yVGhyb3cnXG4gIHwgJ2ZpbmRNYW55J1xuICB8ICdmaW5kRmlyc3QnXG4gIHwgJ2ZpbmRGaXJzdE9yVGhyb3cnXG4gIHwgJ2NyZWF0ZSdcbiAgfCAnY3JlYXRlTWFueSdcbiAgfCAnY3JlYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBkYXRlJ1xuICB8ICd1cGRhdGVNYW55J1xuICB8ICd1cGRhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnZGVsZXRlTWFueSdcbiAgfCAnZXhlY3V0ZVJhdydcbiAgfCAncXVlcnlSYXcnXG4gIHwgJ2FnZ3JlZ2F0ZSdcbiAgfCAnY291bnQnXG4gIHwgJ3J1bkNvbW1hbmRSYXcnXG4gIHwgJ2ZpbmRSYXcnXG4gIHwgJ2dyb3VwQnknXG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgcHJveHkgYXZhaWxhYmxlIGluIGludGVyYWN0aXZlIHRyYW5zYWN0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25DbGllbnQgPSBPbWl0PERlZmF1bHRQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+XG5cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiogVGhpcyBmaWxlIGV4cG9ydHMgYWxsIGVudW0gcmVsYXRlZCB0eXBlcyBmcm9tIHRoZSBzY2hlbWEuXG4qXG4qIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4qL1xuXG5leHBvcnQgY29uc3QgUm9sZSA9IHtcbiAgVVNFUjogJ1VTRVInLFxuICBBR0VOVDogJ0FHRU5UJyxcbiAgQURNSU46ICdBRE1JTidcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUm9sZSA9ICh0eXBlb2YgUm9sZSlba2V5b2YgdHlwZW9mIFJvbGVdXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTdGF0dXMgPSB7XG4gIEFDVElWRTogJ0FDVElWRScsXG4gIFNVU1BFTkRFRDogJ1NVU1BFTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclN0YXR1cyA9ICh0eXBlb2YgVXNlclN0YXR1cylba2V5b2YgdHlwZW9mIFVzZXJTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEF1dGhQcm92aWRlciA9IHtcbiAgQ1JFREVOVElBTDogJ0NSRURFTlRJQUwnLFxuICBHT09HTEU6ICdHT09HTEUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEF1dGhQcm92aWRlciA9ICh0eXBlb2YgQXV0aFByb3ZpZGVyKVtrZXlvZiB0eXBlb2YgQXV0aFByb3ZpZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBQYWNrYWdlU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIEFQUFJPVkVEOiAnQVBQUk9WRUQnLFxuICBSRUpFQ1RFRDogJ1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYWNrYWdlU3RhdHVzID0gKHR5cGVvZiBQYWNrYWdlU3RhdHVzKVtrZXlvZiB0eXBlb2YgUGFja2FnZVN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1N0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBQQUlEOiAnUEFJRCcsXG4gIENPTkZJUk1FRDogJ0NPTkZJUk1FRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIENPTVBMRVRFRDogJ0NPTVBMRVRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1N0YXR1cyA9ICh0eXBlb2YgQm9va2luZ1N0YXR1cylba2V5b2YgdHlwZW9mIEJvb2tpbmdTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTdGF0dXMgPSB7XG4gIElOSVRJQVRFRDogJ0lOSVRJQVRFRCcsXG4gIFNVQ0NFU1M6ICdTVUNDRVNTJyxcbiAgRkFJTEVEOiAnRkFJTEVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgUkVGVU5ERUQ6ICdSRUZVTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFN0YXR1cyA9ICh0eXBlb2YgUGF5bWVudFN0YXR1cylba2V5b2YgdHlwZW9mIFBheW1lbnRTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBvc3RTdGF0dXMgPSB7XG4gIERSQUZUOiAnRFJBRlQnLFxuICBQVUJMSVNIRUQ6ICdQVUJMSVNIRUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBvc3RTdGF0dXMgPSAodHlwZW9mIFBvc3RTdGF0dXMpW2tleW9mIHR5cGVvZiBQb3N0U3RhdHVzXVxuIiwgIi8vIEFwcEVycm9yIGtlZXBzIHRoZSBleGFjdCBzYW1lIFwianVzdCB0aHJvdyBpdFwiIGVyZ29ub21pY3MgYnV0IGNhcnJpZXNcbi8vIGEgc3RhdHVzQ29kZSB0aGUgZ2xvYmFsIGhhbmRsZXIgY2FuIHJlYWQgKHNlZSBtaWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cykuXG5leHBvcnQgY2xhc3MgQXBwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihzdGF0dXNDb2RlOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiQXBwRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tIFwiQHByaXNtYS9hZGFwdGVyLXBnXCI7XG5pbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jb25zdCBjb25uZWN0aW9uU3RyaW5nID0gY29uZmlnLmRhdGFiYXNlX3VybDtcblxuLy8gU2VydmVybGVzcy1mcmllbmRseSBwb29sOiBvbmUgY29ubmVjdGlvbiBwZXIgd2FybSBpbnN0YW5jZSBzbyBtYW55XG4vLyBjb25jdXJyZW50IGludm9jYXRpb25zIGNhbid0IGV4aGF1c3QgdGhlIGRhdGFiYXNlJ3MgY29ubmVjdGlvbiBsaW1pdC5cbi8vIExvY2FsL1ZNIHJ1bnMgYXJlIHVuYWZmZWN0ZWQgKGEgc2luZ2xlIHByb2Nlc3MgdXNlcyBvbmUgY29ubmVjdGlvbiBhbnl3YXkpLlxuY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmcsIG1heDogMSB9KTtcbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pO1xuXG5leHBvcnQgeyBwcmlzbWEgfTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgYXV0aENvbnRyb2xsZXIgfSBmcm9tIFwiLi9hdXRoLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGF1dGhWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2F1dGgudmFsaWRhdGlvblwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIFJlZ2lzdGVyIFx1MjAxNCByb2xlIGlzIG9wdGlvbmFsIGFuZCByZXN0cmljdGVkIHRvIFVTRVIvQUdFTlQgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wb3N0KFxuICBcIi9yZWdpc3RlclwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVnaXN0ZXJTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZ2lzdGVyVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMubG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmxvZ2luVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9nb29nbGVcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmdvb2dsZUxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5nb29nbGVMb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9kZW1vLWxvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5kZW1vTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmRlbW9Mb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZWZyZXNoXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWZyZXNoVG9rZW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZnJlc2hUb2tlbixcbik7XG5cbnJvdXRlci5wb3N0KFwiL2xvZ291dFwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmxvZ291dFVzZXIpO1xuXG5yb3V0ZXIuZ2V0KFwiL21lXCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIuZ2V0TWUpO1xuXG5leHBvcnQgY29uc3QgYXV0aFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuXG4vLyBEZXYgKGxvY2FsaG9zdDozMDAwIFx1MjE5MiA6NDAwMCkgaXMgc2FtZS1zaXRlIFx1MjE5MiBsYXggd29ya3Mgd2l0aCBzZWN1cmU6ZmFsc2UuXG4vLyBQcm9kIChjcm9zcy1zaXRlIGZyb250ZW5kL2JhY2tlbmQpIHJlcXVpcmVzIFNhbWVTaXRlPU5vbmUgKyBTZWN1cmUuXG5jb25zdCBjb29raWVPcHRpb25zOiB7XG4gIGh0dHBPbmx5OiB0cnVlO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNhbWVTaXRlOiBcImxheFwiIHwgXCJub25lXCI7XG59ID0ge1xuICBodHRwT25seTogdHJ1ZSxcbiAgc2VjdXJlOiBpc1Byb2R1Y3Rpb24sXG4gIHNhbWVTaXRlOiBpc1Byb2R1Y3Rpb24gPyBcIm5vbmVcIiA6IFwibGF4XCIsXG59O1xuXG5jb25zdCBBQ0NFU1NfQ09PS0lFX01BWF9BR0UgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAxIGRheVxuY29uc3QgUkVGUkVTSF9DT09LSUVfTUFYX0FHRSA9IDMwICogMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMzAgZGF5c1xuXG5jb25zdCBzZXRBdXRoQ29va2llcyA9IChcbiAgcmVzOiBSZXNwb25zZSxcbiAgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH06IHsgYWNjZXNzVG9rZW46IHN0cmluZzsgcmVmcmVzaFRva2VuOiBzdHJpbmcgfSxcbikgPT4ge1xuICByZXMuY29va2llKFwiYWNjZXNzVG9rZW5cIiwgYWNjZXNzVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogQUNDRVNTX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbiAgcmVzLmNvb2tpZShcInJlZnJlc2hUb2tlblwiLCByZWZyZXNoVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogUkVGUkVTSF9DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG59O1xuXG5jb25zdCBjbGVhckF1dGhDb29raWVzID0gKHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKFwiYWNjZXNzVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG4gIHJlcy5jbGVhckNvb2tpZShcInJlZnJlc2hUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbn07XG5cbi8vIFJlZ2lzdGVyIGNvbnRyb2xsZXJcbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5yZWdpc3RlclVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBSZWdpc3RlcmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dpbiBjb250cm9sbGVyXG5jb25zdCBsb2dpblVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ2luVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KVxuY29uc3QgZ29vZ2xlTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdvb2dsZUxvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZW1vIGxvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGRlbW9Mb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZGVtb0xvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRlbW8gdXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlZnJlc2ggdG9rZW4gY29udHJvbGxlclxuY29uc3QgcmVmcmVzaFRva2VuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUNvb2tpZSA9IHJlcS5jb29raWVzLnJlZnJlc2hUb2tlbjtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQm9keSA9IHJlcS5ib2R5Py5yZWZyZXNoVG9rZW47XG5cbiAgICBpZiAoIXJlZnJlc2hUb2tlbkZyb21Db29raWUgJiYgIXJlZnJlc2hUb2tlbkZyb21Cb2R5KSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQsXG4gICAgICAgIG1lc3NhZ2U6IFwiUmVmcmVzaCB0b2tlbiBpcyByZXF1aXJlZFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSA9XG4gICAgICBhd2FpdCBhdXRoU2VydmljZS5yZWZyZXNoVG9rZW4oe1xuICAgICAgICByZWZyZXNoVG9rZW46IHJlZnJlc2hUb2tlbkZyb21Db29raWUgfHwgcmVmcmVzaFRva2VuRnJvbUJvZHksXG4gICAgICB9KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbixcbiAgICB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJUb2tlbiByZWZyZXNoZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9nb3V0IGNvbnRyb2xsZXJcbmNvbnN0IGxvZ291dFVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgYXdhaXQgYXV0aFNlcnZpY2UubG9nb3V0KHVzZXJJZCk7XG4gICAgY2xlYXJBdXRoQ29va2llcyhyZXMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIG91dCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgTWUgY29udHJvbGxlclxuY29uc3QgZ2V0TWUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdldE1lRnJvbURCKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aENvbnRyb2xsZXIgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dFVzZXIsXG4gIGdldE1lLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgZ29vZ2xlQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2xpYi9nb29nbGVBdXRoXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvand0XCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElBdXRoLFxuICBJRGVtb0xvZ2luUGF5bG9hZCxcbiAgSUdvb2dsZUxvZ2luUGF5bG9hZCxcbiAgSUxvZ2luVXNlcixcbiAgSVJlZnJlc2hUb2tlblBheWxvYWQsXG59IGZyb20gXCIuL2F1dGguaW50ZXJmYWNlXCI7XG5cbmNvbnN0IGJ1aWxkVG9rZW5QYXlsb2FkID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+ICh7XG4gIGlkOiB1c2VyLmlkLFxuICBuYW1lOiB1c2VyLm5hbWUsXG4gIGVtYWlsOiB1c2VyLmVtYWlsLFxuICByb2xlOiB1c2VyLnJvbGUsXG4gIHRva2VuVmVyc2lvbjogdXNlci50b2tlblZlcnNpb24sXG59KTtcblxuY29uc3QgaXNzdWVUb2tlbnMgPSAodXNlcjoge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHJvbGU6IFJvbGU7XG4gIHRva2VuVmVyc2lvbjogbnVtYmVyO1xufSkgPT4ge1xuICBjb25zdCB0b2tlblBheWxvYWQgPSBidWlsZFRva2VuUGF5bG9hZCh1c2VyKTtcblxuICBjb25zdCBhY2Nlc3NUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfYWNjZXNzX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgcmVmcmVzaFRva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfcmVmcmVzaF9leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG5cbiAgcmV0dXJuIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9O1xufTtcblxuY29uc3Qgc2FuaXRpemVVc2VyID0gPFQgZXh0ZW5kcyB7IHBhc3N3b3JkOiBzdHJpbmcgfCBudWxsIH0+KHVzZXI6IFQpID0+IHtcbiAgY29uc3QgeyBwYXNzd29yZCwgLi4ucmVzdCB9ID0gdXNlcjtcbiAgcmV0dXJuIHJlc3Q7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVnaXN0ZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWdpc3RlclVzZXIgPSBhc3luYyAocGF5bG9hZDogSUF1dGgpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBlbWFpbCwgcGFzc3dvcmQsIHBob25lLCByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIC8vIE9ubHkgdXNlcnMvYWdlbnRzIGNhbiBzZWxmLXJlZ2lzdGVyOyBhZG1pbnMgYXJlIGNyZWF0ZWQgdmlhIGRlbW8tbG9naW4vc2VlZFxuICBpZiAocm9sZSAmJiByb2xlICE9PSBcIlVTRVJcIiAmJiByb2xlICE9PSBcIkFHRU5UXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJvbGUgbXVzdCBiZSBlaXRoZXIgVVNFUiBvciBBR0VOVFwiKTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJVc2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgcGFzc3dvcmQsXG4gICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICApO1xuXG4gIGNvbnN0IGNyZWF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lLFxuICAgICAgZW1haWwsXG4gICAgICBwYXNzd29yZDogaGFzaGVkUGFzc3dvcmQsXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZTogcm9sZSB8fCBcIlVTRVJcIixcbiAgICAgIHBob25lLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gY3JlYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9naW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dpblVzZXIgPSBhc3luYyAocGF5bG9hZDogSUxvZ2luVXNlcikgPT4ge1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJUaGlzIGFjY291bnQgdXNlcyBHb29nbGUgbG9naW4uIFBsZWFzZSBsb2cgaW4gd2l0aCBHb29nbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKHBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ29vZ2xlTG9naW4gPSBhc3luYyAocGF5bG9hZDogSUdvb2dsZUxvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IGlkVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgaWYgKCFjb25maWcuZ29vZ2xlX2NsaWVudF9pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiR29vZ2xlIGxvZ2luIGlzIG5vdCBjb25maWd1cmVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgICk7XG4gIH1cblxuICBsZXQgdGlja2V0O1xuICB0cnkge1xuICAgIHRpY2tldCA9IGF3YWl0IGdvb2dsZUNsaWVudC52ZXJpZnlJZFRva2VuKHtcbiAgICAgIGlkVG9rZW4sXG4gICAgICBhdWRpZW5jZTogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBHb29nbGUgdG9rZW5cIik7XG4gIH1cblxuICBjb25zdCBnb29nbGVEYXRhID0gdGlja2V0LmdldFBheWxvYWQoKTtcbiAgaWYgKCFnb29nbGVEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlbiBwYXlsb2FkXCIpO1xuICB9XG5cbiAgY29uc3QgeyBlbWFpbCwgbmFtZSwgc3ViLCBwaWN0dXJlIH0gPSBnb29nbGVEYXRhO1xuXG4gIGlmICghZW1haWwgfHwgIWdvb2dsZURhdGEuZW1haWxfdmVyaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkdvb2dsZSBhY2NvdW50IGVtYWlsIGlzIG5vdCB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGxldCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGdvb2dsZUlkOiBzdWIgfSB9KTtcblxuICAvLyBFeGlzdGluZyB1c2VyIFx1MjE5MiBsaW5rIEdvb2dsZSBhY2NvdW50IGlmIG5vdCBhbHJlYWR5IGxpbmtlZFxuICBpZiAoIXVzZXIgJiYgZW1haWwpIHtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGlmICh1c2VyLmdvb2dsZUlkICYmIHVzZXIuZ29vZ2xlSWQgIT09IHN1Yikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiRW1haWwgaXMgYWxyZWFkeSBsaW5rZWQgdG8gYW5vdGhlciBHb29nbGUgYWNjb3VudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiB1c2VyLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgZ29vZ2xlSWQ6IHN1YiwgZW1haWxWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnJhbmQgbmV3IHVzZXJcbiAgaWYgKCF1c2VyKSB7XG4gICAgY29uc3QgbG9jYWxQYXJ0ID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdID8/IGVtYWlsO1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gKG5hbWUgPz8gXCJcIikudHJpbSgpIHx8IGxvY2FsUGFydDtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgZW1haWwsXG4gICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgYXV0aFByb3ZpZGVyOiBcIkdPT0dMRVwiLFxuICAgICAgICBnb29nbGVJZDogc3ViLFxuICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICByb2xlOiBcIlVTRVJcIixcbiAgICAgICAgYXZhdGFyVXJsOiBwaWN0dXJlIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdG9rZW5zID0gaXNzdWVUb2tlbnModXNlciEpO1xuICBjb25zdCBzYW5pdGl6ZWRVc2VyID0gc2FuaXRpemVVc2VyKHVzZXIhKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IHNhbml0aXplZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBEZW1vIGxvZ2luIChncmFkaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IERFTU9fUEFTU1dPUkQgPSBcImRlbW8xMjNcIjtcblxuY29uc3QgZGVtb0xvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElEZW1vTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBkZW1vVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCB9LFxuICAgIC8vIHJlc3VycmVjdCBkZW1vIGFjY291bnRzIHRoYXQgYW4gYWRtaW4gc3VzcGVuZGVkIG9yIHNvZnQtZGVsZXRlZFxuICAgIHVwZGF0ZTogeyBzdGF0dXM6IFwiQUNUSVZFXCIsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG5hbWU6IGBEZW1vICR7cm9sZS5jaGFyQXQoMCkgKyByb2xlLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAsXG4gICAgICBwYXNzd29yZDogYXdhaXQgYmNyeXB0Lmhhc2goREVNT19QQVNTV09SRCwgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpKSxcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICByb2xlLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgLi4uaXNzdWVUb2tlbnMoZGVtb1VzZXIpLCB1c2VyOiBkZW1vVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnJlc2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWZyZXNoVG9rZW4gPSBhc3luYyAocGF5bG9hZDogSVJlZnJlc2hUb2tlblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByZWZyZXNoVG9rZW46IHByb3ZpZGVkUmVmcmVzaFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHZlcmlmaWVkID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgcHJvdmlkZWRSZWZyZXNoVG9rZW4sXG4gICAgY29uZmlnLmp3dF9yZWZyZXNoX3NlY3JldCxcbiAgKTtcblxuICBpZiAoIXZlcmlmaWVkLnN1Y2Nlc3MpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZC5lcnJvcik7XG4gIH1cblxuICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb246IHRva2VuVG9rZW5WZXJzaW9uIH0gPVxuICAgIHZlcmlmaWVkLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHsgdG9rZW5WZXJzaW9uOiBudW1iZXIgfTtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuXG4gIC8vIHRva2VuVmVyc2lvbiBjaGFuZ2VkIFx1MjE5MiB0b2tlbnMgd2VyZSByZXZva2VkIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2UpXG4gIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5Ub2tlblZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlRva2VuIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dvdXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dvdXQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgZGF0YTogeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgfSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR2V0IG1lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TWVGcm9tREIgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCBhdXRoU2VydmljZSA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IGp3dCwgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcblxuY29uc3QgY3JlYXRlVG9rZW4gPSAoXG4gIHBheWxvYWQ6IEp3dFBheWxvYWQsXG4gIHNlY3JldDogc3RyaW5nLFxuICBleHBpcmVzSW46IFNpZ25PcHRpb25zLFxuKSA9PiB7XG4gIGNvbnN0IHRva2VuID0gand0LnNpZ24ocGF5bG9hZCwgc2VjcmV0LCBleHBpcmVzSW4pO1xuXG4gIHJldHVybiB0b2tlbjtcbn07XG5cbmNvbnN0IHZlcmlmeVRva2VuID0gKHRva2VuOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dC52ZXJpZnkodG9rZW4sIHNlY3JldCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiB2ZXJpZmllZFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhcIlRva2VuIFZlcmlmaWNhdGlvbiBGYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICB9O1xuICB9XG59O1xuXG5leHBvcnQgY29uc3Qgand0VXRpbHMgPSB7XG4gIGNyZWF0ZVRva2VuLFxuICB2ZXJpZnlUb2tlbixcbn07XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXF1ZXN0SGFuZGxlciwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgY2F0Y2hBc3luYyA9IChmbjogUmVxdWVzdEhhbmRsZXIpID0+IHtcbiAgcmV0dXJuIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmbihyZXEsIHJlcywgbmV4dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn07XG4iLCAiaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG50eXBlIFRNZXRhID0ge1xuICBwYWdlOiBudW1iZXI7XG4gIGxpbWl0OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHRvdGFsUGFnZXM6IG51bWJlcjtcbn07XG5cbnR5cGUgVFJlc3BvbnNlRGF0YTxUPiA9IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGRhdGE6IFQ7XG4gIG1ldGE/OiBUTWV0YTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVzcG9uc2UgPSA8VD4ocmVzOiBSZXNwb25zZSwgZGF0YTogVFJlc3BvbnNlRGF0YTxUPikgPT4ge1xuICByZXMuc3RhdHVzKGRhdGEuc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZGF0YS5zdWNjZXNzLFxuICAgIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcbiAgICBkYXRhOiBkYXRhLmRhdGEsXG4gICAgbWV0YTogZGF0YS5tZXRhLFxuICB9KTtcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCByZWdpc3RlclNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbiAgcGhvbmU6IHpcbiAgICAuc3RyaW5nKClcbiAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgIC5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBsb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBnb29nbGVMb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWRUb2tlbjogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJHb29nbGUgaWRUb2tlbiBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBkZW1vTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIsXG4gIH0pLFxufSk7XG5cbi8vIHJlZnJlc2hUb2tlbiBtYXkgY29tZSBmcm9tIHRoZSBodHRwT25seSBjb29raWUgT1IgdGhlIHJlcXVlc3QgYm9keSBcdTIwMTRcbi8vIHZhbGlkYXRpb24gaXMgbGVuaWVudCBoZXJlOyB0aGUgY29udHJvbGxlciBoYW5kbGVzIGJvdGggc291cmNlcy5cbmNvbnN0IHJlZnJlc2hUb2tlblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcmVmcmVzaFRva2VuOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRSZWdpc3RlclNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZ2lzdGVyU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHb29nbGVMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdvb2dsZUxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZWZyZXNoVG9rZW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWZyZXNoVG9rZW5TY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYXV0aFZhbGlkYXRpb25zID0ge1xuICByZWdpc3RlclNjaGVtYSxcbiAgbG9naW5TY2hlbWEsXG4gIGdvb2dsZUxvZ2luU2NoZW1hLFxuICBkZW1vTG9naW5TY2hlbWEsXG4gIHJlZnJlc2hUb2tlblNjaGVtYSxcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgWm9kVHlwZSB9IGZyb20gXCJ6b2RcIjtcblxudHlwZSBWYWxpZGF0aW9uU2NoZW1hID0ge1xuICBib2R5PzogWm9kVHlwZTtcbiAgcXVlcnk/OiBab2RUeXBlO1xuICBwYXJhbXM/OiBab2RUeXBlO1xufTtcblxuLy8gUnVucyBab2Qgc2NoZW1hcyBhZ2FpbnN0IHJlcS5ib2R5L3F1ZXJ5L3BhcmFtcyBhbmQgcmVwbGFjZXMgdGhlIHBhcnNlZFxuLy8gdmFsdWVzIHNvIGRvd25zdHJlYW0gaGFuZGxlcnMgd29yayB3aXRoIHZhbGlkYXRlZCAoYW5kIHR5cGVkKSBkYXRhLlxuLy8gQW55IFpvZEVycm9yIHRocm93biBoZXJlIGlzIG1hcHBlZCB0byBhIDQwMCBieSBnbG9iYWxFcnJvckhhbmRsZXIuXG4vL1xuLy8gcmVxLmJvZHkgaXMgc2FmZWx5IHdyaXRhYmxlLCBidXQgaW4gRXhwcmVzcyA1IHJlcS5xdWVyeS9yZXEucGFyYW1zIGFyZVxuLy8gZ2V0dGVyLW9ubHkgXHUyMDE0IHRoZXkgbXVzdCBiZSByZWRlZmluZWQgdmlhIGRlZmluZVByb3BlcnR5IHRvIHN3YXAgaW4gdGhlXG4vLyBwYXJzZWQgdmFsdWVzLlxuY29uc3QgdmFsaWRhdGVSZXF1ZXN0ID0gKHNjaGVtYTogVmFsaWRhdGlvblNjaGVtYSkgPT4ge1xuICByZXR1cm4gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKHNjaGVtYS5ib2R5KSB7XG4gICAgICByZXEuYm9keSA9IHNjaGVtYS5ib2R5LnBhcnNlKHJlcS5ib2R5KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5xdWVyeSkge1xuICAgICAgY29uc3QgcGFyc2VkUXVlcnkgPSBzY2hlbWEucXVlcnkucGFyc2UocmVxLnF1ZXJ5KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicXVlcnlcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUXVlcnksXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFBhcmFtcyA9IHNjaGVtYS5wYXJhbXMucGFyc2UocmVxLnBhcmFtcyk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInBhcmFtc1wiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRQYXJhbXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB2YWxpZGF0ZVJlcXVlc3Q7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgSnd0UGF5bG9hZCB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vdXRpbHMvand0XCI7XG5cbi8vIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTikgXHUyMTkyIG9ubHkgdGhvc2Ugcm9sZXMgcGFzc1xuLy8gYXV0aCgpIFx1MjE5MiBhbnkgYXV0aGVudGljYXRlZCB1c2VyIHBhc3Nlc1xuY29uc3QgYXV0aCA9ICguLi5yZXF1aXJlZFJvbGVzOiBSb2xlW10pID0+IHtcbiAgcmV0dXJuIGNhdGNoQXN5bmMoYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgPyByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uPy5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKVxuICAgICAgICA/IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24uc3BsaXQoXCIgXCIpWzFdXG4gICAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIC8vIDEuIHRva2VuIG11c3QgYmUgcHJlc2VudFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyAyLiB2ZXJpZnkgdGhlIGFjY2VzcyB0b2tlblxuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICAgIHRva2VuLFxuICAgICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgICk7XG5cbiAgICBpZiAoIXZlcmlmaWVkVG9rZW4uc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWRUb2tlbi5lcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uIH0gPSB2ZXJpZmllZFRva2VuLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHtcbiAgICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAzLiByZS1mZXRjaCB1c2VyIHRvIGVuZm9yY2UgYWNjb3VudCBzdGF0ZSBvbiBldmVyeSByZXF1ZXN0XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA0LiB0b2tlblZlcnNpb24gbXVzdCBtYXRjaCBEQiAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlIGtpbGxzIG9sZCB0b2tlbnMpXG4gICAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIlNlc3Npb24gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDUuIGF1dGhvcml6YXRpb24gdXNlcyB0aGUgREIgcm9sZSwgbm90IHRoZSAocG9zc2libHkgc3RhbGUpIEpXVCByb2xlXG4gICAgaWYgKHJlcXVpcmVkUm9sZXMubGVuZ3RoICYmICFyZXF1aXJlZFJvbGVzLmluY2x1ZGVzKHVzZXIucm9sZSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gYWNjZXNzIHRoaXMgcm91dGUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDYuIGF0dGFjaCB0aGUgYXV0aGVudGljYXRlZCB1c2VyIHRvIHRoZSByZXF1ZXN0XG4gICAgcmVxLnVzZXIgPSB7XG4gICAgICBpZDogdXNlci5pZCxcbiAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgIH07XG5cbiAgICBuZXh0KCk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXV0aDsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHVzZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vdXNlci5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB1c2VyVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi91c2VyLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE93biBwcm9maWxlIFx1MjAxNCBhbnkgYXV0aGVudGljYXRlZCB1c2VyXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3Byb2ZpbGVcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB1c2VyVmFsaWRhdGlvbnMudXBkYXRlUHJvZmlsZVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIudXBkYXRlUHJvZmlsZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBsaXN0IHVzZXJzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb25cbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogdXNlclZhbGlkYXRpb25zLnVzZXJRdWVyeVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZ2V0VXNlcnMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgcm9sZSBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yb2xlXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlUm9sZVNjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVJvbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc3RhdHVzIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVN0YXR1cyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzb2Z0IGRlbGV0ZVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmRlbGV0ZVVzZXIsXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlclJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVzZXJTZXJ2aWNlIH0gZnJvbSBcIi4vdXNlci5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gVXBkYXRlIHByb2ZpbGUgY29udHJvbGxlclxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UudXBkYXRlUHJvZmlsZSh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQcm9maWxlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgdXNlcnMgKGFkbWluKVxuY29uc3QgZ2V0VXNlcnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyU2VydmljZS5nZXRVc2VycyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXJzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHJvbGUgKGFkbWluKVxuY29uc3QgY2hhbmdlUm9sZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZG93bmdyYWRlL2NoYW5nZSB0aGVpciBvd24gcm9sZVxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gcm9sZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VSb2xlKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciByb2xlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWRtaW4pXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IHN1c3BlbmQvYWN0aXZhdGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHN0YXR1cy5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBTb2Z0IGRlbGV0ZSB1c2VyIChhZG1pbilcbmNvbnN0IGRlbGV0ZVVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRlbGV0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBkZWxldGUgeW91ciBvd24gYWNjb3VudC5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5kZWxldGVVc2VyKGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyQ29udHJvbGxlciA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElDaGFuZ2VSb2xlLFxuICBJQ2hhbmdlU3RhdHVzLFxuICBJVXBkYXRlUHJvZmlsZSxcbiAgSVVzZXJRdWVyeSxcbn0gZnJvbSBcIi4vdXNlci5pbnRlcmZhY2VcIjtcblxuY29uc3QgdmFsaWRhdGVBY3RpdmVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZSBwcm9maWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZVByb2ZpbGUpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwaG9uZSwgYXZhdGFyVXJsLCBjdXJyZW50UGFzc3dvcmQsIG5ld1Bhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiB1c2VySWQgfSB9KTtcblxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDMsXG4gICAgICBcIkdvb2dsZSBhY2NvdW50cyBjYW5ub3QgY2hhbmdlIHBhc3N3b3JkLiBVc2UgR29vZ2xlIHNpZ24taW4gdG8gbWFuYWdlIHlvdXIgcHJvZmlsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlVzZXJVcGRhdGVJbnB1dCA9IHt9O1xuXG4gIGlmIChuYW1lKSBkYXRhLm5hbWUgPSBuYW1lO1xuICBpZiAocGhvbmUpIGRhdGEucGhvbmUgPSBwaG9uZTtcbiAgaWYgKGF2YXRhclVybCkgZGF0YS5hdmF0YXJVcmwgPSBhdmF0YXJVcmw7XG5cbiAgLy8gUGFzc3dvcmQgY2hhbmdlIHJlcXVpcmVzIGN1cnJlbnRQYXNzd29yZCArIG5ld1Bhc3N3b3JkXG4gIGlmIChuZXdQYXNzd29yZCkge1xuICAgIGlmICghY3VycmVudFBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGFzc3dvcmQgPT09IG5ld1Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIk5ldyBwYXNzd29yZCBtdXN0IGJlIGRpZmZlcmVudFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc01hdGNoID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3VycmVudFBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICAgIGlmICghaXNNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGN1cnJlbnQgcGFzc3dvcmRcIik7XG4gICAgfVxuXG4gICAgZGF0YS5wYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgICAgbmV3UGFzc3dvcmQsXG4gICAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICAgKTtcbiAgICBkYXRhLnRva2VuVmVyc2lvbiA9IHsgaW5jcmVtZW50OiAxIH07XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGEsXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGxpc3QgdXNlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRVc2VycyA9IGFzeW5jIChxdWVyeTogSVVzZXJRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVXNlcldoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUuT1IgPSBbXG4gICAgICB7IG5hbWU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIHsgZW1haWw6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICBdO1xuICB9XG4gIGlmIChxdWVyeS5yb2xlKSB3aGVyZS5yb2xlID0gcXVlcnkucm9sZTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IHVzZXJzLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlUm9sZSA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlUm9sZSkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgYXdhaXQgdmFsaWRhdGVBY3RpdmVVc2VyKGlkKTtcblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IHJvbGUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlU3RhdHVzID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VTdGF0dXMpID0+IHtcbiAgY29uc3QgeyBzdGF0dXMgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YToge1xuICAgICAgc3RhdHVzLFxuICAgICAgLy8gcmVhY3RpdmF0aW5nIHByZXNlcnZlcyB0aGUgYWNjb3VudCB3aGlsZSBzdXNwZW5kaW5nIHJldm9rZXMgYWxsIHNlc3Npb25zXG4gICAgICAuLi4oc3RhdHVzID09PSBVc2VyU3RhdHVzLlNVU1BFTkRFRCAmJiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9KSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBzb2Z0IGRlbGV0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGRlbGV0ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCBkZWxldGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gZGVsZXRlZFVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlclNlcnZpY2UgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBwaG9uZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgYXZhdGFyVXJsOiB6LnN0cmluZygpLnRyaW0oKS51cmwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGltYWdlIFVSTFwiKS5vcHRpb25hbCgpLFxuICAgIGN1cnJlbnRQYXNzd29yZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBuZXdQYXNzd29yZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKFxuICAgIChkYXRhKSA9PlxuICAgICAgZGF0YS5uZXdQYXNzd29yZCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBkYXRhLmN1cnJlbnRQYXNzd29yZCAhPT0gdW5kZWZpbmVkLFxuICAgIHsgbWVzc2FnZTogXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkIHRvIGNoYW5nZSBwYXNzd29yZFwiIH0sXG4gICk7XG5cbmNvbnN0IHVzZXJRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1c2VyUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJVc2VyIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGNoYW5nZVJvbGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7IHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiIH0pLFxufSk7XG5cbmNvbnN0IGNoYW5nZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRVcGRhdGVQcm9maWxlU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlUHJvZmlsZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXNlclF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXNlclF1ZXJ5U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHVzZXJWYWxpZGF0aW9ucyA9IHtcbiAgdXBkYXRlUHJvZmlsZVNjaGVtYSxcbiAgdXNlclF1ZXJ5U2NoZW1hLFxuICB1c2VyUGFyYW1zU2NoZW1hLFxuICBjaGFuZ2VSb2xlU2NoZW1hLFxuICBjaGFuZ2VTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB7IHVwbG9hZHNDb250cm9sbGVyIH0gZnJvbSBcIi4vdXBsb2Fkcy5jb250cm9sbGVyXCI7XG5cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7XG4gIHN0b3JhZ2U6IG11bHRlci5tZW1vcnlTdG9yYWdlKCksXG4gIGxpbWl0czogeyBmaWxlU2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0sXG4gIGZpbGVGaWx0ZXI6IChfcmVxLCBmaWxlLCBjYikgPT4ge1xuICAgIGlmICgvXmltYWdlXFwvKGpwZWd8cG5nfHdlYnApJC8udGVzdChmaWxlLm1pbWV0eXBlKSkge1xuICAgICAgY2IobnVsbCwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKFxuICAgICAgICBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihcIk9ubHkganBnLCBwbmcgb3Igd2VicCBpbWFnZXMgYXJlIGFsbG93ZWRcIiksIHtcbiAgICAgICAgICBjb2RlOiBcIklOVkFMSURfRklMRV9UWVBFXCIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0sXG59KTtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9pbWFnZVwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB1cGxvYWQuc2luZ2xlKFwiaW1hZ2VcIiksXG4gIHVwbG9hZHNDb250cm9sbGVyLnVwbG9hZEltYWdlLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5IH0gZnJvbSBcIi4vdXBsb2Fkcy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFVwbG9hZCBhIHNpbmdsZSBpbWFnZSAoQUdFTlQvQURNSU4pIFx1MjE5MiBDbG91ZGluYXJ5XG5jb25zdCB1cGxvYWRJbWFnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmICghcmVxLmZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgZmlsZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeShyZXEuZmlsZSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJJbWFnZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2Fkc0NvbnRyb2xsZXIgPSB7XG4gIHVwbG9hZEltYWdlLFxufTsiLCAiaW1wb3J0IHsgdjIgYXMgY2xvdWRpbmFyeSB9IGZyb20gXCJjbG91ZGluYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY2xvdWRpbmFyeS5jb25maWcoe1xuICBjbG91ZF9uYW1lOiBjb25maWcuY2xvdWRpbmFyeV9jbG91ZF9uYW1lLFxuICBhcGlfa2V5OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfa2V5LFxuICBhcGlfc2VjcmV0OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfc2VjcmV0LFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsb3VkaW5hcnk7IiwgImltcG9ydCBjbG91ZGluYXJ5IGZyb20gXCIuLi8uLi9saWIvY2xvdWRpbmFyeVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5ID0gKFxuICBmaWxlOiBFeHByZXNzLk11bHRlci5GaWxlLFxuKTogUHJvbWlzZTx7IHVybDogc3RyaW5nOyBwdWJsaWNJZDogc3RyaW5nIH0+ID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cGxvYWRTdHJlYW0gPSBjbG91ZGluYXJ5LnVwbG9hZGVyLnVwbG9hZF9zdHJlYW0oXG4gICAgICB7IGZvbGRlcjogXCJ0cmlwdmVyc2VcIiB9LFxuICAgICAgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIHx8ICFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSB1cGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLlwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoeyB1cmw6IHJlc3VsdC5zZWN1cmVfdXJsLCBwdWJsaWNJZDogcmVzdWx0LnB1YmxpY19pZCB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZFN0cmVhbS5lbmQoZmlsZS5idWZmZXIpO1xuICB9KTtcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjb250YWN0Q29udHJvbGxlciB9IGZyb20gXCIuL2NvbnRhY3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY29udGFjdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY29udGFjdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jcmVhdGVNZXNzYWdlU2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5jcmVhdGVNZXNzYWdlLFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFF1ZXJ5U2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5nZXRNZXNzYWdlcyxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMudXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG4gIH0pLFxuICBjb250YWN0Q29udHJvbGxlci51cGRhdGVSZXNvbHZlZCxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tIFwiLi9jb250YWN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UuY3JlYXRlTWVzc2FnZShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHNlbnQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgZ2V0TWVzc2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250YWN0U2VydmljZS5saXN0TWVzc2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb250YWN0IG1lc3NhZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCB1cGRhdGVSZXNvbHZlZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHsgaXNSZXNvbHZlZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UucmVzb2x2ZU1lc3NhZ2UoaWQsIGlzUmVzb2x2ZWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXMsXG4gIHVwZGF0ZVJlc29sdmVkLFxufTsiLCAiaW1wb3J0IHsgUmVzZW5kIH0gZnJvbSBcInJlc2VuZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGFjdEVtYWlsRGV0YWlscyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdD86IERhdGU7XG59XG5cbi8vIExhemlseSBpbml0aWFsaXNlZCBzbyB0aGUgbW9kdWxlIGlzIGltcG9ydGFibGUgZXZlbiB3aGVuIFJFU0VORF9BUElfS0VZXG4vLyBpcyBub3QgY29uZmlndXJlZCAoZS5nLiBsb2NhbCBkZXYgLyBkZW1vIHdpdGhvdXQgZW1haWwpLlxubGV0IHJlc2VuZDogUmVzZW5kIHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFJlc2VuZCgpOiBSZXNlbmQgfCBudWxsIHtcbiAgaWYgKHJlc2VuZCkgcmV0dXJuIHJlc2VuZDtcbiAgaWYgKCFjb25maWcucmVzZW5kX2FwaV9rZXkpIHJldHVybiBudWxsO1xuICByZXNlbmQgPSBuZXcgUmVzZW5kKGNvbmZpZy5yZXNlbmRfYXBpX2tleSk7XG4gIHJldHVybiByZXNlbmQ7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiYjMDM5O1wiKTtcbn1cblxuY29uc3QgZW1haWxMYXlvdXQgPSAoY29udGVudDogc3RyaW5nKSA9PiBgXG4gIDxkaXYgc3R5bGU9XCJmb250LWZhbWlseTogQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZjsgbWF4LXdpZHRoOiA1NjBweDsgbWFyZ2luOiAwIGF1dG87IGNvbG9yOiAjMWExYTFhO1wiPlxuICAgIDxkaXYgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjMGY3NjZlOyBwYWRkaW5nOiAyNHB4OyBib3JkZXItcmFkaXVzOiA4cHggOHB4IDAgMDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICNmZmZmZmY7IGZvbnQtc2l6ZTogMThweDsgZm9udC13ZWlnaHQ6IGJvbGQ7XCI+VHJpcFZlcnNlPC9zcGFuPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZCAjZTVlN2ViOyBib3JkZXItdG9wOiBub25lOyBwYWRkaW5nOiAzMnB4OyBib3JkZXItcmFkaXVzOiAwIDAgOHB4IDhweDtcIj5cbiAgICAgICR7Y29udGVudH1cbiAgICA8L2Rpdj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTJweDsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7IHRleHQtYWxpZ246IGNlbnRlcjtcIj5cbiAgICAgIFlvdSBhcmUgcmVjZWl2aW5nIHRoaXMgZW1haWwgYmVjYXVzZSBvZiBhY3Rpdml0eSBvbiBUcmlwVmVyc2UuXG4gICAgPC9wPlxuICA8L2Rpdj5cbmA7XG5cbi8vIE5vdGlmaWVzIHRoZSBzdXBwb3J0IGluYm94IGFib3V0IGEgbmV3IGNvbnRhY3QgZm9ybSBzdWJtaXNzaW9uLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0Tm90aWZpY2F0aW9uID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3Qgbm90aWZpY2F0aW9uLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmcm9tID0gY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIjtcbiAgY29uc3QgY3JlYXRlZEF0ID0gZGV0YWlscy5jcmVhdGVkQXQ/LnRvSVNPU3RyaW5nKCkgPz8gXCJqdXN0IG5vd1wiO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPk5ldyBjb250YWN0IG1lc3NhZ2U8L2gyPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPk5hbWU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+RW1haWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5lbWFpbCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5TdWJqZWN0PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlY2VpdmVkPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGNyZWF0ZWRBdCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogMTZweDsgcGFkZGluZzogMTZweDsgYmFja2dyb3VuZDogI2Y5ZmFmYjsgYm9yZGVyLXJhZGl1czogNnB4OyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XCI+XG4gICAgICAke2VzY2FwZUh0bWwoZGV0YWlscy5tZXNzYWdlKX1cbiAgICA8L2Rpdj5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbF0sXG4gICAgc3ViamVjdDogYE5ldyBjb250YWN0IG1lc3NhZ2U6ICR7ZGV0YWlscy5zdWJqZWN0fWAsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gU2VuZHMgYSBjb25maXJtYXRpb24gcmVwbHkgdG8gdGhlIHBlcnNvbiB3aG8gc3VibWl0dGVkIHRoZSBmb3JtLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0QXV0b1JlcGx5ID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgY29udGFjdCBhdXRvLXJlcGx5LlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmcm9tID0gY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIjtcbiAgY29uc3QgcmVjZWl2ZXJFbWFpbCA9IGNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlRoYW5rcyBmb3IgcmVhY2hpbmcgb3V0LCAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0hPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBXZSZhcG9zO3ZlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSBhYm91dFxuICAgICAgPHN0cm9uZz4mbGRxdW87JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9JnJkcXVvOzwvc3Ryb25nPiBhbmQgb3VyIHN1cHBvcnRcbiAgICAgIHRlYW0gd2lsbCBnZXQgYmFjayB0byB5b3Ugd2l0aGluIG9uZSBidXNpbmVzcyBkYXkuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IGNsaWVudC5lbWFpbHMuc2VuZCh7XG4gICAgZnJvbSxcbiAgICB0bzogW2RldGFpbHMuZW1haWxdLFxuICAgIHJlcGx5VG86IHJlY2VpdmVyRW1haWwsXG4gICAgc3ViamVjdDogXCJXZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgLSBUcmlwVmVyc2VcIixcbiAgICBodG1sOiBlbWFpbExheW91dChjb250ZW50KSxcbiAgfSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBlbWFpbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgaW50ZXJmYWNlIElCb29raW5nRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbiAgdHJhdmVsZXJzOiBudW1iZXI7XG4gIHRvdGFsUHJpY2U6IG51bWJlcjtcbiAgc3RhdHVzOiBCb29raW5nU3RhdHVzO1xufVxuXG4vLyBJbmZvcm1zIHRoZSBjdXN0b21lciBhYm91dCBhIGJvb2tpbmcgY3JlYXRlL2NvbmZpcm0vY2FuY2VsLlxuLy8gQmVzdC1lZmZvcnQgbGlrZSB0aGUgY29udGFjdCBlbWFpbHMgXHUyMDE0IGEgZmFpbHVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHJlcXVlc3QuXG5leHBvcnQgY29uc3Qgc2VuZEJvb2tpbmdFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUJvb2tpbmdFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGJvb2tpbmcgZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGZyb20gPSBjb25maWcuZW1haWxfZnJvbSB8fCBcIlRyaXBWZXJzZSA8b25ib2FyZGluZ0ByZXNlbmQuZGV2PlwiO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IHN0YXR1c0NvcHk6IFJlY29yZDxcbiAgICBCb29raW5nU3RhdHVzLFxuICAgIHsgc3ViamVjdDogc3RyaW5nOyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9XG4gID4gPSB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIldlJ3ZlIHJlY2VpdmVkIHlvdXIgYm9va2luZyByZXF1ZXN0LiBUaGUgYWdlbnQgd2lsbCBjb25maXJtIGl0IHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5QQUlEXToge1xuICAgICAgc3ViamVjdDogXCJQYXltZW50IHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlBheW1lbnQgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBwYXltZW50IGhhcyBiZWVuIHJlY2VpdmVkLCBhbmQgdGhlIGFnZW50IHdpbGwgY29uZmlybSB5b3VyIGJvb2tpbmcgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjb25maXJtZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgIGJvZHk6IFwiR3JlYXQgbmV3cyBcdTIwMTQgeW91ciBib29raW5nIGhhcyBiZWVuIGNvbmZpcm1lZC4gV2UgbG9vayBmb3J3YXJkIHRvIGhvc3RpbmcgeW91IVwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNhbmNlbGxlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIGJvb2tpbmcgaGFzIGJlZW4gY2FuY2VsbGVkLiBJZiB0aGlzIHdhc24ndCBleHBlY3RlZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiVHJpcCBjb21wbGV0ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiVHJpcCBjb21wbGV0ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciB0cmlwIGhhcyBiZWVuIG1hcmtlZCBhcyBjb21wbGV0ZWQuIFRoYW5rIHlvdSBmb3IgdHJhdmVsbGluZyB3aXRoIFRyaXBWZXJzZSFcIixcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IGNvcHkgPSBzdGF0dXNDb3B5W2RldGFpbHMuc3RhdHVzXTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj4ke2NvcHkuaGVhZGluZ308L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgJHtjb3B5LmJvZHl9XG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbGVyczwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChTdHJpbmcoZGV0YWlscy50cmF2ZWxlcnMpKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRvdGFsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMudG90YWxQcmljZS50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICBgO1xuXG4gIGF3YWl0IGNsaWVudC5lbWFpbHMuc2VuZCh7XG4gICAgZnJvbSxcbiAgICB0bzogW2RldGFpbHMuZW1haWxdLFxuICAgIHN1YmplY3Q6IGNvcHkuc3ViamVjdCxcbiAgICBodG1sOiBlbWFpbExheW91dChjb250ZW50KSxcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMsIFBheW1lbnRTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQge1xuICBJQm9va2luZ1F1ZXJ5LFxuICBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuICBJQ3JlYXRlQm9va2luZyxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG50eXBlIEJvb2tpbmdXaXRQYWNrYWdlID0gUHJpc21hLkJvb2tpbmdHZXRQYXlsb2FkPHtcbiAgaW5jbHVkZTogeyBwYWNrYWdlOiB0eXBlb2YgYm9va2luZ1BhY2thZ2VTZWxlY3QgfTtcbn0+O1xuXG4vLyBQYXltZW50cyBzaG93IG9uIGxpc3Qgcm93cyB0b28gKERvRDogXCJsaXN0L2RldGFpbCBub3cgaW5jbHVkZXMgcGF5bWVudHNcIiksXG4vLyBtYXBwZWQgdG8gTnVtYmVyIGF0IHRoZSBib3VuZGFyeSBsaWtlIHRoZSByZXN0IG9mIHRoZSBtb25leSBmaWVsZHMuXG50eXBlIEJvb2tpbmdQYXltZW50SXRlbSA9IHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhbklkOiBzdHJpbmc7XG4gIGFtb3VudDogdW5rbm93bjtcbiAgY3VycmVuY3k6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNhcmRUeXBlOiBzdHJpbmcgfCBudWxsO1xuICBiYW5rVHJhbklkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jcmVhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcihjcmVhdGVkLnRvdGFsUHJpY2UpLFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExpc3QgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHBhZ2luYXRlQm9va2luZyA9IGFzeW5jIChcbiAgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCxcbiAgaW5jbHVkZTogUHJpc21hLkJvb2tpbmdJbmNsdWRlLFxuICBxdWVyeTogSUJvb2tpbmdRdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNeSBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE15Qm9va2luZ3MgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7IHVzZXJJZCB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudFNlbGVjdCB9LFxuICAgIHF1ZXJ5LFxuICApO1xuICByZXR1cm4geyAuLi5yZXN1bHQsIGRhdGE6IHJlc3VsdC5kYXRhLm1hcChtYXBCb29raW5nTGlzdCkgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZ2VudCBib29raW5ncyAoc2NvcGVkIHRvIG93biBwYWNrYWdlcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gYXN5bmMgKFxuICBhZ2VudElkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7XG4gICAgcGFja2FnZTogeyBhZ2VudElkIH0sXG4gIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7XG4gICAgICBhZ2VudElkLFxuICAgICAgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7IHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlU2VsZWN0LCBwYXltZW50czogYm9va2luZ1BheW1lbnRTZWxlY3QgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGFsbCBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gYXN5bmMgKHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7fTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50U2VsZWN0LFxuICAgIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZGV0YWlsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGFzeW5jIChpZDogc3RyaW5nLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiB7XG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRTZWxlY3QsXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFib29raW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJCb29raW5nIG5vdCBmb3VuZC5cIik7XG4gIH1cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHZpZXcgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuXG4gIHJldHVybiBtYXBCb29raW5nTGlzdChib29raW5nKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgdHJhbnNpdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBhc3luYyAoXG4gIGlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVCb29raW5nU3RhdHVzLFxuICBhY3RvcjogQm9va2luZ0FjdG9yLFxuKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzOiB0byB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiB7XG4gICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHJ1bGUgPSBUUkFOU0lUSU9OU1tib29raW5nLnN0YXR1c10/Llt0b107XG4gIGlmICghcnVsZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIGBDYW5ub3QgdHJhbnNpdGlvbiBib29raW5nIGZyb20gJHtib29raW5nLnN0YXR1c30gdG8gJHt0b30uYCxcbiAgICApO1xuICB9XG4gIGlmICghcnVsZS5hbGxvd2VkKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERheSA9IHRvVVRDTWlkbmlnaHQoYm9va2luZy50cmF2ZWxEYXRlKS5nZXRUaW1lKCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gIGlmIChydWxlLnJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZCAmJiB0cmF2ZWxEYXkgPiBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgY29tcGxldGVkIGFmdGVyIHRoZSB0cmF2ZWwgZGF0ZSBoYXMgcGFzc2VkLlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKHJ1bGUuYmVmb3JlVHJhdmVsRGF0ZSAmJiB0cmF2ZWxEYXkgPD0gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIHJldmVydGVkIGJlZm9yZSB0aGUgdHJhdmVsIGRhdGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIGNvbXBhcmUtYW5kLXNldDogdGhlIHRyYW5zaXRpb24gYXBwbGllcyBvbmx5IGlmIHRoZSByZWNvcmRlZCBzdGF0dXMgc3RpbGxcbiAgLy8gbWF0Y2hlcyBcdTIwMTQgYSBjb25jdXJyZW50IGNoYW5nZSBtYWtlcyBjb3VudCAwIGFuZCB0aGUgcmVxdWVzdCBmYWlscyBzYWZlbHkuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZCwgc3RhdHVzOiBib29raW5nLnN0YXR1cyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IHRvIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDksXG4gICAgICAgIFwiQm9va2luZyBzdGF0dXMgY2hhbmdlZCBjb25jdXJyZW50bHkuIFBsZWFzZSB0cnkgYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENhbmNlbGxpbmcgYSBwYWlkIGJvb2tpbmcgbWFya3MgaXRzIG1vbmV5IGFzIHJldHVybmVkIChSRUZVTkRFRCBmbGFnIFx1MjAxNFxuICAgIC8vIHRoZSBhY3R1YWwgdHJhbnNmZXIgaXMgb3V0IG9mIHNjb3BlKS4gQWJhbmRvbmVkIHNlc3Npb25zIGFyZSBjYW5jZWxsZWQuXG4gICAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICB9KTtcblxuICBpZiAoIXVwZGF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIGZvciBtb25leS1zdGF0dXMgY2hhbmdlc1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEIHx8IHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzOiBib29raW5nLnRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gICAgICAgIHN0YXR1czogdG8sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIHJldHVybiB7IC4uLnVwZGF0ZWQsIHRvdGFsUHJpY2U6IE51bWJlcih1cGRhdGVkLnRvdGFsUHJpY2UpIH07XG59O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEFsbEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxuICB0cmF2ZWxEYXRlOiB6LmNvZXJjZS5kYXRlKHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBpcyByZXF1aXJlZFwiLFxuICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBtdXN0IGJlIGEgdmFsaWQgZGF0ZVwiLFxuICB9KS5yZWZpbmUoXG4gICAgKGRhdGUpID0+IHtcbiAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHRyYXZlbERheSA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICBkYXRlLmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHRvZGF5VVRDID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRyYXZlbERheS5nZXRUaW1lKCkgPj0gdG9kYXlVVEMuZ2V0VGltZSgpO1xuICAgIH0sXG4gICAgeyBtZXNzYWdlOiBcIlRyYXZlbCBkYXRlIGNhbm5vdCBiZSBpbiB0aGUgcGFzdC5cIiB9LFxuICApLFxuICB0cmF2ZWxlcnM6IHpcbiAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsZXJzIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAuaW50KFwiVHJhdmVsZXJzIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAubWluKDEsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgIC5tYXgoMjAsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbW9zdCAyMFwiKSxcbn0pO1xuXG5jb25zdCBib29raW5nUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSBib29raW5nUXVlcnlTY2hlbWEuZXh0ZW5kKHtcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVCb29raW5nU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXBkYXRlU3RhdHVzU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlU3RhdHVzU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBib29raW5nUGFyYW1zU2NoZW1hLFxuICBib29raW5nUXVlcnlTY2hlbWEsXG4gIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHJldmlld0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9yZXZpZXcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcmV2aWV3VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9yZXZpZXcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMuY3JlYXRlUmV2aWV3U2NoZW1hIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmNyZWF0ZVJldmlldyxcbik7XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpXG5yb3V0ZXIuZ2V0KFxuICBcIi9wYWNrYWdlLzpwYWNrYWdlSWRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1BhcmFtc1NjaGVtYSxcbiAgICBxdWVyeTogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UXVlcnlTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmdldFBhY2thZ2VSZXZpZXdzLFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcmV2aWV3U2VydmljZSB9IGZyb20gXCIuL3Jldmlldy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKFVTRVIgb25seSlcbmNvbnN0IGNyZWF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuY3JlYXRlUmV2aWV3KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IHBhY2thZ2UgcmV2aWV3cyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRQYWNrYWdlUmV2aWV3cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VJZCA9IFN0cmluZyhyZXEucGFyYW1zLnBhY2thZ2VJZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5saXN0UGFja2FnZVJldmlld3MocGFja2FnZUlkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlld3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBnZXRQYWNrYWdlUmV2aWV3cyxcbn07XG4iLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IElDcmVhdGVSZXZpZXdQYXlsb2FkLCBJUmV2aWV3UXVlcnkgfSBmcm9tIFwiLi9yZXZpZXcuaW50ZXJmYWNlXCI7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KSBcdTIwMTQgZ2F0ZWQsIHVuaXF1ZSBwZXIgdXNlcitwYWNrYWdlLCBhbmRcbi8vICAgIHJlY2FsY3VsYXRlcyB0aGUgcGFja2FnZSByYXRpbmcgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24uXG5jb25zdCBjcmVhdGVSZXZpZXcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVSZXZpZXdQYXlsb2FkKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIC8vIFBhY2thZ2UgbXVzdCBleGlzdCwgYmUgYXBwcm92ZWQsIGFuZCBub3QgYmUgZGVsZXRlZCBcdTIwMTQgYSByZXZpZXcgb2YgYVxuICAgIC8vIHBlbmRpbmcvcmVqZWN0ZWQvZGVsZXRlZCBwYWNrYWdlIGlzIG5vbnNlbnNlLlxuICAgIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgdHgudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgLy8gTm8gc2VsZi1yZXZpZXcgXHUyMDE0IGFuIGFnZW50IHJhdGluZyB0aGVpciBvd24gcGFja2FnZSBpcyBhIGNvbmZsaWN0IG9mIGludGVyZXN0LlxuICAgIGlmICh0b3VyUGFja2FnZS5hZ2VudElkID09PSB1c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbm5vdCByZXZpZXcgeW91ciBvd24gcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgLy8gT25seSBjdXN0b21lcnMgd2l0aCBhIGNvbXBsZXRlZCBib29raW5nIG1heSByZXZpZXcuXG4gICAgY29uc3QgY29tcGxldGVkQm9va2luZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghY29tcGxldGVkQm9va2luZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiWW91IGNhbiBvbmx5IHJldmlldyBhIHBhY2thZ2UgYWZ0ZXIgY29tcGxldGluZyBhIGJvb2tpbmcuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEZyaWVuZGx5IGR1cGxpY2F0ZSBjaGVjayBcdTIwMTQgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSkgYmFja3N0b3BzIGFueVxuICAgIC8vIHJhY2UgdmlhIFAyMDAyIChtYXBwZWQgdG8gNDA5IGJ5IHRoZSBnbG9iYWwgaGFuZGxlcikuXG4gICAgY29uc3QgZXhpc3RpbmdSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoZXhpc3RpbmdSZXZpZXcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiWW91IGhhdmUgYWxyZWFkeSByZXZpZXdlZCB0aGlzIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGNyZWF0ZWRSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICByYXRpbmc6IHBheWxvYWQucmF0aW5nLFxuICAgICAgICBjb21tZW50OiBwYXlsb2FkLmNvbW1lbnQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUmVjb21wdXRlIHRoZSBwYWNrYWdlIHJhdGluZyBmcm9tIGFsbCBvZiBpdHMgcmV2aWV3cywgcm91bmRlZCB0byBvbmVcbiAgICAvLyBkZWNpbWFsLCBpbnNpZGUgdGhlIHNhbWUgdHJhbnNhY3Rpb24gc28gYSBzdGFsZSBhdmVyYWdlIGlzIG5ldmVyIHdyaXR0ZW4uXG4gICAgY29uc3QgeyBfYXZnIH0gPSBhd2FpdCB0eC5yZXZpZXcuYWdncmVnYXRlKHtcbiAgICAgIHdoZXJlOiB7IHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIF9hdmc6IHsgcmF0aW5nOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXRpbmcgPSBNYXRoLnJvdW5kKChfYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwO1xuXG4gICAgYXdhaXQgdHgudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgZGF0YTogeyByYXRpbmcgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHJldmlldzogY3JlYXRlZFJldmlldywgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYykgXHUyMDE0IHBhZ2luYXRlZDsgdGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgYXBwcm92ZWQgYW5kIG5vdCBkZWxldGVkIHNvIHVucHVibGlzaGVkIHBhY2thZ2UgcmV2aWV3cyBuZXZlciBsZWFrLlxuY29uc3QgbGlzdFBhY2thZ2VSZXZpZXdzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcXVlcnk6IElSZXZpZXdRdWVyeSxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGFja2FnZUlkLFxuICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnJldmlldy5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBwYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgcmF0aW5nOiB0cnVlLFxuICAgICAgICBjb21tZW50OiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEucmV2aWV3LmNvdW50KHsgd2hlcmU6IHsgcGFja2FnZUlkIH0gfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgbGlzdFBhY2thZ2VSZXZpZXdzLFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVSZXZpZXdTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gICAgcmF0aW5nOiB6XG4gICAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUmF0aW5nIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5pbnQoXCJSYXRpbmcgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgICAgLm1pbigxLCBcIlJhdGluZyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAgIC5tYXgoNSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBtb3N0IDVcIiksXG4gICAgY29tbWVudDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbW1lbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbW1lbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMTAwMCwgXCJDb21tZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwIGNoYXJhY3RlcnNcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgcmV2aWV3UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3QgcmV2aWV3UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVSZXZpZXdTY2hlbWEsXG4gIHJldmlld1BhcmFtc1NjaGVtYSxcbiAgcmV2aWV3UXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjYXRlZ29yeUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9jYXRlZ29yeS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY2F0ZWdvcnkudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gTGlzdCBhbGwgY2F0ZWdvcmllcyAocHVibGljLCBubyBhdXRoKVxucm91dGVyLmdldChcIi9cIiwgY2F0ZWdvcnlDb250cm9sbGVyLmdldEFsbENhdGVnb3JpZXMpO1xuXG4vLyAyLiBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLmNyZWF0ZUNhdGVnb3J5U2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuY3JlYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyAzLiBVcGRhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy51cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci51cGRhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDQuIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuZGVsZXRlQ2F0ZWdvcnksXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVNlcnZpY2UgfSBmcm9tIFwiLi9jYXRlZ29yeS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5jcmVhdGVDYXRlZ29yeShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmdldEFsbENhdGVnb3JpZXMoKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgY2F0ZWdvcmllcyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3JpZXMsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UudXBkYXRlQ2F0ZWdvcnkoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGF3YWl0IGNhdGVnb3J5U2VydmljZS5kZWxldGVDYXRlZ29yeShpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgIi8vIEJhbmdsYSAoQmVuZ2FsaSkgXHUyMTkyIExhdGluIGNvbnNvbmFudC92b3dlbCBtYXAsIGFwcGxpZWQgYmVmb3JlIGtlYmFiLWNhc2luZyBzb1xuLy8gQmFuZ2xhLWhlYXZ5IHRpdGxlcyBzdGlsbCBwcm9kdWNlIHJlYWRhYmxlIHNsdWdzIGluc3RlYWQgb2YgYmVpbmcgc3RyaXBwZWQgdG9cbi8vIGFuIGVtcHR5IHN0cmluZy5cbmNvbnN0IEJBTkdMQV9UT19MQVRJTjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXHUwOTg1OiBcIm9cIixcbiAgXHUwOTg2OiBcImFcIixcbiAgXHUwOTg3OiBcImlcIixcbiAgXHUwOTg4OiBcImlcIixcbiAgXHUwOTg5OiBcInVcIixcbiAgXHUwOThBOiBcInVcIixcbiAgXHUwOThCOiBcInJpXCIsXG4gIFx1MDk4RjogXCJlXCIsXG4gIFx1MDk5MDogXCJvaVwiLFxuICBcdTA5OTM6IFwib1wiLFxuICBcdTA5OTQ6IFwib3VcIixcbiAgXHUwOTk1OiBcImthXCIsXG4gIFx1MDk5NjogXCJraGFcIixcbiAgXHUwOTk3OiBcImdhXCIsXG4gIFx1MDk5ODogXCJnaGFcIixcbiAgXHUwOTk5OiBcIm5nYVwiLFxuICBcdTA5OUE6IFwiY2hhXCIsXG4gIFx1MDk5QjogXCJjaGhhXCIsXG4gIFx1MDk5QzogXCJqYVwiLFxuICBcdTA5OUQ6IFwiamhhXCIsXG4gIFx1MDk5RTogXCJueWFcIixcbiAgXHUwOTlGOiBcInRhXCIsXG4gIFx1MDlBMDogXCJ0aGFcIixcbiAgXHUwOUExOiBcImRhXCIsXG4gIFx1MDlBMjogXCJkaGFcIixcbiAgXHUwOUEzOiBcIm5hXCIsXG4gIFx1MDlBNDogXCJ0YVwiLFxuICBcdTA5QTU6IFwidGhhXCIsXG4gIFx1MDlBNjogXCJkYVwiLFxuICBcdTA5QTc6IFwiZGhhXCIsXG4gIFx1MDlBODogXCJuYVwiLFxuICBcdTA5QUE6IFwicGFcIixcbiAgXHUwOUFCOiBcInBoYVwiLFxuICBcdTA5QUM6IFwiYmFcIixcbiAgXHUwOUFEOiBcImJoYVwiLFxuICBcdTA5QUU6IFwibWFcIixcbiAgXHUwOUFGOiBcInlhXCIsXG4gIFx1MDlCMDogXCJyYVwiLFxuICBcdTA5QjI6IFwibGFcIixcbiAgXHUwOUI2OiBcInNoYVwiLFxuICBcdTA5Qjc6IFwic2hhXCIsXG4gIFx1MDlCODogXCJzYVwiLFxuICBcdTA5Qjk6IFwiaGFcIixcbiAgXHUwOUExXHUwOUJDOiBcInJhXCIsXG4gIFx1MDlBMlx1MDlCQzogXCJyaGFcIixcbiAgXHUwOUFGXHUwOUJDOiBcInlhXCIsXG4gIFwiXHUwOTgyXCI6IFwibmdcIixcbiAgXCJcdTA5ODNcIjogXCJoXCIsXG4gIFwiXHUwOTgxXCI6IFwiXCIsXG4gIFwiXHUwOUNEXCI6IFwiXCIsXG4gIFwiXHUwOUM3XCI6IFwiZVwiLFxuICBcIlx1MDlDOFwiOiBcIm9pXCIsXG4gIFwiXHUwOUNCXCI6IFwib1wiLFxuICBcIlx1MDlDQ1wiOiBcIm91XCIsXG4gIFwiXHUwOUJFXCI6IFwiYVwiLFxuICBcIlx1MDlCRlwiOiBcImlcIixcbiAgXCJcdTA5QzBcIjogXCJpXCIsXG4gIFwiXHUwOUMxXCI6IFwidVwiLFxuICBcIlx1MDlDMlwiOiBcInVcIixcbiAgXCJcdTA5QzNcIjogXCJyaVwiLFxufTtcblxuY29uc3QgdHJhbnNsaXRlcmF0ZSA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cbiAgWy4uLnRleHRdLm1hcCgoY2hhcikgPT4gQkFOR0xBX1RPX0xBVElOW2NoYXJdID8/IGNoYXIpLmpvaW4oXCJcIik7XG5cbi8vIFNoYXJlZCBrZWJhYi1jYXNlIHNsdWdpZmllciB1c2VkIGJ5IENhdGVnb3J5IGFuZCBUb3VyUGFja2FnZSBzbHVncy4gTm9uLUxhdGluXG4vLyBzY3JpcHRzIChlLmcuIEJhbmdsYSkgYXJlIHRyYW5zbGl0ZXJhdGVkIGZpcnN0OyBpZiB0aGUgcmVzdWx0IGlzIHN0aWxsIGVtcHR5XG4vLyB0aGUgY2FsbGVyIG1heSBzdXBwbHkgYSBgZmFsbGJhY2tgIChlLmcuIFwicGFja2FnZS08c2hvcnRJZD5cIikuXG5leHBvcnQgY29uc3Qgc2x1Z2lmeSA9ICh0ZXh0OiBzdHJpbmcsIGZhbGxiYWNrPzogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgY29uc3Qgc2x1ZyA9IHRyYW5zbGl0ZXJhdGUodGV4dClcbiAgICAudG9Mb3dlckNhc2UoKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvW15cXHdcXHMtXS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9bXFxzXy1dKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCBcIlwiKTtcblxuICByZXR1cm4gc2x1ZyB8fCBmYWxsYmFjayB8fCBcIlwiO1xufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHsgSUNyZWF0ZUNhdGVnb3J5LCBJVXBkYXRlQ2F0ZWdvcnkgfSBmcm9tIFwiLi9jYXRlZ29yeS5pbnRlcmZhY2VcIjtcblxuLy8gRnJpZW5kbHkgNDA5IGZvciBAdW5pcXVlIGNvbmZsaWN0cyAobmFtZSBvciBzbHVnKSBpbnN0ZWFkIG9mIGEgcmF3IFAyMDAyLlxuLy8gZXhjbHVkZUlkIGxldHMgdXBkYXRlcyBza2lwIHRoZSB2ZXJ5IHJvdyBiZWluZyBlZGl0ZWQgc28gYSBuby1vcCByZW5hbWVcbi8vIGRvZXNuJ3QgZmFsc2UtNDA5IGFnYWluc3QgaXRzZWxmLlxuY29uc3QgYXNzZXJ0TmFtZUF2YWlsYWJsZSA9IGFzeW5jIChcbiAgbmFtZTogc3RyaW5nLFxuICBzbHVnOiBzdHJpbmcsXG4gIGV4Y2x1ZGVJZD86IHN0cmluZyxcbikgPT4ge1xuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBPUjogW3sgbmFtZSB9LCB7IHNsdWcgfV0sXG4gICAgICAuLi4oZXhjbHVkZUlkID8geyBOT1Q6IHsgaWQ6IGV4Y2x1ZGVJZCB9IH0gOiB7fSksXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJBIGNhdGVnb3J5IHdpdGggdGhpcyBuYW1lIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG59O1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmNyZWF0ZSh7XG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMpIHdpdGggY291bnRzIG9mIGFwcHJvdmVkLCBub24tZGVsZXRlZCBwYWNrYWdlc1xuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGFzeW5jICgpID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgb3JkZXJCeTogeyBuYW1lOiBcImFzY1wiIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgX2NvdW50OiB7XG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIHBhY2thZ2VzOiB7XG4gICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xufTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IG5hbWUgKHJlZ2VuZXJhdGVzIHNsdWcpIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnLCBjYXRlZ29yeUlkKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKSBcdTIwMTQgNDA5IHdoZW4gYW55IHBhY2thZ2UgcmVmZXJlbmNlcyBpdFxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG5cbiAgY29uc3QgcGFja2FnZUNvdW50ID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHtcbiAgICB3aGVyZTogeyBjYXRlZ29yeUlkIH0sXG4gIH0pO1xuXG4gIGlmIChwYWNrYWdlQ291bnQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgXCJDYW5ub3QgZGVsZXRlIGNhdGVnb3J5IHdpdGggYXNzb2NpYXRlZCBwYWNrYWdlcy4gUmVuYW1lIGl0IGluc3RlYWQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5kZWxldGUoeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5U2VydmljZSA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IG5hbWVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBuYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMCwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCBjYXRlZ29yeVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5U2NoZW1hLFxuICB1cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGFja2FnZUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYWNrYWdlLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBhY2thZ2VWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BhY2thZ2UudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gTXkgcGFja2FnZXMgKGFnZW50KSBcdTIwMTQgc2VsZi1wcmV2aWV3IG9mIFBFTkRJTkcvUkVKRUNURUQgYmVmb3JlIGFwcHJvdmFsXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9teS1wYWNrYWdlc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRNeVBhY2thZ2VzLFxuKTtcblxuLy8gMi4gQWxsIHBhY2thZ2VzIChhZG1pbiBtb2RlcmF0aW9uIFVJKVxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldEFsbFBhY2thZ2VzLFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQYWNrYWdlQnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBhY2thZ2UgKGFnZW50IGNyZWF0ZXMgb3duOyBhZG1pbiBjYW4gY3JlYXRlIGZvciBhbnkgYWdlbnQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy5jcmVhdGVQYWNrYWdlU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jcmVhdGVQYWNrYWdlLFxuKTtcblxuLy8gNS4gQXBwcm92ZS9yZWplY3QgcGFja2FnZSAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jaGFuZ2VQYWNrYWdlU3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnVwZGF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuc29mdERlbGV0ZVBhY2thZ2UsXG4pO1xuXG4vLyA4LiBQdWJsaWMgbGlzdGluZyBcdTIwMTQga2VwdCBsYXN0IHNvIG5vbmUgb2YgdGhlIGFib3ZlIHJvdXRlcyBhcmUgc2hhZG93ZWRcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UHVibGljUGFja2FnZXMsXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHBhY2thZ2VTZXJ2aWNlIH0gZnJvbSBcIi4vcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY3JlYXRlUGFja2FnZShyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBhZG1pbiBhcHByb3ZhbC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKGZpbHRlcnMgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQdWJsaWNQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UGFja2FnZUJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0QWxsUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBNeSBwYWNrYWdlcyBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldE15UGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRNeVBhY2thZ2VzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJZb3VyIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnVwZGF0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBDaGFuZ2UgcGFja2FnZSBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gYXBwcm92ZS9yZWplY3QpXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY2hhbmdlUGFja2FnZVN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gOC4gU29mdCBkZWxldGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnNvZnREZWxldGVQYWNrYWdlKHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUGFja2FnZVBheWxvYWQsXG4gIElJbnRlcm5hbFBhY2thZ2VRdWVyeSxcbiAgSVBhY2thZ2VRdWVyeSxcbiAgSVJlcXVlc3RVc2VyLFxuICBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4gIElVcGRhdGVTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9wYWNrYWdlLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVQcmljZSA9IDxUIGV4dGVuZHMgeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfT4ocm93OiBUKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHByaWNlOiBOdW1iZXIocm93LnByaWNlKSxcbn0pO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGFnZW50J3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsLlxuY29uc3QgcHVibGljUGFja2FnZUluY2x1ZGUgPSB7XG4gIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IHZhbGlkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghY2F0ZWdvcnkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY2F0ZWdvcnlJZFwiKTtcbiAgfVxufTtcblxuLy8gUGFja2FnZXMgbXVzdCBiZSBvd25lZCBieSBhIGxpdmUgQUdFTlQgXHUyMDE0IG90aGVyd2lzZSB0aGUgYm9va2luZyBzdGF0ZVxuLy8gbWFjaGluZSdzIFwiQUdFTlQgKG93bnMgcGFja2FnZSlcIiBicmFuY2ggYW5kIGFnZW50LWJvb2tpbmdzIHNjb3BpbmcgYnJlYWsuXG5jb25zdCB2YWxpZGF0ZUFnZW50ID0gYXN5bmMgKGFnZW50SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBhZ2VudCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBhZ2VudElkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlLCByb2xlOiB0cnVlLCBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFhZ2VudCB8fCBhZ2VudC5yb2xlICE9PSBSb2xlLkFHRU5UIHx8IGFnZW50LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBhZ2VudElkXCIpO1xuICB9XG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBwYWNrYWdlLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBwYWNrYWdlLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcGFja2FnZSAoQUdFTlQvQURNSU4pLiBOZXcgcGFja2FnZXMgc3RhcnQgUEVORElORyBhbmQgbmV2ZXIgbGVha1xuLy8gICAgaW50byBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBhcHByb3ZlcyB0aGVtLlxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQYWNrYWdlUGF5bG9hZCkgPT4ge1xuICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG5cbiAgLy8gQURNSU4gbWF5IGNyZWF0ZSBvbiBiZWhhbGYgb2YgYW4gYWdlbnQgKG9wdGlvbmFsIGFnZW50SWQpOyBBR0VOVCBhbHdheXNcbiAgLy8gb3ducyB3aGF0IHRoZXkgY3JlYXRlIGFuZCBtYXkgbm90IGltcGVyc29uYXRlIGFub3RoZXIgdXNlci5cbiAgbGV0IGFnZW50SWQ6IHN0cmluZztcbiAgaWYgKHVzZXIucm9sZSA9PT0gUm9sZS5BRE1JTikge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIGF3YWl0IHZhbGlkYXRlQWdlbnQocGF5bG9hZC5hZ2VudElkKTtcbiAgICAgIGFnZW50SWQgPSBwYXlsb2FkLmFnZW50SWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcImFnZW50SWQgY2FuIG9ubHkgYmUgc2V0IGJ5IGFuIGFkbWluXCIpO1xuICAgIH1cbiAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgfVxuXG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24sXG4gICAgICBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbixcbiAgICAgIHByaWNlOiBwYXlsb2FkLnByaWNlLFxuICAgICAgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24sXG4gICAgICBjYXRlZ29yeUlkOiBwYXlsb2FkLmNhdGVnb3J5SWQsXG4gICAgICBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzLFxuICAgICAgYWdlbnRJZCxcbiAgICAgIHNsdWcsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKGNyZWF0ZWQpO1xufTtcblxuLy8gMi4gUHVibGljIGV4cGxvcmVkIGxpc3RpbmcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seSwgZmlsdGVycyArIHNvcnRpbmcuXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSVBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IGZpbHRlcnM6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXRbXSA9IFtdO1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgT1I6IFtcbiAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGRlc2NyaXB0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxvY2F0aW9uKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5sb2NhdGlvbiwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgfHwgcXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBwcmljZToge1xuICAgICAgICAuLi4ocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgZ3RlOiBxdWVyeS5taW5QcmljZSB9IDoge30pLFxuICAgICAgICAuLi4ocXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgbHRlOiBxdWVyeS5tYXhQcmljZSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUmF0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyByYXRpbmc6IHsgZ3RlOiBxdWVyeS5taW5SYXRpbmcgfSB9KTtcbiAgfVxuICBpZiAocXVlcnkubWF4RHVyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IGR1cmF0aW9uOiB7IGx0ZTogcXVlcnkubWF4RHVyYXRpb24gfSB9KTtcbiAgfVxuICBpZiAocXVlcnkuY2F0ZWdvcnkpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBjYXRlZ29yeTogeyBzbHVnOiBxdWVyeS5jYXRlZ29yeSB9IH0pO1xuICB9XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgQU5EOiBmaWx0ZXJzLmxlbmd0aCA+IDAgPyBmaWx0ZXJzIDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm5ld2VzdFwiID8gXCJkZXNjXCIgOiBcImFzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuVG91clBhY2thZ2VPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IHNvcnRPcmRlciB9LFxuICAgIHByaWNlOiB7IHByaWNlOiBzb3J0T3JkZXIgfSxcbiAgICByYXRpbmc6IHsgcmF0aW5nOiBzb3J0T3JkZXIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh0b3VyUGFja2FnZSk7XG59O1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXJzKS5cbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gICAgLi4uKHF1ZXJ5LmFnZW50SWQgPyB7IGFnZW50SWQ6IHF1ZXJ5LmFnZW50SWQgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDUuIEFuIGFnZW50J3Mgb3duIHBhY2thZ2VzIChhbnkgc3RhdHVzKSBcdTIwMTQgc2VsZi1wcmV2aWV3IGJlZm9yZSBhcHByb3ZhbC5cbmNvbnN0IGdldE15UGFja2FnZXMgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcGFja2FnZXMuXG5jb25zdCBmaW5kT3duZWRQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHRvdXJQYWNrYWdlLmFnZW50SWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcGFja2FnZXMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHRvdXJQYWNrYWdlO1xufTtcblxuLy8gNi4gVXBkYXRlIGEgcGFja2FnZS4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIFBFTkRJTkc7IEFETUlOIGVkaXRzIHByZXNlcnZlIGl0LlxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIGlmIChwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZCkge1xuICAgIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCA/IHsgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5sb2NhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLnByaWNlICE9PSB1bmRlZmluZWQgPyB7IHByaWNlOiBwYXlsb2FkLnByaWNlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5pbWFnZXMgIT09IHVuZGVmaW5lZCA/IHsgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNhdGVnb3J5OiB7IGNvbm5lY3Q6IHsgaWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCB9IH0gfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLlBFTkRJTkcgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDcuIEFwcHJvdmUvcmVqZWN0IGEgcGFja2FnZSAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICh0b3VyUGFja2FnZS5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcGFja2FnZS5cIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlU2VydmljZSA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGRlc2NyaXB0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRGVzY3JpcHRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMTAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwMDAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGxvY2F0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTG9jYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IHByaWNlU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUHJpY2UgaXMgcmVxdWlyZWRcIiB9KVxuICAucG9zaXRpdmUoXCJQcmljZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpXG4gIC5yZWZpbmUoKHZhbCkgPT4gTWF0aC5yb3VuZCh2YWwgKiAxMDApIC8gMTAwID09PSB2YWwsIHtcbiAgICBtZXNzYWdlOiBcIlByaWNlIG11c3QgaGF2ZSBhdCBtb3N0IDIgZGVjaW1hbCBwbGFjZXNcIixcbiAgfSk7XG5cbmNvbnN0IGR1cmF0aW9uU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiRHVyYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAuaW50KFwiRHVyYXRpb24gbXVzdCBiZSBhIHdob2xlIG51bWJlciBvZiBkYXlzXCIpXG4gIC5taW4oMSwgXCJEdXJhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEgZGF5XCIpO1xuXG5jb25zdCBjYXRlZ29yeUlkU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAubWluKDEsIFwiQ2F0ZWdvcnkgaWQgbXVzdCBub3QgYmUgZW1wdHlcIik7XG5cbmNvbnN0IGltYWdlc1NjaGVtYSA9IHpcbiAgLmFycmF5KHouc3RyaW5nKCkudXJsKFwiRWFjaCBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpKVxuICAubWluKDEsIFwiQXQgbGVhc3Qgb25lIGltYWdlIGlzIHJlcXVpcmVkXCIpXG4gIC5tYXgoNiwgXCJBdCBtb3N0IDYgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpO1xuXG5jb25zdCBjcmVhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEsXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEsXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEsXG4gICAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcGFja2FnZVF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeTogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIG1pblByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWF4UHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtaW5SYXRpbmc6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5tYXgoNSkub3B0aW9uYWwoKSxcbiAgICBtYXhEdXJhdGlvbjogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6XG4gICAgICAuZW51bShbXCJuZXdlc3RcIiwgXCJwcmljZVwiLCBcInJhdGluZ1wiLCBcInRpdGxlXCJdKVxuICAgICAgLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZSgoZGF0YSkgPT4ge1xuICAgIGlmIChkYXRhLm1pblByaWNlICE9PSB1bmRlZmluZWQgJiYgZGF0YS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZGF0YS5taW5QcmljZSA8PSBkYXRhLm1heFByaWNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSwge1xuICAgIG1lc3NhZ2U6IFwibWluUHJpY2UgbXVzdCBiZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gbWF4UHJpY2VcIixcbiAgICBwYXRoOiBbXCJtaW5QcmljZVwiXSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHpcbiAgICAuZW51bShbXCJQRU5ESU5HXCIsIFwiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIlBFTkRJTkdcIiB8IFwiQVBQUk9WRURcIiB8IFwiUkVKRUNURURcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2Ugc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBBUFBST1ZFRCBvciBSRUpFQ1RFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBhY2thZ2VTY2hlbWEsXG4gIHVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIHBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEsXG4gIHBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gIHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYmxvZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ibG9nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2cudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gQWxsIHBvc3RzIChhZG1pbiBtb2RlcmF0aW9uIFVJKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRBbGxQb3N0cyxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5wdWJsaWNRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UHVibGljUG9zdHMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFBvc3RCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcG9zdCAoYWdlbnQvYWRtaW4gYXV0aG9ycyBvd24gcG9zdHM7IG5ldyBwb3N0cyBzdGFydCBEUkFGVClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYmxvZ1ZhbGlkYXRpb25zLmNyZWF0ZVBvc3RTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmNyZWF0ZVBvc3QsXG4pO1xuXG4vLyA1LiBQdWJsaXNoL3VucHVibGlzaCBwb3N0IChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLmNoYW5nZVBvc3RTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KSBcdTIwMTQgYWdlbnQgZWRpdHMgcmVzZXQgdG8gRFJBRlRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlUG9zdFNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLnVwZGF0ZVBvc3QsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuc29mdERlbGV0ZVBvc3QsXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYmxvZ1NlcnZpY2UgfSBmcm9tIFwiLi9ibG9nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jcmVhdGVQb3N0KHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIHB1Ymxpc2hpbmcuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChzZWFyY2ggKyBzb3J0ICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UHVibGljUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFBvc3RCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBvc3RzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldEFsbFBvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gVXBkYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLnVwZGF0ZVBvc3QocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBDaGFuZ2UgcG9zdCBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gcHVibGlzaC91bnB1Ymxpc2gpXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY2hhbmdlUG9zdFN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3Qgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dTZXJ2aWNlLnNvZnREZWxldGVQb3N0KHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb250cm9sbGVyID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQb3N0UGF5bG9hZCxcbiAgSUludGVybmFsUG9zdFF1ZXJ5LFxuICBJUG9zdFF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQb3N0UGF5bG9hZCxcbiAgSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9ibG9nLmludGVyZmFjZVwiO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGF1dGhvcidzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC9yb2xlLlxuY29uc3QgcHVibGljQXV0aG9yU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9LFxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgYmxvZy08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgYmxvZy0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBvc3QgKEFHRU5UL0FETUlOKS4gTmV3IHBvc3RzIHN0YXJ0IERSQUZUIGFuZCBuZXZlciBsZWFrIGludG9cbi8vICAgIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgY3JlYXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQb3N0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCxcbiAgICAgIGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCxcbiAgICAgIGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSxcbiAgICAgIHNsdWcsXG4gICAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQdWJsaWMgYmxvZyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBzZWFyY2ggKyBzb3J0LlxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBhc3luYyAocXVlcnk6IElQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnNlYXJjaFxuICAgICAgPyB7XG4gICAgICAgICAgT1I6IFtcbiAgICAgICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICAgIHsgZXhjZXJwdDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm9sZGVzdFwiID8gXCJhc2NcIiA6IFwiZGVzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuQmxvZ1Bvc3RPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgb2xkZXN0OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0aXRsZTogdHJ1ZSxcbiAgICAgICAgc2x1ZzogdHJ1ZSxcbiAgICAgICAgZXhjZXJwdDogdHJ1ZSxcbiAgICAgICAgY292ZXJJbWFnZTogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0LFxuICAgICAgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA0LiBBbGwgcG9zdHMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXIpLlxuY29uc3QgZ2V0QWxsUG9zdHMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcG9zdHMuXG5jb25zdCBmaW5kT3duZWRQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBwb3N0LmF1dGhvcklkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBvc3RzLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNS4gVXBkYXRlIGEgcG9zdC4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIERSQUZUIChyZS1wdWJsaXNoIHZpYSAvOmlkL3N0YXR1cyk7XG4vLyAgICBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBzdGF0dXMuXG5jb25zdCB1cGRhdGVQb3N0ID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFBheWxvYWQsXG4pID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZXhjZXJwdCAhPT0gdW5kZWZpbmVkID8geyBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb250ZW50ICE9PSB1bmRlZmluZWQgPyB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvdmVySW1hZ2UgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBvc3RTdGF0dXMuRFJBRlQgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDYuIFB1Ymxpc2gvdW5wdWJsaXNoIGEgcG9zdCAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGFzeW5jIChcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmIChwb3N0LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwb3N0LlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDcuIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dTZXJ2aWNlID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBleGNlcnB0U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRXhjZXJwdCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkV4Y2VycHQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCg1MDAsIFwiRXhjZXJwdCBtdXN0IGJlIGF0IG1vc3QgNTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvbnRlbnRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb250ZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDEwMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvdmVySW1hZ2VTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb3ZlciBpbWFnZSBpcyByZXF1aXJlZFwiIH0pXG4gIC51cmwoXCJDb3ZlciBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpO1xuXG5jb25zdCBjcmVhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEsXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBvc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3QgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcG9zdFNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBEUkFGVCBvciBQVUJMSVNIRURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBwdWJsaWNRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6LmVudW0oW1wibmV3ZXN0XCIsIFwib2xkZXN0XCIsIFwidGl0bGVcIl0pLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzdGF0dXM6IHpcbiAgICAgIC5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdKVxuICAgICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJEUkFGVFwiIHwgXCJQVUJMSVNIRURcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUG9zdFNjaGVtYSxcbiAgdXBkYXRlUG9zdFNjaGVtYSxcbiAgcG9zdFBhcmFtc1NjaGVtYSxcbiAgcG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgcHVibGljUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRDb250cm9sbGVyIH0gZnJvbSBcIi4vZGFzaGJvYXJkLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGRhc2hib2FyZFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBhbmFseXRpY3NcbnJvdXRlci5nZXQoXG4gIFwiL2FkbWluXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZG1pbkRhc2hib2FyZCxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgb3duIHBhY2thZ2VzL2Jvb2tpbmdzL3JldmVudWUvcGVyZm9ybWFuY2VcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50XCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZ2VudERhc2hib2FyZCxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCBvd24gYm9va2luZ3MvdXBjb21pbmcvc3BlbmRcbnJvdXRlci5nZXQoXCIvdXNlclwiLCBhdXRoKFJvbGUuVVNFUiksIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0VXNlckRhc2hib2FyZCk7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRTZXJ2aWNlIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgY29udHJvbGxlciAoQURNSU4pXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWRtaW5EYXNoYm9hcmQoXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWdlbnREYXNoYm9hcmQoXG4gICAgICB1c2VySWQsXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0VXNlckRhc2hib2FyZCh1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZENvbnRyb2xsZXIgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgSUFnZW50RGFzaGJvYXJkLFxuICBJQWRtaW5EYXNoYm9hcmQsXG4gIElCb29raW5nc0J5U3RhdHVzLFxuICBJUmV2ZW51ZVBvaW50LFxuICBJVXNlckRhc2hib2FyZCxcbn0gZnJvbSBcIi4vZGFzaGJvYXJkLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCB0b051bWJlciA9ICh2YWx1ZTogdW5rbm93bik6IG51bWJlciA9PiBOdW1iZXIodmFsdWUgPz8gMCk7XG5cbi8vIEJvb2tpbmctc3RhdHVzIGJyZWFrZG93biB2aWEgZ3JvdXBCeSArIF9jb3VudC4gT3B0aW9uYWwgcGFja2FnZS1pZCBzY29wZVxuLy8gKGBhZ2VudElkYCkgbGltaXRzIGl0IHRvIGFuIGFnZW50J3Mgb3duLCBub24tZGVsZXRlZCBwYWNrYWdlcy5cbmNvbnN0IGdldEJvb2tpbmdzQnlTdGF0dXMgPSBhc3luYyAoXG4gIGFnZW50SWQ/OiBzdHJpbmcsXG4pOiBQcm9taXNlPElCb29raW5nc0J5U3RhdHVzW10+ID0+IHtcbiAgY29uc3QgZ3JvdXBlZCA9IGF3YWl0IHByaXNtYS5ib29raW5nLmdyb3VwQnkoe1xuICAgIGJ5OiBbXCJzdGF0dXNcIl0sXG4gICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICB3aGVyZTogYWdlbnRJZFxuICAgICAgPyB7IHBhY2thZ2U6IHsgYWdlbnRJZCwgaXNEZWxldGVkOiBmYWxzZSB9IH1cbiAgICAgIDogdW5kZWZpbmVkLFxuICB9KTtcblxuICByZXR1cm4gZ3JvdXBlZFxuICAgIC5tYXAoKGcpID0+ICh7IHN0YXR1czogZy5zdGF0dXMsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG59O1xuXG4vLyBSZXZlbnVlIHRyZW5kOiBvbmUgcm93IHBlciBkYXkgZm9yIHRoZSBsYXN0IGBkYXlzYCBkYXlzLCBidWNrZXRpbmcgQ09NUExFVEVEXG4vLyBib29raW5ncyBieSB0aGVpciBgdXBkYXRlZEF0YCBcdTIwMTQgdGhlIHRpbWVzdGFtcCBvZiB0aGUgdHJhbnNpdGlvbiBpbnRvXG4vLyBDT01QTEVURUQgKGEgdGVybWluYWwgc3RhdGUsIHNvIGl0IGlzIHRoZSBsYXN0IHdyaXRlKS4gYGNyZWF0ZWRBdGAgaXMgd2hlblxuLy8gdGhlIGJvb2tpbmcgd2FzIG1hZGUgKFBFTkRJTkcpIGFuZCBuZXZlciBtb3Zlcywgd2hpY2ggd291bGQgbWlzLWRhdGUgcmV2ZW51ZVxuLy8gd2Vla3MgbGF0ZXIuIFBvc3RncmVzIGdlbmVyYXRlX3NlcmllcyBndWFyYW50ZWVzIGEgZGVuc2Ugc2VyaWVzICh6ZXJvLWZpbGxlZFxuLy8gZGF5cykgXHUyMDE0IGJldHRlciBhbmQgZmFzdGVyIHRoYW4gYSBwZXItZGF5IEpTIGxvb3AuXG5jb25zdCBnZXRSZXZlbnVlT3ZlclRpbWUgPSBhc3luYyAoXG4gIGRheXM6IG51bWJlcixcbiAgYWdlbnRJZD86IHN0cmluZyxcbik6IFByb21pc2U8SVJldmVudWVQb2ludFtdPiA9PiB7XG4gIGNvbnN0IHNjb3BlID0gYWdlbnRJZFxuICAgID8gYEFORCBiLlwicGFja2FnZUlkXCIgSU4gKFxuICAgICAgICAgU0VMRUNUIHAuXCJpZFwiXG4gICAgICAgICBGUk9NIFwidG91cl9wYWNrYWdlc1wiIHBcbiAgICAgICAgIFdIRVJFIHAuXCJhZ2VudElkXCIgPSAkMlxuICAgICAgICAgICBBTkQgcC5cImlzRGVsZXRlZFwiID0gZmFsc2VcbiAgICAgICApYFxuICAgIDogXCJcIjtcblxuICBjb25zdCByb3dzID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd1Vuc2FmZTxcbiAgICB7IGRhdGU6IHN0cmluZzsgcmV2ZW51ZTogbnVtYmVyIH1bXVxuICA+KFxuICAgIGBcbiAgICBTRUxFQ1QgdG9fY2hhcihkYXlzLmQsICdZWVlZLU1NLUREJykgQVMgZGF0ZSxcbiAgICAgICAgICAgQ09BTEVTQ0UoU1VNKGIuXCJ0b3RhbFByaWNlXCIpLCAwKTo6ZmxvYXQ4IEFTIHJldmVudWVcbiAgICBGUk9NIGdlbmVyYXRlX3NlcmllcyhcbiAgICAgIENVUlJFTlRfREFURSAtIG1ha2VfaW50ZXJ2YWwoZGF5cyA9PiAkMTo6aW50IC0gMSksXG4gICAgICBDVVJSRU5UX0RBVEUsXG4gICAgICAnMSBkYXknOjppbnRlcnZhbFxuICAgICkgQVMgZGF5cyhkKVxuICAgIExFRlQgSk9JTiBcImJvb2tpbmdzXCIgYlxuICAgICAgT04gZGF0ZV90cnVuYygnZGF5JywgYi5cInVwZGF0ZWRBdFwiKTo6ZGF0ZSA9IGRheXMuZFxuICAgICAgQU5EIGIuXCJzdGF0dXNcIiA9ICdDT01QTEVURUQnXG4gICAgICAke3Njb3BlfVxuICAgIEdST1VQIEJZIGRheXMuZFxuICAgIE9SREVSIEJZIGRheXMuZCBBU0NcbiAgICBgLFxuICAgIGRheXMsXG4gICAgLi4uKGFnZW50SWQgPyBbYWdlbnRJZF0gOiBbXSksXG4gICk7XG5cbiAgcmV0dXJuIHJvd3M7XG59O1xuXG4vLyBQYWNrYWdlLWlkIHNjb3BlIGZvciBib29raW5nIHF1ZXJpZXMuIENhbGxlcnMgc2hvcnQtY2lyY3VpdCB0aGUgZW1wdHkgY2FzZVxuLy8gKGFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMpLCBidXQgYW4gYGluOiBbXWAgZmFsbGJhY2sga2VlcHMgdGhlIHR5cGVcbi8vIG5vbi1udWxsYWJsZSB3aGlsZSBzdGlsbCBtYXRjaGluZyBub3RoaW5nIGlmIGl0IGV2ZXIgc2xpcHMgdGhyb3VnaC5cbmNvbnN0IHRvUGFja2FnZUlkU2NvcGUgPSAoXG4gIHBhY2thZ2VJZHM6IHN0cmluZ1tdLFxuKTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0+XG4gIHBhY2thZ2VJZHMubGVuZ3RoXG4gICAgPyB7IHBhY2thZ2VJZDogeyBpbjogcGFja2FnZUlkcyB9IH1cbiAgICA6IHsgcGFja2FnZUlkOiB7IGluOiBbXSB9IH07XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBjb3VudHMsIGJyZWFrZG93bnMgYW5kIHJldmVudWUgdHJlbmQuXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGFzeW5jIChkYXlzOiBudW1iZXIpOiBQcm9taXNlPElBZG1pbkRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbXG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlLFxuICAgIHVzZXJzQnlSb2xlLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoKSxcbiAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuZ3JvdXBCeSh7XG4gICAgICBieTogW1wicm9sZVwiXSxcbiAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cygpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZVxuICAgICAgLmdyb3VwQnkoe1xuICAgICAgICBieTogW1wiY2F0ZWdvcnlJZFwiXSxcbiAgICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgfSlcbiAgICAgIC50aGVuKGFzeW5jIChncm91cGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5SWRzID0gZ3JvdXBlZC5tYXAoKGcpID0+IGcuY2F0ZWdvcnlJZCk7XG4gICAgICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlOiB7IGlkOiB7IGluOiBjYXRlZ29yeUlkcyB9IH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBuYW1lTWFwID0gbmV3IE1hcChjYXRlZ29yaWVzLm1hcCgoYykgPT4gW2MuaWQsIGMubmFtZV0pKTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBlZFxuICAgICAgICAgIC5tYXAoKGcpID0+ICh7XG4gICAgICAgICAgICBjYXRlZ29yeTogbmFtZU1hcC5nZXQoZy5jYXRlZ29yeUlkKSA/PyBcIlVua25vd25cIixcbiAgICAgICAgICAgIGNvdW50OiBnLl9jb3VudC5fYWxsLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG4gICAgICB9KSxcbiAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cyksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1c2Vyc0J5Um9sZTogdXNlcnNCeVJvbGVcbiAgICAgIC5tYXAoKGcpID0+ICh7IHJvbGU6IGcucm9sZSwgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgc2NvcGVkIHRvIHRoZSBhZ2VudCdzIG93biBwYWNrYWdlcy4gRmV0Y2hlcyBvd25lZFxuLy8gICAgcGFja2FnZSBpZHMgb25jZSwgdGhlbiBldmVyeSBhZ2dyZWdhdGUgcmV1c2VzIHRoYXQgc2NvcGUgc28gdGhlIHdob2xlXG4vLyAgICBidW5kbGUgaXMgb25lIFByb21pc2UuYWxsIChubyBwZXItaXRlbSBxdWVyaWVzKS5cbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgZGF5czogbnVtYmVyLFxuKTogUHJvbWlzZTxJQWdlbnREYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW293bmVkUGFja2FnZXMsIGJvb2tpbmdzQnlTdGF0dXMsIGF2ZXJhZ2VSYXRpbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBhZ2VudElkOiB1c2VySWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXModXNlcklkKSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuYWdncmVnYXRlKHtcbiAgICAgIF9hdmc6IHsgcmF0aW5nOiB0cnVlIH0sXG4gICAgICB3aGVyZToge1xuICAgICAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0pO1xuXG4gIGNvbnN0IHBhY2thZ2VJZHMgPSBvd25lZFBhY2thZ2VzLm1hcCgocCkgPT4gcC5pZCk7XG5cbiAgLy8gQW4gYWdlbnQgd2l0aCBubyBwYWNrYWdlcyBtdXN0IHNlZSB6ZXJvcyBcdTIwMTQgc2NvcGUgaXMgdW5kZWZpbmVkIGZvciBhbiBlbXB0eVxuICAvLyBsaXN0LCBhbmQgYSBiYXJlIGB3aGVyZTogdW5kZWZpbmVkYCAvIGBBTkQ6IFt7fV1gIHdvdWxkIG90aGVyd2lzZSBtYXRjaCB0aGVcbiAgLy8gd2hvbGUgcGxhdGZvcm0gKGNyb3NzLWFnZW50IGRhdGEgbGVhaykuIFNob3J0LWNpcmN1aXQgaGVyZSBpbnN0ZWFkLlxuICBpZiAocGFja2FnZUlkcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxQYWNrYWdlczogMCxcbiAgICAgIHRvdGFsQm9va2luZ3M6IDAsXG4gICAgICB0b3RhbFJldmVudWU6IDAsXG4gICAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgICBib29raW5nc0J5U3RhdHVzLFxuICAgICAgcmV2ZW51ZU92ZXJUaW1lOiBhd2FpdCBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgdXNlcklkKSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2NvcGUgPSB0b1BhY2thZ2VJZFNjb3BlKHBhY2thZ2VJZHMpO1xuXG4gIGNvbnN0IFt0b3RhbFBhY2thZ2VzLCB0b3RhbEJvb2tpbmdzLCB0b3RhbFJldmVudWUsIHJldmVudWVPdmVyVGltZV0gPVxuICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHBhY2thZ2VJZHMubGVuZ3RoLFxuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogc2NvcGUgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBBTkQ6IFtzY29wZSwgeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH1dLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgdXNlcklkKSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCB0aGUgdXNlcidzIGJvb2tpbmdzLCBzcGVuZCwgYW5kIHVwY29taW5nIHRyaXBzLlxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8SVVzZXJEYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW3RvdGFsQm9va2luZ3MsIHRvdGFsU3BlbmQsIHVwY29taW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiB7IHVzZXJJZCB9IH0pLFxuICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IHVzZXJJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgaW46IFtCb29raW5nU3RhdHVzLlBFTkRJTkcsIEJvb2tpbmdTdGF0dXMuUEFJRCwgQm9va2luZ1N0YXR1cy5DT05GSVJNRURdLFxuICAgICAgICB9LFxuICAgICAgICB0cmF2ZWxEYXRlOiB7IGd0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0cmF2ZWxEYXRlOiB0cnVlLFxuICAgICAgICB0cmF2ZWxlcnM6IHRydWUsXG4gICAgICAgIHRvdGFsUHJpY2U6IHRydWUsXG4gICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIHRpdGxlOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IHRyYXZlbERhdGU6IFwiYXNjXCIgfSxcbiAgICAgIHRha2U6IDUsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFNwZW5kOiB0b051bWJlcih0b3RhbFNwZW5kLl9zdW0udG90YWxQcmljZSksXG4gICAgdXBjb21pbmdDb3VudDogdXBjb21pbmcubGVuZ3RoLFxuICAgIHVwY29taW5nOiB1cGNvbWluZy5tYXAoKGIpID0+ICh7XG4gICAgICAuLi5iLFxuICAgICAgdG90YWxQcmljZTogTnVtYmVyKGIudG90YWxQcmljZSksXG4gICAgfSkpLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFNlcnZpY2UgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGRhc2hib2FyZFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBkYXlzOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDM2NSkuZGVmYXVsdCgzMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFZhbGlkYXRpb25zID0ge1xuICBkYXNoYm9hcmRRdWVyeVNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYXltZW50Q29udHJvbGxlciB9IGZyb20gXCIuL3BheW1lbnQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGF5bWVudFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGF5bWVudC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPcGVuIGEgZ2F0ZXdheSBzZXNzaW9uIGZvciB0aGUgdXNlcidzIHBlbmRpbmcgYm9va2luZyAoVVNFUiBvbmx5KS5cbnJvdXRlci5wb3N0KFxuICBcIi9jcmVhdGVcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuY3JlYXRlU2NoZW1hIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5jcmVhdGVQYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIHRoZSBvdXRjb21lIGhlcmUgKHN1Y2Nlc3MvZmFpbC9jYW5jZWwpIGFuZCB3ZVxuLy8gcmVkaXJlY3QgdGhlIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxucm91dGVyLnBvc3QoXG4gIFwiL2NvbmZpcm1cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5jb25maXJtUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBpbnN0YW50IHBheW1lbnQgbm90aWZpY2F0aW9uOyBzYW1lIGlkZW1wb3RlbnQgc2V0dGxlLlxucm91dGVyLnBvc3QoXG4gIFwiL2lwblwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmlwbixcbik7XG5cbmV4cG9ydCBjb25zdCBwYXltZW50Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IElHYXRld2F5UmVzdWx0IH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcbmltcG9ydCB7IHBheW1lbnRTZXJ2aWNlIH0gZnJvbSBcIi4vcGF5bWVudC5zZXJ2aWNlXCI7XG5cbmNvbnN0IGNyZWF0ZVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHBheW1lbnRTZXJ2aWNlLmNyZWF0ZVBheW1lbnRTZXNzaW9uKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGF5bWVudCBzZXNzaW9uIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogc2Vzc2lvbixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBjYWxsYmFjayB0YXJnZXQgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgaGVyZSAoc2VydmVyLXRvLXNlcnZlcikgYWZ0ZXIgdGhlXG4vLyBzaG9wcGVyIGZpbmlzaGVzIGF0IHRoZSBnYXRld2F5LiBXZSBzZXR0bGUgdGhlIHBheW1lbnQsIHRoZW4gYm91bmNlIHRoZVxuLy8gYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5jb25zdCBjb25maXJtUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG4gICAgY29uc3Qgc3RhdHVzID0gU3RyaW5nKHJlcS5xdWVyeS5zdGF0dXMgPz8gXCJmYWlsXCIpO1xuXG4gICAgYXdhaXQgcGF5bWVudFNlcnZpY2UucHJvY2Vzc0dhdGV3YXlSZXN1bHQoXG4gICAgICBib29raW5nSWQsXG4gICAgICB0cmFuSWQsXG4gICAgICByZXEuYm9keSBhcyBJR2F0ZXdheVJlc3VsdCxcbiAgICApO1xuXG4gICAgY29uc3QgcmVkaXJlY3RCYXNlID1cbiAgICAgIGNvbmZpZy5ub2RlX2VudiA9PT0gXCJwcm9kdWN0aW9uXCJcbiAgICAgICAgPyBjb25maWcuZnJvbnRlbmRfdXJsX3Byb2RcbiAgICAgICAgOiBjb25maWcuZnJvbnRlbmRfdXJsX2RldjtcbiAgICBjb25zdCBwYWdlID0gW1wic3VjY2Vzc1wiLCBcImZhaWxcIiwgXCJjYW5jZWxcIl0uaW5jbHVkZXMoc3RhdHVzKSA/IHN0YXR1cyA6IFwiZmFpbFwiO1xuXG4gICAgcmVzLnJlZGlyZWN0KDMwMiwgYCR7cmVkaXJlY3RCYXNlfS9wYXltZW50LyR7cGFnZX0/Ym9va2luZ0lkPSR7Ym9va2luZ0lkfWApO1xuICB9LFxuKTtcblxuLy8gUHVibGljIElQTiB0YXJnZXQgXHUyMDE0IHRoZSBnYXRld2F5IG5vdGlmaWVzIHVzIGhlcmUgaW5kZXBlbmRlbnRseSBvZiB0aGVcbi8vIHJlZGlyZWN0LiBTYW1lIGlkZW1wb3RlbnQgc2V0dGxlOyBhbHdheXMgYW5zd2VycyAyMDAgc28gdGhlIGdhdGV3YXkgc3RvcHMgcmV0cnlpbmcuXG5jb25zdCBpcG4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuXG4gICAgYXdhaXQgcGF5bWVudFNlcnZpY2UucHJvY2Vzc0dhdGV3YXlSZXN1bHQoXG4gICAgICBib29raW5nSWQsXG4gICAgICB0cmFuSWQsXG4gICAgICByZXEuYm9keSBhcyBJR2F0ZXdheVJlc3VsdCxcbiAgICApO1xuXG4gICAgcmVzLnN0YXR1cygyMDApLnR5cGUoXCJ0ZXh0L3BsYWluXCIpLnNlbmQoXCJPS1wiKTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBwYXltZW50Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUGF5bWVudCxcbiAgY29uZmlybVBheW1lbnQsXG4gIGlwbixcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcblxuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnL2luZGV4XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBQYXltZW50IGlzIGFuIG9wdGlvbmFsIGZlYXR1cmU6IHRoZSBBUEkgbXVzdCBib290IGFuZCBzZXJ2ZSBldmVyeXRoaW5nIGVsc2Vcbi8vIGV2ZW4gd2hlbiB0aGUgU1NMQ29tbWVyeiBzdG9yZSBpc24ndCBjb25maWd1cmVkIHlldC4gVGhlc2UgdGhyb3cgYSBjbGVhbiA0MDBcbi8vIG9uIHRoZSBwYXltZW50LW9ubHkgcGF0aHMgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIHdob2xlIGRlcGxveW1lbnQgYXQgYm9vdC5cbmNvbnN0IHJlcXVpcmVDb25maWcgPSAoKSA9PiB7XG4gIGlmICghY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkIHx8ICFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBTU0xfQ09NTUVSWl9TVE9SRV9JRCBhbmQgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAoIWNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBCQUNLRU5EX1BVQkxJQ19VUkwgdG8gdGhlIHB1YmxpY2x5IHJlYWNoYWJsZSBiYWNrZW5kIFVSTC5cIixcbiAgICApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc3RvcmVJZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkLFxuICAgIHN0b3JlUGFzc3dvcmQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCxcbiAgfTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyekluaXRSZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZmFpbGVkcmVhc29uPzogc3RyaW5nO1xuICBzZXNzaW9ua2V5Pzogc3RyaW5nO1xuICBHYXRld2F5UGFnZVVSTD86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICB2YWxfaWQ/OiBzdHJpbmc7XG4gIGFtb3VudD86IHN0cmluZztcbiAgY3VycmVuY3k/OiBzdHJpbmc7XG4gIGJhbmtfdHJhbl9pZD86IHN0cmluZztcbiAgY2FyZF90eXBlPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJzdWNjZXNzXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiBpbml0IHJlamVjdGVkOiAke2RhdGEuZmFpbGVkcmVhc29uID8/IGRhdGEuc3RhdHVzfWApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb24uIHN0YXR1czogVkFMSUQgLyBWQUxJREFURUQgL1xuLy8gSU5WQUxJRF9UUkFOU0FDVElPTiAvIEZBSUxFRC4gVkFMSURBVEVEIG1lYW5zIHRoZSB0cmFuc2FjdGlvbiB3YXMgdmVyaWZpZWQgYmVmb3JlXG4vLyAoaWRlbXBvdGVudCksIElOVkFMSURfVFJBTlNBQ1RJT04gbWVhbnMgdGhlIGFtb3VudC90cmFuc2FjdGlvbiBtaXNtYXRjaGVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpWYWxpZGF0ZShvcHRpb25zOiB7XG4gIHZhbF9pZDogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHZhbF9pZDogb3B0aW9ucy52YWxfaWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3ZhbGlkYXRlX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHZhbGlkYXRpb24gZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHZhbGlkYXRpb24gcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn0iLCAiaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGF5bWVudFN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBTc2xjb21tZXJ6SW5pdFJlc3VsdCwgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQsIGdlbmVyYXRlVHJhbklkLCBzc2xjb21tZXJ6SW5pdCwgc3NsY29tbWVyelZhbGlkYXRlIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQsIElQYXltZW50Q3JlYXRlUmVxdWVzdCwgSVBheW1lbnRHYXRld2F5T3V0Y29tZSB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIFVSTHMgc2VydmVyLXRvLXNlcnZlciwgc28gdGhlIGhvc3QgbXVzdCBiZVxuLy8gcHVibGljbHkgcmVhY2hhYmxlIFx1MjAxNCBjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsLCBuZXZlciBsb2NhbGhvc3QgaW4gc2FuZGJveC5cbmNvbnN0IGJ1aWxkQ2FsbGJhY2tVcmwgPSAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAga2luZDogXCJzdWNjZXNzXCIgfCBcImZhaWxcIiB8IFwiY2FuY2VsXCIgfCBcImlwblwiLFxuKSA9PlxuICBgJHtjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsfS9hcGkvcGF5bWVudHMvJHtraW5kID09PSBcImlwblwiID8gXCJpcG5cIiA6IFwiY29uZmlybVwifT9ib29raW5nSWQ9JHtib29raW5nSWR9JnRyYW5JZD0ke3RyYW5JZH0ke1xuICAgIGtpbmQgPT09IFwiaXBuXCIgPyBcIlwiIDogYCZzdGF0dXM9JHtraW5kfWBcbiAgfWA7XG5cbi8vIE9wZW5zIGFuIFNTTENvbW1lcnogc2Vzc2lvbiBmb3IgYSBwZW5kaW5nIGJvb2tpbmcgdGhlIHVzZXIgb3ducy4gVGhlIGJvb2tpbmdcbi8vIGFtb3VudCBpcyBmcm96ZW4gYXQgaW5pdGlhdGlvbjsgaXQgbmV2ZXIgcmUtcmVhZHMgdGhlIHBhY2thZ2UgcHJpY2UuXG5jb25zdCBjcmVhdGVQYXltZW50U2Vzc2lvbiA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElQYXltZW50Q3JlYXRlUmVxdWVzdCxcbik6IFByb21pc2U8eyBwYXltZW50SWQ6IHN0cmluZzsgdHJhbklkOiBzdHJpbmc7IHBheW1lbnRVcmw6IHN0cmluZyB8IG51bGwgfT4gPT4ge1xuICBjb25zdCB7IGJvb2tpbmdJZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9LFxuICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9IH0sXG4gIH0pO1xuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwYXkgZm9yIHRoaXMgYm9va2luZy5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzID09PSBCb29raW5nU3RhdHVzLlBBSUQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlRoaXMgYm9va2luZyBpcyBhbHJlYWR5IHBhaWQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyAhPT0gQm9va2luZ1N0YXR1cy5QRU5ESU5HKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgYENhbm5vdCBwYXkgZm9yIGEgYm9va2luZyBpbiAke2Jvb2tpbmcuc3RhdHVzLnRvTG93ZXJDYXNlKCl9IHN0YXR1cy5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgcGhvbmU6IHRydWUgfSxcbiAgfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSk7XG4gIGNvbnN0IHRyYW5JZCA9IGdlbmVyYXRlVHJhbklkKCk7XG5cbiAgLy8gT25lIGxpdmUgc2Vzc2lvbiBwZXIgYm9va2luZzogdGhlIGxlZGdlciByb3cgaXMgY3JlYXRlZCBhdG9taWNhbGx5IHdoaWxlXG4gIC8vIHN1cGVyc2VkaW5nIGFueSBhYmFuZG9uZWQgc2Vzc2lvbiwgdGhlbiB0aGUgZ2F0ZXdheSBpcyBhc2tlZC4gVGhlIHJvd1xuICAvLyBzdXJ2aXZlcyByZWdhcmRsZXNzIG9mIHRoZSBnYXRld2F5IHJlc3BvbnNlIFx1MjAxNCBpbml0IGZhaWx1cmUgZmxpcHMgaXQgdG9cbiAgLy8gRkFJTEVEIGJlbG93IHNvIGEgdHJ1dGhmdWwgZW50cnkgYWx3YXlzIGV4aXN0cy5cbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHgucGF5bWVudC5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBib29raW5nSWQsXG4gICAgICAgIHRyYW5JZCxcbiAgICAgICAgYW1vdW50LFxuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVELFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGluaXQ6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGluaXQgPSBhd2FpdCBzc2xjb21tZXJ6SW5pdCh7XG4gICAgICB0b3RhbF9hbW91bnQ6IGFtb3VudCxcbiAgICAgIHRyYW5faWQ6IHRyYW5JZCxcbiAgICAgIHN1Y2Nlc3NfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcInN1Y2Nlc3NcIiksXG4gICAgICBmYWlsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJmYWlsXCIpLFxuICAgICAgY2FuY2VsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJjYW5jZWxcIiksXG4gICAgICBpcG5fdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImlwblwiKSxcbiAgICAgIGN1c19uYW1lOiB1c2VyLm5hbWUsXG4gICAgICBjdXNfZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICBjdXNfcGhvbmU6IHVzZXIucGhvbmUgPz8gXCIwMTcxMTExMTExMVwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIGtlZXAgdGhlIGxlZGdlciB0cnV0aGZ1bCBcdTIwMTQgdGhlIHNlc3Npb24gbmV2ZXIgcmVhY2hlZCB0aGUgZ2F0ZXdheS4gVGhlXG4gICAgLy8gc3RhdHVzIGd1YXJkIG1ha2VzIGEgY29uY3VycmVudCAvY3JlYXRlIHRoYXQgYWxyZWFkeSBjYW5jZWxsZWQgdGhpcyByb3dcbiAgICAvLyB3aW4gdGhlIHJhY2UgKHRoYXQgcm93IHN0YXlzIGNhbmNlbGxlZCwgdGhpcyBvbmUgZmFpbHMgb25seSBpZiBsaXZlKS5cbiAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIC8vIHN0b3JlIHRoZSBnYXRld2F5IFVSTHMgb25seSBpZiB0aGUgcm93IGlzIHN0aWxsIHRoZSBsaXZlIHNlc3Npb24uXG4gIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgZGF0YTogeyBnYXRld2F5UGFnZVVybDogaW5pdC5HYXRld2F5UGFnZVVSTCwgc3NsU2Vzc2lvbktleTogaW5pdC5zZXNzaW9ua2V5IH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudElkOiBwYXltZW50LmlkLFxuICAgIHRyYW5JZDogcGF5bWVudC50cmFuSWQsXG4gICAgcGF5bWVudFVybDogaW5pdC5HYXRld2F5UGFnZVVSTCA/PyBudWxsLFxuICB9O1xufTtcblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uOiB0aGUgdmFsaWRhdG9yIHJldHVybnNcbi8vIFZBTElEIChmaXJzdCBjaGVjaykgb3IgVkFMSURBVEVEIChhbHJlYWR5IHZlcmlmaWVkIGJlZm9yZSkgd2l0aCB0aGUgYW1vdW50LlxuLy8gQW55dGhpbmcgZWxzZSBcdTIwMTQgb3IgYSBtaXNtYXRjaGVkIGFtb3VudCBcdTIwMTQgZmFpbHMgdGhlIHBheW1lbnQuXG5jb25zdCB2ZXJpZnlTdWNjZXNzID0gYXN5bmMgKFxuICB2YWxJZDogc3RyaW5nLFxuICBleHBlY3RlZEFtb3VudDogbnVtYmVyLFxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGw7IG1hdGNoZXNBbW91bnQ6IGJvb2xlYW4gfT4gPT4ge1xuICBsZXQgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgdmVyaWZpZWQgPSBhd2FpdCBzc2xjb21tZXJ6VmFsaWRhdGUoeyB2YWxfaWQ6IHZhbElkIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyB2YWxpZGF0b3IgdW5yZWFjaGFibGUgXHUyMDE0IGZhaWwgdGhlIHBheW1lbnQgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IG51bGwsIG1hdGNoZXNBbW91bnQ6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB2YWxpZFN0YXR1cyA9XG4gICAgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEXCIgfHwgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEQVRFRFwiO1xuICBjb25zdCBtYXRjaGVzQW1vdW50ID1cbiAgICB2ZXJpZmllZC5hbW91bnQgIT09IHVuZGVmaW5lZCAmJiBOdW1iZXIodmVyaWZpZWQuYW1vdW50KSA9PT0gZXhwZWN0ZWRBbW91bnQ7XG5cbiAgcmV0dXJuIHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQ6IHZhbGlkU3RhdHVzICYmIG1hdGNoZXNBbW91bnQgfTtcbn07XG5cbi8vIFNoYXJlZCBieSB0aGUgY29uZmlybSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIElQTiBlbmRwb2ludHMuIElkZW1wb3RlbnQ6IGFcbi8vIHNldHRsZWQgcGF5bWVudCBzaG9ydC1jaXJjdWl0cywgc28gdGhlIGRvdWJsZS1maXJpbmcgSVBOIG5ldmVyIGRvdWJsZS1jaGFyZ2VzLlxuY29uc3QgcHJvY2Vzc0dhdGV3YXlSZXN1bHQgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAgcmVzdWx0OiBJR2F0ZXdheVJlc3VsdCxcbik6IFByb21pc2U8SVBheW1lbnRHYXRld2F5T3V0Y29tZT4gPT4ge1xuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgdHJhbklkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgYm9va2luZzoge1xuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFwYXltZW50IHx8IHBheW1lbnQuYm9va2luZ0lkICE9PSBib29raW5nSWQpIHtcbiAgICAvLyBBIGNhbGxiYWNrIGZvciBhIHNlc3Npb24gd2UgbmV2ZXIgY3JlYXRlZCBcdTIwMTQgbm90aGluZyB0byBzZXR0bGUuXG4gICAgcmV0dXJuIHsgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQsIGJvb2tpbmdTdGF0dXM6IG51bGwsIGNoYW5nZWQ6IGZhbHNlIH07XG4gIH1cblxuICBpZiAocGF5bWVudC5zdGF0dXMgPT09IFBheW1lbnRTdGF0dXMuU1VDQ0VTUykge1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIENhbmNlbCBjYWxsYmFjayBcdTIwMTQgdGhlIHNob3BwZXIgYWJhbmRvbmVkIGNoZWNrb3V0LCBubyBjaGFyZ2Ugd2FzIG1hZGUuXG4gIGlmIChyZXN1bHQuZmFpbF9zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIgfHwgcmVzdWx0LnN0YXR1cyA9PT0gXCJDQU5DRUxMRURcIikge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vIHZhbF9pZCBtZWFucyB0aGUgZ2F0ZXdheSByZXBvcnRlZCBhIGZhaWx1cmUgKGZhaWxfdXJsKSBcdTIwMTQgbm90aGluZyB0byB2ZXJpZnkuXG4gIGlmICghcmVzdWx0LnZhbF9pZCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN1Y2Nlc3MgcGF0aDogdmVyaWZ5IHNlcnZlci1zaWRlIGFuZCBvbmx5IHRoZW4gbWFyayB0aGUgYm9va2luZyBhcyBwYWlkLlxuICBjb25zdCB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50IH0gPSBhd2FpdCB2ZXJpZnlTdWNjZXNzKFxuICAgIHJlc3VsdC52YWxfaWQsXG4gICAgTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgKTtcblxuICBpZiAoIW1hdGNoZXNBbW91bnQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2V0dGxlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgICB2YWxJZDogcmVzdWx0LnZhbF9pZCxcbiAgICAgICAgY2FyZFR5cGU6IHJlc3VsdC5jYXJkX3R5cGUgPz8gdmVyaWZpZWQ/LmNhcmRfdHlwZSxcbiAgICAgICAgYmFua1RyYW5JZDogcmVzdWx0LmJhbmtfdHJhbl9pZCA/PyB2ZXJpZmllZD8uYmFua190cmFuX2lkLFxuICAgICAgICBwYWlkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gY29tcGFyZS1hbmQtc2V0OiBvbmx5IGEgc3RpbGwtUEVORElORyBib29raW5nIGJlY29tZXMgUEFJRDsgYSBib29raW5nIHRoYXRcbiAgICAvLyB3YXMgY29uY3VycmVudGx5IGNvbmZpcm1lZCBvciBjYW5jZWxsZWQga2VlcHMgaXRzIHN0YXRlLCB0aGUgbW9uZXkgc3RheXMgb24uXG4gICAgYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfSk7XG5cbiAgY29uc3QgYm9va2luZ0FmdGVyID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBcInBheW1lbnQgcmVjZWl2ZWRcIiBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIGNhbGxiYWNrXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgIGVtYWlsOiBwYXltZW50LmJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IHBheW1lbnQuYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IHBheW1lbnQuYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogcGF5bWVudC5ib29raW5nLnRyYXZlbERhdGUsXG4gICAgICB0cmF2ZWxlcnM6IHBheW1lbnQuYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudFN0YXR1czogc2V0dGxlZC5zdGF0dXMsXG4gICAgYm9va2luZ1N0YXR1czogYm9va2luZ0FmdGVyPy5zdGF0dXMgPz8gbnVsbCxcbiAgICBjaGFuZ2VkOiB0cnVlLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRTZXJ2aWNlID0ge1xuICBjcmVhdGVQYXltZW50U2Vzc2lvbixcbiAgcHJvY2Vzc0dhdGV3YXlSZXN1bHQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG59KTtcblxuY29uc3QgY2FsbGJhY2tRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6LnN0cmluZygpLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxuICB0cmFuSWQ6IHouc3RyaW5nKCkubWluKDEpLFxuICBzdGF0dXM6IHouZW51bShbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXSkub3B0aW9uYWwoKSxcbn0pO1xuXG4vLyBCb2R5IG9mIHRoZSBnYXRld2F5IFBPU1QgXHUyMDE0IG9ubHkgZmllbGRzIHdlIGNvbnN1bWUsIGFsbCBvcHRpb25hbCBiZWNhdXNlIHRoZVxuLy8gc2hhcGUgZGlmZmVycyBiZXR3ZWVuIHN1Y2Nlc3MgLyBmYWlsIC8gY2FuY2VsIC8gSVBOIGNhbGxiYWNrcy5cbmNvbnN0IGdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHZhbF9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgZmFpbF9zdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY2FyZF90eXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGJhbmtfdHJhbl9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjdXJyZW5jeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBhbW91bnQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlUGF5bWVudFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQ2FsbGJhY2tRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNhbGxiYWNrUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnYXRld2F5UmVzdWx0U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBjYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICBnYXRld2F5UmVzdWx0U2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxlQUFlOzs7QUNMdEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLFNBQVM7QUFFbEIsT0FBTyxPQUFPO0FBQUEsRUFDWixPQUFPO0FBQUEsRUFDUCxNQUFNLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRyxNQUFNO0FBQ3ZDLENBQUM7QUFLRCxJQUFNLFlBQVksRUFBRSxPQUFPO0FBQUEsRUFDekIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFBQSxFQUMvQixVQUFVLEVBQUUsS0FBSyxDQUFDLGVBQWUsWUFBWSxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1yRSxrQkFBa0IsRUFBRSxPQUFP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YTtBQUN0QyxJQUFJLElBQUksYUFBYSxVQUFVO0FBQy9CLElBQUksSUFBSSxrQkFBa0IsZUFBZTtBQUN6QyxJQUFJLElBQUksaUJBQWlCLGFBQWE7QUFFdEMsSUFBSSxJQUFJLGdCQUFlO0FBQ3ZCLElBQUksSUFBSSwwQkFBa0I7QUFFMUIsSUFBTyxjQUFROzs7QStEbkhmLElBQU8sZ0JBQVE7IiwKICAibmFtZXMiOiBbInBhdGgiLCAiY29uZmlnIiwgIkJ1ZmZlciIsICJBbnlOdWxsIiwgIkRiTnVsbCIsICJEZWNpbWFsIiwgIkpzb25OdWxsIiwgIk51bGxUeXBlcyIsICJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yIiwgIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yIiwgIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yIiwgIlNxbCIsICJlbXB0eSIsICJqb2luIiwgInJhdyIsICJydW50aW1lIiwgImh0dHBTdGF0dXMiLCAicmVmcmVzaFRva2VuIiwgInJlZnJlc2hUb2tlbiIsICJyZWdpc3RlclVzZXIiLCAiaHR0cFN0YXR1cyIsICJsb2dpblVzZXIiLCAiZ29vZ2xlTG9naW4iLCAiZGVtb0xvZ2luIiwgInoiLCAieiIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJiY3J5cHQiLCAiYmNyeXB0IiwgInVwZGF0ZVByb2ZpbGUiLCAiaHR0cFN0YXR1cyIsICJnZXRVc2VycyIsICJjaGFuZ2VSb2xlIiwgImNoYW5nZVN0YXR1cyIsICJkZWxldGVVc2VyIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJtdWx0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgIm11bHRlciIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZU1lc3NhZ2UiLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQm9va2luZyIsICJodHRwU3RhdHVzIiwgImdldE15Qm9va2luZ3MiLCAiZ2V0QWdlbnRCb29raW5ncyIsICJnZXRCb29raW5nRGV0YWlsIiwgImdldEFsbEJvb2tpbmdzIiwgInVwZGF0ZUJvb2tpbmdTdGF0dXMiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlUmV2aWV3IiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNhdGVnb3J5IiwgImh0dHBTdGF0dXMiLCAiZ2V0QWxsQ2F0ZWdvcmllcyIsICJ1cGRhdGVDYXRlZ29yeSIsICJkZWxldGVDYXRlZ29yeSIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlUGFja2FnZSIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1BhY2thZ2VzIiwgImdldFBhY2thZ2VCeVNsdWciLCAiZ2V0QWxsUGFja2FnZXMiLCAiZ2V0TXlQYWNrYWdlcyIsICJ1cGRhdGVQYWNrYWdlIiwgImNoYW5nZVBhY2thZ2VTdGF0dXMiLCAic29mdERlbGV0ZVBhY2thZ2UiLCAieiIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgImdlbmVyYXRlVW5pcXVlU2x1ZyIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBvc3QiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQb3N0cyIsICJnZXRQb3N0QnlTbHVnIiwgImdldEFsbFBvc3RzIiwgInVwZGF0ZVBvc3QiLCAiY2hhbmdlUG9zdFN0YXR1cyIsICJzb2Z0RGVsZXRlUG9zdCIsICJ6IiwgInRpdGxlU2NoZW1hIiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldEFkbWluRGFzaGJvYXJkIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWdlbnREYXNoYm9hcmQiLCAiZ2V0VXNlckRhc2hib2FyZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJyYW5kb21VVUlEIiwgImh0dHBTdGF0dXMiLCAieiIsICJjcmVhdGVTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciJdCn0K
