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
  graph: "lARPgAEPDgAAoQIAIJcBAACfAgAwmAEAABoAEJkBAACfAgAwmgEBAAAAAaQBAACgAuEBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAd0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhAQAAAAEAIBYFAACwAgAgBgAAoQIAIAsAAP4BACAMAAD_AQAglwEAAK0CADCYAQAAAwAQmQEAAK0CADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhBAUAAOQDACAGAADgAwAgCwAArwMAIAwAALADACAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAAAAAaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEA9QEAIaQBAACrAt0BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2QFAAPwBACHaAQIA-wEAIdsBEACmAgAhAwcAAOADACAIAADhAwAgCgAA4wMAIA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQAAAAGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQMAAAAJACABAAAKADACAAALACASCQAAqQIAIJcBAAClAgAwmAEAAA0AEJkBAAClAgAwmgEBAPUBACGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEA9QEAIc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACEHCQAA4gMAIM0BAACxAgAg0QEAALECACDSAQAAsQIAINMBAACxAgAg1AEAALECACDVAQAAsQIAIBIJAACpAgAglwEAAKUCADCYAQAADQAQmQEAAKUCADCaAQEAAAABpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAAAAAc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIAwHAAChAgAgCAAApAIAIJcBAACjAgAwmAEAABIAEJkBAACjAgAwmgEBAPUBACGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACECBwAA4AMAIAgAAOEDACANBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQAAAAGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACHiAQAAogIAIAMAAAASACABAAATADACAAAUACABAAAACQAgAQAAABIAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgDw4AAKECACCXAQAAnwIAMJgBAAAaABCZAQAAnwIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhAQ4AAOADACADAAAAGgAgAQAAGwAwAgAAAQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAABoAIAEAAAABACADAAAAGgAgAQAAGwAwAgAAAQAgAwAAABoAIAEAABsAMAIAAAEAIAMAAAAaACABAAAbADACAAABACAMDgAA3wMAIJoBAQAAAAGkAQAAAOEBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAAB3QEBAAAAAd4BAQAAAAHfAQEAAAAB4QEBAAAAAQEUAAAlACALmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAHhAQEAAAABARQAACcAMAEUAAAnADAMDgAA3gMAIJoBAQC3AgAhpAEAAM0C4QEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAId0BAQC3AgAh3gEBALcCACHfAQEAtwIAIeEBAQC3AgAhAgAAAAEAIBQAACoAIAuaAQEAtwIAIaQBAADNAuEBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHdAQEAtwIAId4BAQC3AgAh3wEBALcCACHhAQEAtwIAIQIAAAAaACAUAAAsACACAAAAGgAgFAAALAAgAwAAAAEAIBsAACUAIBwAACoAIAEAAAABACABAAAAGgAgAwQAANsDACAhAADdAwAgIgAA3AMAIA6XAQAAmwIAMJgBAAAzABCZAQAAmwIAMJoBAQDaAQAhpAEAAJwC4QEiqAEgAN8BACGqAUAA4QEAIasBQADhAQAhugEBANoBACG7AQEA2gEAId0BAQDaAQAh3gEBANoBACHfAQEA2gEAIeEBAQDaAQAhAwAAABoAIAEAADIAMCAAADMAIAMAAAAaACABAAAbADACAAABACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACkAwAgCAAA_AIAIAoAAP0CACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABARQAADsAIAmaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABARQAAD0AMAEUAAA9ADAMBwAAogMAIAgAAOsCACAKAADsAgAgmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQIAAAALACAUAABAACAJmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQIAAAAJACAUAABCACACAAAACQAgFAAAQgAgAwAAAAsAIBsAADsAIBwAAEAAIAEAAAALACABAAAACQAgBQQAANYDACAhAADZAwAgIgAA2AMAIDMAANcDACA0AADaAwAgDJcBAACXAgAwmAEAAEkAEJkBAACXAgAwmgEBANoBACGkAQAAmALdASKqAUAA4QEAIasBQADhAQAhyQEBANoBACHKAQEA2gEAIdkBQADhAQAh2gECAOABACHbARAAggIAIQMAAAAJACABAABIADAgAABJACADAAAACQAgAQAACgAwAgAACwAgCQMAAP0BACCXAQAAlgIAMJgBAABPABCZAQAAlgIAMJoBAQAAAAGbAQEAAAABqgFAAPwBACGrAUAA_AEAIbsBAQAAAAEBAAAATAAgAQAAAEwAIAkDAAD9AQAglwEAAJYCADCYAQAATwAQmQEAAJYCADCaAQEA9QEAIZsBAQD1AQAhqgFAAPwBACGrAUAA_AEAIbsBAQD1AQAhAQMAAK4DACADAAAATwAgAQAAUAAwAgAATAAgAwAAAE8AIAEAAFAAMAIAAEwAIAMAAABPACABAABQADACAABMACAGAwAA1QMAIJoBAQAAAAGbAQEAAAABqgFAAAAAAasBQAAAAAG7AQEAAAABARQAAFQAIAWaAQEAAAABmwEBAAAAAaoBQAAAAAGrAUAAAAABuwEBAAAAAQEUAABWADABFAAAVgAwBgMAAMsDACCaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAEwAIBQAAFkAIAWaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAE8AIBQAAFsAIAIAAABPACAUAABbACADAAAATAAgGwAAVAAgHAAAWQAgAQAAAEwAIAEAAABPACADBAAAyAMAICEAAMoDACAiAADJAwAgCJcBAACVAgAwmAEAAGIAEJkBAACVAgAwmgEBANoBACGbAQEA2gEAIaoBQADhAQAhqwFAAOEBACG7AQEA2gEAIQMAAABPACABAABhADAgAABiACADAAAATwAgAQAAUAAwAgAATAAgC5cBAACUAgAwmAEAAGgAEJkBAACUAgAwmgEBAAAAAZsBAQD1AQAhnAEBAPUBACGqAUAA_AEAIasBQAD8AQAh1gEBAPUBACHXAQEA9QEAIdgBIAD6AQAhAQAAAGUAIAEAAABlACALlwEAAJQCADCYAQAAaAAQmQEAAJQCADCaAQEA9QEAIZsBAQD1AQAhnAEBAPUBACGqAUAA_AEAIasBQAD8AQAh1gEBAPUBACHXAQEA9QEAIdgBIAD6AQAhAAMAAABoACABAABpADACAABlACADAAAAaAAgAQAAaQAwAgAAZQAgAwAAAGgAIAEAAGkAMAIAAGUAIAiaAQEAAAABmwEBAAAAAZwBAQAAAAGqAUAAAAABqwFAAAAAAdYBAQAAAAHXAQEAAAAB2AEgAAAAAQEUAABtACAImgEBAAAAAZsBAQAAAAGcAQEAAAABqgFAAAAAAasBQAAAAAHWAQEAAAAB1wEBAAAAAdgBIAAAAAEBFAAAbwAwARQAAG8AMAiaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGqAUAAvgIAIasBQAC-AgAh1gEBALcCACHXAQEAtwIAIdgBIAC8AgAhAgAAAGUAIBQAAHIAIAiaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGqAUAAvgIAIasBQAC-AgAh1gEBALcCACHXAQEAtwIAIdgBIAC8AgAhAgAAAGgAIBQAAHQAIAIAAABoACAUAAB0ACADAAAAZQAgGwAAbQAgHAAAcgAgAQAAAGUAIAEAAABoACADBAAAxQMAICEAAMcDACAiAADGAwAgC5cBAACTAgAwmAEAAHsAEJkBAACTAgAwmgEBANoBACGbAQEA2gEAIZwBAQDaAQAhqgFAAOEBACGrAUAA4QEAIdYBAQDaAQAh1wEBANoBACHYASAA3wEAIQMAAABoACABAAB6ADAgAAB7ACADAAAAaAAgAQAAaQAwAgAAZQAgAQAAAA8AIAEAAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAANACABAAAOADACAAAPACAPCQAAxAMAIJoBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABywEBAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAQEUAACDAQAgDpoBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABywEBAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAQEUAACFAQAwARQAAIUBADAPCQAAwwMAIJoBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcsBAQC3AgAhzAEBALcCACHNAQEAuAIAIc4BEADoAgAhzwEBALcCACHRAQEAuAIAIdIBAQC4AgAh0wEBALgCACHUAQEAuAIAIdUBQAD4AgAhAgAAAA8AIBQAAIgBACAOmgEBALcCACGkAQAA9wLRASKqAUAAvgIAIasBQAC-AgAhywEBALcCACHMAQEAtwIAIc0BAQC4AgAhzgEQAOgCACHPAQEAtwIAIdEBAQC4AgAh0gEBALgCACHTAQEAuAIAIdQBAQC4AgAh1QFAAPgCACECAAAADQAgFAAAigEAIAIAAAANACAUAACKAQAgAwAAAA8AIBsAAIMBACAcAACIAQAgAQAAAA8AIAEAAAANACALBAAAvgMAICEAAMEDACAiAADAAwAgMwAAvwMAIDQAAMIDACDNAQAAsQIAINEBAACxAgAg0gEAALECACDTAQAAsQIAINQBAACxAgAg1QEAALECACARlwEAAIwCADCYAQAAkQEAEJkBAACMAgAwmgEBANoBACGkAQAAjQLRASKqAUAA4QEAIasBQADhAQAhywEBANoBACHMAQEA2gEAIc0BAQDbAQAhzgEQAIICACHPAQEA2gEAIdEBAQDbAQAh0gEBANsBACHTAQEA2wEAIdQBAQDbAQAh1QFAAI4CACEDAAAADQAgAQAAkAEAMCAAAJEBACADAAAADQAgAQAADgAwAgAADwAgAQAAABQAIAEAAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAMAAAASACABAAATADACAAAUACAJBwAAmQMAIAgAAN0CACCaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAckBAQAAAAHKAQEAAAABARQAAJkBACAHmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABygEBAAAAAQEUAACbAQAwARQAAJsBADAJBwAAlwMAIAgAANsCACCaAQEAtwIAIaoBQAC-AgAhqwFAAL4CACHAAQIAvQIAIcgBAQC3AgAhyQEBALcCACHKAQEAtwIAIQIAAAAUACAUAACeAQAgB5oBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHJAQEAtwIAIcoBAQC3AgAhAgAAABIAIBQAAKABACACAAAAEgAgFAAAoAEAIAMAAAAUACAbAACZAQAgHAAAngEAIAEAAAAUACABAAAAEgAgBQQAALkDACAhAAC8AwAgIgAAuwMAIDMAALoDACA0AAC9AwAgCpcBAACLAgAwmAEAAKcBABCZAQAAiwIAMJoBAQDaAQAhqgFAAOEBACGrAUAA4QEAIcABAgDgAQAhyAEBANoBACHJAQEA2gEAIcoBAQDaAQAhAwAAABIAIAEAAKYBADAgAACnAQAgAwAAABIAIAEAABMAMAIAABQAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgEwUAAKcDACAGAAC4AwAgCwAAqAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDDAQEAAAABxAEBAAAAAQEUAACvAQAgD5oBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMMBAQAAAAHEAQEAAAABARQAALEBADABFAAAsQEAMBMFAACMAwAgBgAAtwMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACHEAQEAtwIAIQIAAAAFACAUAAC0AQAgD5oBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMMBAQC3AgAhxAEBALcCACECAAAAAwAgFAAAtgEAIAIAAAADACAUAAC2AQAgAwAAAAUAIBsAAK8BACAcAAC0AQAgAQAAAAUAIAEAAAADACAFBAAAsgMAICEAALUDACAiAAC0AwAgMwAAswMAIDQAALYDACASlwEAAIECADCYAQAAvQEAEJkBAACBAgAwmgEBANoBACGkAQAAhQLDASKoASAA3wEAIaoBQADhAQAhqwFAAOEBACG6AQEA2gEAIbsBAQDaAQAhvAEBANoBACG9AQEA2gEAIb4BEACCAgAhvwECAOABACHAAQgAgwIAIcEBAACEAgAgwwEBANoBACHEAQEA2gEAIQMAAAADACABAAC8AQAwIAAAvQEAIAMAAAADACABAAAEADACAAAFACAWAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQAAAAGbAQEA9QEAIZwBAQAAAAGdAQEA9gEAIZ4BAQAAAAGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIQEAAADAAQAgAQAAAMABACAWAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQD1AQAhmwEBAPUBACGcAQEA9QEAIZ0BAQD2AQAhngEBAPYBACGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIQgDAACuAwAgCwAArwMAIAwAALADACANAACxAwAgnQEAALECACCeAQAAsQIAIJ8BAACxAgAgoAEAALECACADAAAAwwEAIAEAAMQBADACAADAAQAgAwAAAMMBACABAADEAQAwAgAAwAEAIAMAAADDAQAgAQAAxAEAMAIAAMABACATAwAAqgMAIAsAAKsDACAMAACsAwAgDQAArQMAIJoBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQEUAADIAQAgD5oBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQEUAADKAQAwARQAAMoBADATAwAAvwIAIAsAAMACACAMAADBAgAgDQAAwgIAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIQIAAADAAQAgFAAAzQEAIA-aAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACECAAAAwwEAIBQAAM8BACACAAAAwwEAIBQAAM8BACADAAAAwAEAIBsAAMgBACAcAADNAQAgAQAAAMABACABAAAAwwEAIAkEAACyAgAgIQAAtQIAICIAALQCACAzAACzAgAgNAAAtgIAIJ0BAACxAgAgngEAALECACCfAQAAsQIAIKABAACxAgAgEpcBAADZAQAwmAEAANYBABCZAQAA2QEAMJoBAQDaAQAhmwEBANoBACGcAQEA2gEAIZ0BAQDbAQAhngEBANsBACGfAQEA2wEAIaABAQDbAQAhogEAANwBogEipAEAAN0BpAEipgEAAN4BpgEipwEgAN8BACGoASAA3wEAIakBAgDgAQAhqgFAAOEBACGrAUAA4QEAIQMAAADDAQAgAQAA1QEAMCAAANYBACADAAAAwwEAIAEAAMQBADACAADAAQAgEpcBAADZAQAwmAEAANYBABCZAQAA2QEAMJoBAQDaAQAhmwEBANoBACGcAQEA2gEAIZ0BAQDbAQAhngEBANsBACGfAQEA2wEAIaABAQDbAQAhogEAANwBogEipAEAAN0BpAEipgEAAN4BpgEipwEgAN8BACGoASAA3wEAIakBAgDgAQAhqgFAAOEBACGrAUAA4QEAIQ4EAADjAQAgIQAA8wEAICIAAPMBACCsAQEAAAABrQEBAAAABK4BAQAAAASvAQEAAAABsAEBAAAAAbEBAQAAAAGyAQEAAAABswEBAPIBACG0AQEAAAABtQEBAAAAAbYBAQAAAAEOBAAA8AEAICEAAPEBACAiAADxAQAgrAEBAAAAAa0BAQAAAAWuAQEAAAAFrwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDvAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABBwQAAOMBACAhAADuAQAgIgAA7gEAIKwBAAAAogECrQEAAACiAQiuAQAAAKIBCLMBAADtAaIBIgcEAADjAQAgIQAA7AEAICIAAOwBACCsAQAAAKQBAq0BAAAApAEIrgEAAACkAQizAQAA6wGkASIHBAAA4wEAICEAAOoBACAiAADqAQAgrAEAAACmAQKtAQAAAKYBCK4BAAAApgEIswEAAOkBpgEiBQQAAOMBACAhAADoAQAgIgAA6AEAIKwBIAAAAAGzASAA5wEAIQ0EAADjAQAgIQAA4wEAICIAAOMBACAzAADmAQAgNAAA4wEAIKwBAgAAAAGtAQIAAAAErgECAAAABK8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA5QEAIQsEAADjAQAgIQAA5AEAICIAAOQBACCsAUAAAAABrQFAAAAABK4BQAAAAASvAUAAAAABsAFAAAAAAbEBQAAAAAGyAUAAAAABswFAAOIBACELBAAA4wEAICEAAOQBACAiAADkAQAgrAFAAAAAAa0BQAAAAASuAUAAAAAErwFAAAAAAbABQAAAAAGxAUAAAAABsgFAAAAAAbMBQADiAQAhCKwBAgAAAAGtAQIAAAAErgECAAAABK8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA4wEAIQisAUAAAAABrQFAAAAABK4BQAAAAASvAUAAAAABsAFAAAAAAbEBQAAAAAGyAUAAAAABswFAAOQBACENBAAA4wEAICEAAOMBACAiAADjAQAgMwAA5gEAIDQAAOMBACCsAQIAAAABrQECAAAABK4BAgAAAASvAQIAAAABsAECAAAAAbEBAgAAAAGyAQIAAAABswECAOUBACEIrAEIAAAAAa0BCAAAAASuAQgAAAAErwEIAAAAAbABCAAAAAGxAQgAAAABsgEIAAAAAbMBCADmAQAhBQQAAOMBACAhAADoAQAgIgAA6AEAIKwBIAAAAAGzASAA5wEAIQKsASAAAAABswEgAOgBACEHBAAA4wEAICEAAOoBACAiAADqAQAgrAEAAACmAQKtAQAAAKYBCK4BAAAApgEIswEAAOkBpgEiBKwBAAAApgECrQEAAACmAQiuAQAAAKYBCLMBAADqAaYBIgcEAADjAQAgIQAA7AEAICIAAOwBACCsAQAAAKQBAq0BAAAApAEIrgEAAACkAQizAQAA6wGkASIErAEAAACkAQKtAQAAAKQBCK4BAAAApAEIswEAAOwBpAEiBwQAAOMBACAhAADuAQAgIgAA7gEAIKwBAAAAogECrQEAAACiAQiuAQAAAKIBCLMBAADtAaIBIgSsAQAAAKIBAq0BAAAAogEIrgEAAACiAQizAQAA7gGiASIOBAAA8AEAICEAAPEBACAiAADxAQAgrAEBAAAAAa0BAQAAAAWuAQEAAAAFrwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDvAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABCKwBAgAAAAGtAQIAAAAFrgECAAAABa8BAgAAAAGwAQIAAAABsQECAAAAAbIBAgAAAAGzAQIA8AEAIQusAQEAAAABrQEBAAAABa4BAQAAAAWvAQEAAAABsAEBAAAAAbEBAQAAAAGyAQEAAAABswEBAPEBACG0AQEAAAABtQEBAAAAAbYBAQAAAAEOBAAA4wEAICEAAPMBACAiAADzAQAgrAEBAAAAAa0BAQAAAASuAQEAAAAErwEBAAAAAbABAQAAAAGxAQEAAAABsgEBAAAAAbMBAQDyAQAhtAEBAAAAAbUBAQAAAAG2AQEAAAABC6wBAQAAAAGtAQEAAAAErgEBAAAABK8BAQAAAAGwAQEAAAABsQEBAAAAAbIBAQAAAAGzAQEA8wEAIbQBAQAAAAG1AQEAAAABtgEBAAAAARYDAAD9AQAgCwAA_gEAIAwAAP8BACANAACAAgAglwEAAPQBADCYAQAAwwEAEJkBAAD0AQAwmgEBAPUBACGbAQEA9QEAIZwBAQD1AQAhnQEBAPYBACGeAQEA9gEAIZ8BAQD2AQAhoAEBAPYBACGiAQAA9wGiASKkAQAA-AGkASKmAQAA-QGmASKnASAA-gEAIagBIAD6AQAhqQECAPsBACGqAUAA_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_AEAIdYBAQD1AQAh1wEBAPUBACHYASAA-gEAIQiXAQAAlQIAMJgBAABiABCZAQAAlQIAMJoBAQDaAQAhmwEBANoBACGqAUAA4QEAIasBQADhAQAhuwEBANoBACEJAwAA_QEAIJcBAACWAgAwmAEAAE8AEJkBAACWAgAwmgEBAPUBACGbAQEA9QEAIaoBQAD8AQAhqwFAAPwBACG7AQEA9QEAIQyXAQAAlwIAMJgBAABJABCZAQAAlwIAMJoBAQDaAQAhpAEAAJgC3QEiqgFAAOEBACGrAUAA4QEAIckBAQDaAQAhygEBANoBACHZAUAA4QEAIdoBAgDgAQAh2wEQAIICACEHBAAA4wEAICEAAJoCACAiAACaAgAgrAEAAADdAQKtAQAAAN0BCK4BAAAA3QEIswEAAJkC3QEiBwQAAOMBACAhAACaAgAgIgAAmgIAIKwBAAAA3QECrQEAAADdAQiuAQAAAN0BCLMBAACZAt0BIgSsAQAAAN0BAq0BAAAA3QEIrgEAAADdAQizAQAAmgLdASIOlwEAAJsCADCYAQAAMwAQmQEAAJsCADCaAQEA2gEAIaQBAACcAuEBIqgBIADfAQAhqgFAAOEBACGrAUAA4QEAIboBAQDaAQAhuwEBANoBACHdAQEA2gEAId4BAQDaAQAh3wEBANoBACHhAQEA2gEAIQcEAADjAQAgIQAAngIAICIAAJ4CACCsAQAAAOEBAq0BAAAA4QEIrgEAAADhAQizAQAAnQLhASIHBAAA4wEAICEAAJ4CACAiAACeAgAgrAEAAADhAQKtAQAAAOEBCK4BAAAA4QEIswEAAJ0C4QEiBKwBAAAA4QECrQEAAADhAQiuAQAAAOEBCLMBAACeAuEBIg8OAAChAgAglwEAAJ8CADCYAQAAGgAQmQEAAJ8CADCaAQEA9QEAIaQBAACgAuEBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACHdAQEA9QEAId4BAQD1AQAh3wEBAPUBACHhAQEA9QEAIQSsAQAAAOEBAq0BAAAA4QEIrgEAAADhAQizAQAAngLhASIYAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQD1AQAhmwEBAPUBACGcAQEA9QEAIZ0BAQD2AQAhngEBAPYBACGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIeMBAADDAQAg5AEAAMMBACACyQEBAAAAAcoBAQAAAAEMBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhGAUAALACACAGAAChAgAgCwAA_gEAIAwAAP8BACCXAQAArQIAMJgBAAADABCZAQAArQIAMJoBAQD1AQAhpAEAAK8CwwEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAIbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACHjAQAAAwAg5AEAAAMAIBIJAACpAgAglwEAAKUCADCYAQAADQAQmQEAAKUCADCaAQEA9QEAIaQBAACnAtEBIqoBQAD8AQAhqwFAAPwBACHLAQEA9QEAIcwBAQD1AQAhzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIQisARAAAAABrQEQAAAABK4BEAAAAASvARAAAAABsAEQAAAAAbEBEAAAAAGyARAAAAABswEQAIoCACEErAEAAADRAQKtAQAAANEBCK4BAAAA0QEIswEAAJIC0QEiCKwBQAAAAAGtAUAAAAAFrgFAAAAABa8BQAAAAAGwAUAAAAABsQFAAAAAAbIBQAAAAAGzAUAAkAIAIREHAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACHjAQAACQAg5AEAAAkAIA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACEErAEAAADdAQKtAQAAAN0BCK4BAAAA3QEIswEAAJoC3QEiA7cBAAANACC4AQAADQAguQEAAA0AIBYFAACwAgAgBgAAoQIAIAsAAP4BACAMAAD_AQAglwEAAK0CADCYAQAAAwAQmQEAAK0CADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhCKwBCAAAAAGtAQgAAAAErgEIAAAABK8BCAAAAAGwAQgAAAABsQEIAAAAAbIBCAAAAAGzAQgA5gEAIQSsAQAAAMMBAq0BAAAAwwEIrgEAAADDAQizAQAAhwLDASILAwAA_QEAIJcBAACWAgAwmAEAAE8AEJkBAACWAgAwmgEBAPUBACGbAQEA9QEAIaoBQAD8AQAhqwFAAPwBACG7AQEA9QEAIeMBAABPACDkAQAATwAgAAAAAAAAAegBAQAAAAEB6AEBAAAAAQHoAQAAAKIBAgHoAQAAAKQBAgHoAQAAAKYBAgHoASAAAAABBegBAgAAAAHvAQIAAAAB8AECAAAAAfEBAgAAAAHyAQIAAAABAegBQAAAAAELGwAA_gIAMBwAAIMDADDlAQAA_wIAMOYBAACAAwAw5wEAAIEDACDoAQAAggMAMOkBAACCAwAw6gEAAIIDADDrAQAAggMAMOwBAACEAwAw7QEAAIUDADALGwAA3gIAMBwAAOMCADDlAQAA3wIAMOYBAADgAgAw5wEAAOECACDoAQAA4gIAMOkBAADiAgAw6gEAAOICADDrAQAA4gIAMOwBAADkAgAw7QEAAOUCADALGwAA0AIAMBwAANUCADDlAQAA0QIAMOYBAADSAgAw5wEAANMCACDoAQAA1AIAMOkBAADUAgAw6gEAANQCADDrAQAA1AIAMOwBAADWAgAw7QEAANcCADALGwAAwwIAMBwAAMgCADDlAQAAxAIAMOYBAADFAgAw5wEAAMYCACDoAQAAxwIAMOkBAADHAgAw6gEAAMcCADDrAQAAxwIAMOwBAADJAgAw7QEAAMoCADAKmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAECAAAAAQAgGwAAzwIAIAMAAAABACAbAADPAgAgHAAAzgIAIAEUAACUBAAwDw4AAKECACCXAQAAnwIAMJgBAAAaABCZAQAAnwIAMJoBAQAAAAGkAQAAoALhASKoASAA-gEAIaoBQAD8AQAhqwFAAPwBACG6AQEA9QEAIbsBAQAAAAHdAQEA9QEAId4BAQD1AQAh3wEBAPUBACHhAQEA9QEAIQIAAAABACAUAADOAgAgAgAAAMsCACAUAADMAgAgDpcBAADKAgAwmAEAAMsCABCZAQAAygIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhDpcBAADKAgAwmAEAAMsCABCZAQAAygIAMJoBAQD1AQAhpAEAAKAC4QEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId0BAQD1AQAh3gEBAPUBACHfAQEA9QEAIeEBAQD1AQAhCpoBAQC3AgAhpAEAAM0C4QEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAId0BAQC3AgAh3gEBALcCACHfAQEAtwIAIQHoAQAAAOEBAgqaAQEAtwIAIaQBAADNAuEBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHdAQEAtwIAId4BAQC3AgAh3wEBALcCACEKmgEBAAAAAaQBAAAA4QECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHdAQEAAAAB3gEBAAAAAd8BAQAAAAEHCAAA3QIAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAABygEBAAAAAQIAAAAUACAbAADcAgAgAwAAABQAIBsAANwCACAcAADaAgAgARQAAJMEADANBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQAAAAGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACHiAQAAogIAIAIAAAAUACAUAADaAgAgAgAAANgCACAUAADZAgAgCpcBAADXAgAwmAEAANgCABCZAQAA1wIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhCpcBAADXAgAwmAEAANgCABCZAQAA1wIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhBpoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHKAQEAtwIAIQcIAADbAgAgmgEBALcCACGqAUAAvgIAIasBQAC-AgAhwAECAL0CACHIAQEAtwIAIcoBAQC3AgAhBRsAAI4EACAcAACRBAAg5QEAAI8EACDmAQAAkAQAIOsBAAAFACAHCAAA3QIAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAABygEBAAAAAQMbAACOBAAg5QEAAI8EACDrAQAABQAgCggAAPwCACAKAAD9AgAgmgEBAAAAAaQBAAAA3QECqgFAAAAAAasBQAAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABAgAAAAsAIBsAAPsCACADAAAACwAgGwAA-wIAIBwAAOoCACABFAAAjQQAMA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQAAAAGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQIAAAALACAUAADqAgAgAgAAAOYCACAUAADnAgAgDJcBAADlAgAwmAEAAOYCABCZAQAA5QIAMJoBAQD1AQAhpAEAAKsC3QEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHZAUAA_AEAIdoBAgD7AQAh2wEQAKYCACEMlwEAAOUCADCYAQAA5gIAEJkBAADlAgAwmgEBAPUBACGkAQAAqwLdASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdkBQAD8AQAh2gECAPsBACHbARAApgIAIQiaAQEAtwIAIaQBAADpAt0BIqoBQAC-AgAhqwFAAL4CACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQXoARAAAAAB7wEQAAAAAfABEAAAAAHxARAAAAAB8gEQAAAAAQHoAQAAAN0BAgoIAADrAgAgCgAA7AIAIJoBAQC3AgAhpAEAAOkC3QEiqgFAAL4CACGrAUAAvgIAIcoBAQC3AgAh2QFAAL4CACHaAQIAvQIAIdsBEADoAgAhBRsAAIcEACAcAACLBAAg5QEAAIgEACDmAQAAigQAIOsBAAAFACALGwAA7QIAMBwAAPICADDlAQAA7gIAMOYBAADvAgAw5wEAAPACACDoAQAA8QIAMOkBAADxAgAw6gEAAPECADDrAQAA8QIAMOwBAADzAgAw7QEAAPQCADANmgEBAAAAAaQBAAAA0QECqgFAAAAAAasBQAAAAAHMAQEAAAABzQEBAAAAAc4BEAAAAAHPAQEAAAAB0QEBAAAAAdIBAQAAAAHTAQEAAAAB1AEBAAAAAdUBQAAAAAECAAAADwAgGwAA-gIAIAMAAAAPACAbAAD6AgAgHAAA-QIAIAEUAACJBAAwEgkAAKkCACCXAQAApQIAMJgBAAANABCZAQAApQIAMJoBAQAAAAGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEAAAABzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIQIAAAAPACAUAAD5AgAgAgAAAPUCACAUAAD2AgAgEZcBAAD0AgAwmAEAAPUCABCZAQAA9AIAMJoBAQD1AQAhpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAPUBACHNAQEA9gEAIc4BEACmAgAhzwEBAPUBACHRAQEA9gEAIdIBAQD2AQAh0wEBAPYBACHUAQEA9gEAIdUBQACoAgAhEZcBAAD0AgAwmAEAAPUCABCZAQAA9AIAMJoBAQD1AQAhpAEAAKcC0QEiqgFAAPwBACGrAUAA_AEAIcsBAQD1AQAhzAEBAPUBACHNAQEA9gEAIc4BEACmAgAhzwEBAPUBACHRAQEA9gEAIdIBAQD2AQAh0wEBAPYBACHUAQEA9gEAIdUBQACoAgAhDZoBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIQHoAQAAANEBAgHoAUAAAAABDZoBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIQ2aAQEAAAABpAEAAADRAQKqAUAAAAABqwFAAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAQoIAAD8AgAgCgAA_QIAIJoBAQAAAAGkAQAAAN0BAqoBQAAAAAGrAUAAAAABygEBAAAAAdkBQAAAAAHaAQIAAAAB2wEQAAAAAQMbAACHBAAg5QEAAIgEACDrAQAABQAgBBsAAO0CADDlAQAA7gIAMOcBAADwAgAg6wEAAPECADARBQAApwMAIAsAAKgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAAQIAAAAFACAbAAClAwAgAwAAAAUAIBsAAKUDACAcAACLAwAgARQAAIYEADAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAAAAAaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACECAAAABQAgFAAAiwMAIAIAAACGAwAgFAAAhwMAIBKXAQAAhQMAMJgBAACGAwAQmQEAAIUDADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhEpcBAACFAwAwmAEAAIYDABCZAQAAhQMAMJoBAQD1AQAhpAEAAK8CwwEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAIbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACEOmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACEF6AEIAAAAAe8BCAAAAAHwAQgAAAAB8QEIAAAAAfIBCAAAAAEC6AEBAAAABO4BAQAAAAUB6AEAAADDAQIRBQAAjAMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACEFGwAA9QMAIBwAAIQEACDlAQAA9gMAIOYBAACDBAAg6wEAAEwAIAsbAACaAwAwHAAAngMAMOUBAACbAwAw5gEAAJwDADDnAQAAnQMAIOgBAADiAgAw6QEAAOICADDqAQAA4gIAMOsBAADiAgAw7AEAAJ8DADDtAQAA5QIAMAsbAACPAwAwHAAAkwMAMOUBAACQAwAw5gEAAJEDADDnAQAAkgMAIOgBAADUAgAw6QEAANQCADDqAQAA1AIAMOsBAADUAgAw7AEAAJQDADDtAQAA1wIAMAcHAACZAwAgmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABAgAAABQAIBsAAJgDACADAAAAFAAgGwAAmAMAIBwAAJYDACABFAAAggQAMAIAAAAUACAUAACWAwAgAgAAANgCACAUAACVAwAgBpoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHJAQEAtwIAIQcHAACXAwAgmgEBALcCACGqAUAAvgIAIasBQAC-AgAhwAECAL0CACHIAQEAtwIAIckBAQC3AgAhBRsAAP0DACAcAACABAAg5QEAAP4DACDmAQAA_wMAIOsBAADAAQAgBwcAAJkDACCaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAckBAQAAAAEDGwAA_QMAIOUBAAD-AwAg6wEAAMABACAKBwAApAMAIAoAAP0CACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHZAUAAAAAB2gECAAAAAdsBEAAAAAECAAAACwAgGwAAowMAIAMAAAALACAbAACjAwAgHAAAoQMAIAEUAAD8AwAwAgAAAAsAIBQAAKEDACACAAAA5gIAIBQAAKADACAImgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHZAUAAvgIAIdoBAgC9AgAh2wEQAOgCACEKBwAAogMAIAoAAOwCACCaAQEAtwIAIaQBAADpAt0BIqoBQAC-AgAhqwFAAL4CACHJAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQUbAAD3AwAgHAAA-gMAIOUBAAD4AwAg5gEAAPkDACDrAQAAwAEAIAoHAACkAwAgCgAA_QIAIJoBAQAAAAGkAQAAAN0BAqoBQAAAAAGrAUAAAAAByQEBAAAAAdkBQAAAAAHaAQIAAAAB2wEQAAAAAQMbAAD3AwAg5QEAAPgDACDrAQAAwAEAIBEFAACnAwAgCwAAqAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDDAQEAAAABAegBAQAAAAQDGwAA9QMAIOUBAAD2AwAg6wEAAEwAIAQbAACaAwAw5QEAAJsDADDnAQAAnQMAIOsBAADiAgAwBBsAAI8DADDlAQAAkAMAMOcBAACSAwAg6wEAANQCADAEGwAA_gIAMOUBAAD_AgAw5wEAAIEDACDrAQAAggMAMAQbAADeAgAw5QEAAN8CADDnAQAA4QIAIOsBAADiAgAwBBsAANACADDlAQAA0QIAMOcBAADTAgAg6wEAANQCADAEGwAAwwIAMOUBAADEAgAw5wEAAMYCACDrAQAAxwIAMAAAAAAAAAAAAAUbAADwAwAgHAAA8wMAIOUBAADxAwAg5gEAAPIDACDrAQAAwAEAIAMbAADwAwAg5QEAAPEDACDrAQAAwAEAIAAAAAAAAAAAAAAFGwAA6wMAIBwAAO4DACDlAQAA7AMAIOYBAADtAwAg6wEAAAsAIAMbAADrAwAg5QEAAOwDACDrAQAACwAgAAAAAAAACxsAAMwDADAcAADQAwAw5QEAAM0DADDmAQAAzgMAMOcBAADPAwAg6AEAAIIDADDpAQAAggMAMOoBAACCAwAw6wEAAIIDADDsAQAA0QMAMO0BAACFAwAwEQYAALgDACALAACoAwAgDAAAqQMAIJoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMQBAQAAAAECAAAABQAgGwAA1AMAIAMAAAAFACAbAADUAwAgHAAA0wMAIAEUAADqAwAwAgAAAAUAIBQAANMDACACAAAAhgMAIBQAANIDACAOmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgxAEBALcCACERBgAAtwMAIAsAAI0DACAMAACOAwAgmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgxAEBALcCACERBgAAuAMAIAsAAKgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgxAEBAAAAAQQbAADMAwAw5QEAAM0DADDnAQAAzwMAIOsBAACCAwAwAAAAAAAAAAAFGwAA5QMAIBwAAOgDACDlAQAA5gMAIOYBAADnAwAg6wEAAMABACADGwAA5QMAIOUBAADmAwAg6wEAAMABACAIAwAArgMAIAsAAK8DACAMAACwAwAgDQAAsQMAIJ0BAACxAgAgngEAALECACCfAQAAsQIAIKABAACxAgAgBAUAAOQDACAGAADgAwAgCwAArwMAIAwAALADACADBwAA4AMAIAgAAOEDACAKAADjAwAgAAEDAACuAwAgEgMAAKoDACALAACrAwAgDAAArAMAIJoBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQIAAADAAQAgGwAA5QMAIAMAAADDAQAgGwAA5QMAIBwAAOkDACAUAAAAwwEAIAMAAL8CACALAADAAgAgDAAAwQIAIBQAAOkDACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACESAwAAvwIAIAsAAMACACAMAADBAgAgmgEBALcCACGbAQEAtwIAIZwBAQC3AgAhnQEBALgCACGeAQEAuAIAIZ8BAQC4AgAhoAEBALgCACGiAQAAuQKiASKkAQAAugKkASKmAQAAuwKmASKnASAAvAIAIagBIAC8AgAhqQECAL0CACGqAUAAvgIAIasBQAC-AgAhDpoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMQBAQAAAAELBwAApAMAIAgAAPwCACCaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2QFAAAAAAdoBAgAAAAHbARAAAAABAgAAAAsAIBsAAOsDACADAAAACQAgGwAA6wMAIBwAAO8DACANAAAACQAgBwAAogMAIAgAAOsCACAUAADvAwAgmgEBALcCACGkAQAA6QLdASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdkBQAC-AgAh2gECAL0CACHbARAA6AIAIQsHAACiAwAgCAAA6wIAIJoBAQC3AgAhpAEAAOkC3QEiqgFAAL4CACGrAUAAvgIAIckBAQC3AgAhygEBALcCACHZAUAAvgIAIdoBAgC9AgAh2wEQAOgCACESCwAAqwMAIAwAAKwDACANAACtAwAgmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABAgAAAMABACAbAADwAwAgAwAAAMMBACAbAADwAwAgHAAA9AMAIBQAAADDAQAgCwAAwAIAIAwAAMECACANAADCAgAgFAAA9AMAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIRILAADAAgAgDAAAwQIAIA0AAMICACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACEFmgEBAAAAAZsBAQAAAAGqAUAAAAABqwFAAAAAAbsBAQAAAAECAAAATAAgGwAA9QMAIBIDAACqAwAgDAAArAMAIA0AAK0DACCaAQEAAAABmwEBAAAAAZwBAQAAAAGdAQEAAAABngEBAAAAAZ8BAQAAAAGgAQEAAAABogEAAACiAQKkAQAAAKQBAqYBAAAApgECpwEgAAAAAagBIAAAAAGpAQIAAAABqgFAAAAAAasBQAAAAAECAAAAwAEAIBsAAPcDACADAAAAwwEAIBsAAPcDACAcAAD7AwAgFAAAAMMBACADAAC_AgAgDAAAwQIAIA0AAMICACAUAAD7AwAgmgEBALcCACGbAQEAtwIAIZwBAQC3AgAhnQEBALgCACGeAQEAuAIAIZ8BAQC4AgAhoAEBALgCACGiAQAAuQKiASKkAQAAugKkASKmAQAAuwKmASKnASAAvAIAIagBIAC8AgAhqQECAL0CACGqAUAAvgIAIasBQAC-AgAhEgMAAL8CACAMAADBAgAgDQAAwgIAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIQiaAQEAAAABpAEAAADdAQKqAUAAAAABqwFAAAAAAckBAQAAAAHZAUAAAAAB2gECAAAAAdsBEAAAAAESAwAAqgMAIAsAAKsDACANAACtAwAgmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABAgAAAMABACAbAAD9AwAgAwAAAMMBACAbAAD9AwAgHAAAgQQAIBQAAADDAQAgAwAAvwIAIAsAAMACACANAADCAgAgFAAAgQQAIJoBAQC3AgAhmwEBALcCACGcAQEAtwIAIZ0BAQC4AgAhngEBALgCACGfAQEAuAIAIaABAQC4AgAhogEAALkCogEipAEAALoCpAEipgEAALsCpgEipwEgALwCACGoASAAvAIAIakBAgC9AgAhqgFAAL4CACGrAUAAvgIAIRIDAAC_AgAgCwAAwAIAIA0AAMICACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACEGmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABAwAAAE8AIBsAAPUDACAcAACFBAAgBwAAAE8AIBQAAIUEACCaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhBZoBAQC3AgAhmwEBALcCACGqAUAAvgIAIasBQAC-AgAhuwEBALcCACEOmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAARIFAACnAwAgBgAAuAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDDAQEAAAABxAEBAAAAAQIAAAAFACAbAACHBAAgDZoBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABzAEBAAAAAc0BAQAAAAHOARAAAAABzwEBAAAAAdEBAQAAAAHSAQEAAAAB0wEBAAAAAdQBAQAAAAHVAUAAAAABAwAAAAMAIBsAAIcEACAcAACMBAAgFAAAAAMAIAUAAIwDACAGAAC3AwAgDAAAjgMAIBQAAIwEACCaAQEAtwIAIaQBAACKA8MBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACG8AQEAtwIAIb0BAQC3AgAhvgEQAOgCACG_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_tQEDgAG3AQyBAbgBP4IBuQEDgwG6AQOEAbsBDIUBvgFAhgG_AUaHAcEBAogBwgECiQHFAQKKAcYBAosBxwECjAHJAQKNAcsBDI4BzAFHjwHOAQKQAdABDJEB0QFIkgHSAQKTAdMBApQB1AEMlQHXAUmWAdgBTw"
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
    valId: true,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvc2x1Z2lmeS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBleHByZXNzLCB7IEFwcGxpY2F0aW9uLCBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcclxuaW1wb3J0IGNvcnMgZnJvbSBcImNvcnNcIjtcclxuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tIFwiY29va2llLXBhcnNlclwiO1xyXG5pbXBvcnQgaGVsbWV0IGZyb20gXCJoZWxtZXRcIjtcclxuaW1wb3J0IG1vcmdhbiBmcm9tIFwibW9yZ2FuXCI7XHJcbmltcG9ydCByYXRlTGltaXQgZnJvbSBcImV4cHJlc3MtcmF0ZS1saW1pdFwiO1xyXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuL2NvbmZpZ1wiO1xyXG5pbXBvcnQgbm90Rm91bmRIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvbm90Rm91bmRcIjtcclxuaW1wb3J0IGdsb2JhbEVycm9ySGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlclwiO1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9saWIvcHJpc21hXCI7XHJcbmltcG9ydCB7IGF1dGhSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1c2VyUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91c2VyL3VzZXIucm91dGVcIjtcclxuaW1wb3J0IHsgdXBsb2FkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGVcIjtcclxuaW1wb3J0IHsgY29udGFjdFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY29udGFjdC9jb250YWN0LnJvdXRlXCI7XHJcbmltcG9ydCB7IGJvb2tpbmdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyByZXZpZXdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGVcIjtcclxuaW1wb3J0IHsgY2F0ZWdvcnlSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlXCI7XHJcbmltcG9ydCB7IHBhY2thZ2VSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBibG9nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ibG9nL2Jsb2cucm91dGVcIjtcclxuaW1wb3J0IHsgZGFzaGJvYXJkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlXCI7XHJcbmltcG9ydCB7IHBheW1lbnRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZVwiO1xyXG5cclxuY29uc3QgYXBwOiBBcHBsaWNhdGlvbiA9IGV4cHJlc3MoKTtcclxuXHJcbi8vIFJlbmRlci9SYWlsd2F5IHNpdCBiZWhpbmQgYSByZXZlcnNlIHByb3h5IFx1MjAxNCBtdXN0IGJlIHNldCBiZWZvcmUgdGhlXHJcbi8vIHJhdGUgbGltaXRlciBvciBpdCB3aWxsIHNlZSB0aGUgcHJveHkncyBJUCBmb3IgZXZlcnkgcmVxdWVzdCBhbmRcclxuLy8gZWZmZWN0aXZlbHkgcmF0ZS1saW1pdCBhbGwgdXNlcnMgdG9nZXRoZXIuXHJcbmFwcC5zZXQoXCJ0cnVzdCBwcm94eVwiLCAxKTtcclxuXHJcbmFwcC51c2UoaGVsbWV0KCkpO1xyXG5cclxuYXBwLnVzZShcclxuICBjb3JzKHtcclxuICAgIC8vIERldiBob3N0IChsb2NhbGhvc3QpICsgcHJvZCBob3N0IChWZXJjZWwpIGJvdGggYWxsb3dlZCBzaWRlLWJ5LXNpZGUuXHJcbiAgICAvLyBDb25maWcgcmVzb2x2ZXMgc2Vuc2libGUgZGVmYXVsdHMgc28gbmVpdGhlciBjYW4gYmUgZmFsc3kuXHJcbiAgICBvcmlnaW46IFtjb25maWcuZnJvbnRlbmRfdXJsX2RldiwgY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXS5maWx0ZXIoXHJcbiAgICAgIChvKTogbyBpcyBzdHJpbmcgPT4gQm9vbGVhbihvKSxcclxuICAgICksXHJcbiAgICBjcmVkZW50aWFsczogdHJ1ZSxcclxuICB9KSxcclxuKTtcclxuXHJcbmlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XHJcbiAgYXBwLnVzZShtb3JnYW4oXCJkZXZcIikpO1xyXG59XHJcblxyXG5hcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xyXG5hcHAudXNlKGV4cHJlc3MudXJsZW5jb2RlZCh7IGV4dGVuZGVkOiB0cnVlLCBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XHJcblxyXG4vLyBTdHJpY3QgbGltaXRlciBcdTIwMTQgYXV0aCBlbmRwb2ludHMsIGJydXRlLWZvcmNlIHByb3RlY3Rpb25cclxuY29uc3QgYXV0aExpbWl0ZXIgPSByYXRlTGltaXQoe1xyXG4gIHdpbmRvd01zOiAxNSAqIDYwICogMTAwMCxcclxuICBsaW1pdDogNSxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IGF0dGVtcHRzLiBQbGVhc2UgdHJ5IGFnYWluIGluIDE1IG1pbnV0ZXMuXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyBTdGFuZGFyZCBsaW1pdGVyIFx1MjAxNCBldmVyeXRoaW5nIGVsc2UgdW5kZXIgL2FwaVxyXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDEwMCxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IHJlcXVlc3RzLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuYXBwLnVzZShcIi9hcGkvYXV0aC9sb2dpblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVnaXN0ZXJcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2RlbW8tbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2dvb2dsZVwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuXHJcbmFwcC51c2Uobm90Rm91bmRIYW5kbGVyKTtcclxuYXBwLnVzZShnbG9iYWxFcnJvckhhbmRsZXIpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXBwO1xyXG4iLCAiaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuZG90ZW52LmNvbmZpZyh7XG4gIHF1aWV0OiB0cnVlLFxuICBwYXRoOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCIuZW52XCIpLFxufSk7XG5cbi8vIEV2ZXJ5IG1vZHVsZSByZWFkcyBjb25maWcgdGhyb3VnaCB0aGlzIHZhbGlkYXRlZCBvYmplY3QsIG5ldmVyXG4vLyBwcm9jZXNzLmVudiBkaXJlY3RseSBcdTIwMTQgYSBtaXNzaW5nL21hbGZvcm1lZCB2YXIgZmFpbHMgbG91ZGx5IGF0IGJvb3Rcbi8vIGluc3RlYWQgb2Ygc3VyZmFjaW5nIGFzIGEgY29uZnVzaW5nIHJ1bnRpbWUgZXJyb3IgbWlkLXJlcXVlc3QuXG5jb25zdCBlbnZTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIFBPUlQ6IHouc3RyaW5nKCkuZGVmYXVsdChcIjQwMDBcIiksXG4gIE5PREVfRU5WOiB6LmVudW0oW1wiZGV2ZWxvcG1lbnRcIiwgXCJwcm9kdWN0aW9uXCJdKS5kZWZhdWx0KFwiZGV2ZWxvcG1lbnRcIiksXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBUaGUgZnJvbnRlbmQgbWF5IG5vdCBiZVxuICAvLyBkZXBsb3llZCB5ZXQgKG9yIG1heSBiZSByZWJ1aWx0KSwgc28gYm90aCBhcmUgb3B0aW9uYWw6IHRoZSBiYWNrZW5kIG11c3RcbiAgLy8gbmV2ZXIgcmVmdXNlIHRvIGJvb3QganVzdCBiZWNhdXNlIGEgVUkgaG9zdCBpc24ndCBsaXZlLiBSb3V0ZXMgdGhhdCBuZWVkIGFcbiAgLy8gcmVhbCBvcmlnaW4gKHBheW1lbnQgY2FsbGJhY2sgcmVkaXJlY3RzKSBmYWxsIGJhY2sgdG8gdGhlIGJhY2tlbmQgVVJMLlxuICBGUk9OVEVORF9VUkxfREVWOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIEZST05URU5EX1VSTF9QUk9EOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgREFUQUJBU0VfVVJMOiB6LnN0cmluZygpLm1pbigxLCBcIkRBVEFCQVNFX1VSTCBpcyByZXF1aXJlZFwiKSxcblxuICBCQ1JZUFRfU0FMVF9ST1VORFM6IHouc3RyaW5nKCkuZGVmYXVsdChcIjEwXCIpLFxuXG4gIC8vIE9wdGlvbmFsIGFkbWluIGNyZWRlbnRpYWxzIHVzZWQgYnkgdGhlIHNlZWQgc2NyaXB0IChTdGVwIDEzKS4gRmFsbHMgYmFja1xuICAvLyB0byBkZW1vLWFkbWluQHRyaXB2ZXJzZS5jb20gLyBkZW1vMTIzIHdoZW4gdW5zZXQuXG4gIEFETUlOX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgQURNSU5fUEFTU1dPUkQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG5cbiAgLy8gU1NMQ29tbWVyeiAoU3RlcCAxNikgXHUyMDE0IHNhbmRib3ggc3RvcmUgY3JlZHMgdW50aWwgZ28tbGl2ZS4gU1NMX0NPTU1FUlpfU0FOREJPWFxuICAvLyBwaWNrcyB0aGUgc2FuZGJveCB2cyBsaXZlIEFQSSBiYXNlIFVSTC4gT3B0aW9uYWwgc28gdGhlIEFQSSBib290cyAoaGVhbHRoLFxuICAvLyBhdXRoLCBjYXRhbG9nLCBldGMuKSBldmVuIHdoZW4gdGhlIHBheW1lbnQgc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQgXHUyMDE0IHRoZVxuICAvLyBwYXltZW50IGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuIFwibm90IGNvbmZpZ3VyZWRcIiBlcnJvciBpbnN0ZWFkIG9mXG4gIC8vIHRha2luZyB0aGUgd2hvbGUgZGVwbG95bWVudCBkb3duLlxuICBTU0xfQ09NTUVSWl9TVE9SRV9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TQU5EQk9YOiB6LnN0cmluZygpLmRlZmF1bHQoXCJ0cnVlXCIpLFxuICAvLyBPcHRpb25hbCBleHBsaWNpdCBnYXRld2F5L3ZhbGlkYXRvciBiYXNlIFVSTHMgKEdlYXJVcCBwYXR0ZXJuKS4gRGVmYXVsdHMgYXJlXG4gIC8vIGRlcml2ZWQgZnJvbSBTU0xfQ09NTUVSWl9TQU5EQk9YIHdoZW4gYWJzZW50LlxuICBTU0xDT01NRVJaX0lOSVRfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfVkFMSURBVEVfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgLy8gUHVibGljbHkgcmVhY2hhYmxlIGJhc2UgVVJMIHRoZSBwYXltZW50IG1vZHVsZSB1c2VzIHRvIGJ1aWxkIHRoZVxuICAvLyBTU0xDb21tZXJ6IHN1Y2Nlc3MvZmFpbC9jYW5jZWwvSVBOIGNhbGxiYWNrIFVSTHMuIE11c3QgTk9UIGJlIGxvY2FsaG9zdCBpblxuICAvLyBzYW5kYm94IFx1MjAxNCB0aGUgZ2F0ZXdheSBQT1NUcyB0byB0aGVzZSBzZXJ2ZXItdG8tc2VydmVyLiBPcHRpb25hbCBsaWtlIHRoZVxuICAvLyBzdG9yZSBjcmVkcyBhYm92ZSAocGF5bWVudC1vbmx5KS5cbiAgQkFDS0VORF9QVUJMSUNfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgSldUX0FDQ0VTU19TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiSldUX0FDQ0VTU19TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG4gIEpXVF9SRUZSRVNIX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfUkVGUkVTSF9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG4gIEpXVF9BQ0NFU1NfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMWRcIiksXG4gIEpXVF9SRUZSRVNIX0VYUElSRVNfSU46IHouc3RyaW5nKCkuZGVmYXVsdChcIjMwZFwiKSxcblxuICAvLyBHb29nbGUgT0F1dGggaXMgb3B0aW9uYWwgXHUyMDE0IHNlcnZlciBib290cyB3aXRob3V0IGl0OyAvYXBpL2F1dGgvZ29vZ2xlXG4gIC8vIHJldHVybnMgYSBjbGVhbiA0MDAgdW50aWwgR09PR0xFX0NMSUVOVF9JRCBpcyBjb25maWd1cmVkLlxuICBHT09HTEVfQ0xJRU5UX0lEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG5cbiAgLy8gQmVzdC1lZmZvcnQgY29udGFjdCBlbWFpbHMgKFJlc2VuZCkgXHUyMDE0IGFsd2F5cyBvcHRpb25hbDsgc3VibWlzc2lvbnNcbiAgLy8gc3VjY2VlZCBhbmQgZW1haWxzIGJlY29tZSBuby1vcHMgd2hlbiB0aGVzZSBhcmUgbWlzc2luZy5cbiAgUkVTRU5EX0FQSV9LRVk6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgQ09OVEFDVF9SRUNFSVZFUl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEVNQUlMX0ZST006IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICBDTE9VRElOQVJZX0NMT1VEX05BTUU6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9DTE9VRF9OQU1FIGlzIHJlcXVpcmVkXCIpLFxuICBDTE9VRElOQVJZX0FQSV9LRVk6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9BUElfS0VZIGlzIHJlcXVpcmVkXCIpLFxuICBDTE9VRElOQVJZX0FQSV9TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9BUElfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxufSk7XG5cbmNvbnN0IHBhcnNlZCA9IGVudlNjaGVtYS5zYWZlUGFyc2UocHJvY2Vzcy5lbnYpO1xuXG5pZiAoIXBhcnNlZC5zdWNjZXNzKSB7XG4gIGNvbnNvbGUuZXJyb3IoXCJcdTI3NEMgSW52YWxpZCBlbnZpcm9ubWVudCB2YXJpYWJsZXM6XCIpO1xuICBjb25zb2xlLmVycm9yKHBhcnNlZC5lcnJvci5mbGF0dGVuKCkuZmllbGRFcnJvcnMpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbmNvbnN0IGVudiA9IHBhcnNlZC5kYXRhO1xuXG5jb25zdCBjb25maWcgPSB7XG4gIHBvcnQ6IGVudi5QT1JULFxuICBub2RlX2VudjogZW52Lk5PREVfRU5WLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gTG9jYWxob3N0IGFsd2F5cyB3aW5zIGZvclxuICAvLyBsb2NhbCB0ZXN0aW5nOyBwcm9kdWN0aW9uIHVzZXMgdGhlIFZlcmNlbCBmcm9udGVuZCBVUkwsIGZhbGxpbmcgYmFjayB0byB0aGVcbiAgLy8gYmFja2VuZCBVUkwgc28gdGhlIEFQSSBzdGF5cyByZWFjaGFibGUgZXZlbiBiZWZvcmUgdGhlIFVJIGlzIGRlcGxveWVkLlxuICBmcm9udGVuZF91cmxfZGV2OiBlbnYuRlJPTlRFTkRfVVJMX0RFViB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICBmcm9udGVuZF91cmxfcHJvZDpcbiAgICBlbnYuRlJPTlRFTkRfVVJMX1BST0QgfHwgZW52LkJBQ0tFTkRfUFVCTElDX1VSTCB8fCBcIlwiLFxuXG4gIGRhdGFiYXNlX3VybDogZW52LkRBVEFCQVNFX1VSTCxcblxuICBiY3J5cHRfc2FsdF9yb3VuZHM6IGVudi5CQ1JZUFRfU0FMVF9ST1VORFMsXG5cbiAgYWRtaW5fZW1haWw6IGVudi5BRE1JTl9FTUFJTCxcbiAgYWRtaW5fcGFzc3dvcmQ6IGVudi5BRE1JTl9QQVNTV09SRCxcblxuICBzc2xfY29tbWVyel9zdG9yZV9pZDogZW52LlNTTF9DT01NRVJaX1NUT1JFX0lELFxuICBzc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZDogZW52LlNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELFxuICBzc2xfY29tbWVyel9zYW5kYm94OiBlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCIsXG4gIC8vIHNhbmRib3ggYmFzZSBVUkxzIChmYWxsYmFjayB3aGVuIHRoZSBleHBsaWNpdCBvdmVycmlkZSB2YXJzIGFyZSBhYnNlbnQpXG4gIHNzbGNvbW1lcnpfaW5pdF91cmw6XG4gICAgZW52LlNTTENPTU1FUlpfSU5JVF9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS9nd3Byb2Nlc3MvdjQvYXBpLnBocFwiKSxcbiAgc3NsY29tbWVyel92YWxpZGF0ZV91cmw6XG4gICAgZW52LlNTTENPTU1FUlpfVkFMSURBVEVfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL3ZhbGlkYXRpb25zZXJ2ZXJBUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL3ZhbGlkYXRpb25zZXJ2ZXJBUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nUG9zdFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dQb3N0ID0gUHJpc21hLkJsb2dQb3N0TW9kZWxcbi8qKlxuICogTW9kZWwgQm9va2luZ1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2tpbmcgPSBQcmlzbWEuQm9va2luZ01vZGVsXG4vKipcbiAqIE1vZGVsIENhdGVnb3J5XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ2F0ZWdvcnkgPSBQcmlzbWEuQ2F0ZWdvcnlNb2RlbFxuLyoqXG4gKiBNb2RlbCBDb250YWN0TWVzc2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENvbnRhY3RNZXNzYWdlID0gUHJpc21hLkNvbnRhY3RNZXNzYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgUGF5bWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFBheW1lbnQgPSBQcmlzbWEuUGF5bWVudE1vZGVsXG4vKipcbiAqIE1vZGVsIFJldmlld1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJldmlldyA9IFByaXNtYS5SZXZpZXdNb2RlbFxuLyoqXG4gKiBNb2RlbCBUb3VyUGFja2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlID0gUHJpc21hLlRvdXJQYWNrYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgVXNlclxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFVzZXIgPSBQcmlzbWEuVXNlck1vZGVsXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBXQVJOSU5HOiBUaGlzIGlzIGFuIGludGVybmFsIGZpbGUgdGhhdCBpcyBzdWJqZWN0IHRvIGNoYW5nZSFcbiAqXG4gKiBcdUQ4M0RcdURFRDEgVW5kZXIgbm8gY2lyY3Vtc3RhbmNlcyBzaG91bGQgeW91IGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkhIFx1RDgzRFx1REVEMVxuICpcbiAqIFBsZWFzZSBpbXBvcnQgdGhlIGBQcmlzbWFDbGllbnRgIGNsYXNzIGZyb20gdGhlIGBjbGllbnQudHNgIGZpbGUgaW5zdGVhZC5cbiAqL1xuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgdHlwZSAqIGFzIFByaXNtYSBmcm9tIFwiLi9wcmlzbWFOYW1lc3BhY2VcIlxuXG5cbmNvbnN0IGNvbmZpZzogcnVudGltZS5HZXRQcmlzbWFDbGllbnRDb25maWcgPSB7XG4gIFwicHJldmlld0ZlYXR1cmVzXCI6IFtdLFxuICBcImNsaWVudFZlcnNpb25cIjogXCI3LjkuMVwiLFxuICBcImVuZ2luZVZlcnNpb25cIjogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCIsXG4gIFwiYWN0aXZlUHJvdmlkZXJcIjogXCJwb3N0Z3Jlc3FsXCIsXG4gIFwiaW5saW5lU2NoZW1hXCI6IFwibW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciBVc2VyIEByZWxhdGlvbihcXFwiQXV0aG9yUG9zdHNcXFwiLCBmaWVsZHM6IFthdXRob3JJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBpbmRleChbYXV0aG9ySWRdKVxcbiAgQEBtYXAoXFxcImJsb2dfcG9zdHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBCb29raW5nIHtcXG4gIGlkICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdHJhdmVsRGF0ZSBEYXRlVGltZVxcbiAgdHJhdmVsZXJzICBJbnRcXG4gIHRvdGFsUHJpY2UgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIHN0YXR1cyAgICAgQm9va2luZ1N0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlICBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBheW1lbnRzIFBheW1lbnRbXVxcblxcbiAgQEBpbmRleChbdXNlcklkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBpbmRleChbdXNlcklkLCBwYWNrYWdlSWQsIHRyYXZlbERhdGVdKVxcbiAgQEBtYXAoXFxcImJvb2tpbmdzXFxcIilcXG59XFxuXFxubW9kZWwgQ2F0ZWdvcnkge1xcbiAgaWQgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgU3RyaW5nIEB1bmlxdWVcXG4gIHNsdWcgU3RyaW5nIEB1bmlxdWVcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyBUb3VyUGFja2FnZVtdXFxuXFxuICBAQG1hcChcXFwiY2F0ZWdvcmllc1xcXCIpXFxufVxcblxcbm1vZGVsIENvbnRhY3RNZXNzYWdlIHtcXG4gIGlkICAgICAgICAgU3RyaW5nICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSAgICAgICBTdHJpbmdcXG4gIGVtYWlsICAgICAgU3RyaW5nXFxuICBzdWJqZWN0ICAgIFN0cmluZ1xcbiAgbWVzc2FnZSAgICBTdHJpbmdcXG4gIGlzUmVzb2x2ZWQgQm9vbGVhbiBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBAQGluZGV4KFtpc1Jlc29sdmVkXSlcXG4gIEBAbWFwKFxcXCJjb250YWN0X21lc3NhZ2VzXFxcIilcXG59XFxuXFxuZW51bSBSb2xlIHtcXG4gIFVTRVJcXG4gIEFHRU5UXFxuICBBRE1JTlxcbn1cXG5cXG5lbnVtIFVzZXJTdGF0dXMge1xcbiAgQUNUSVZFXFxuICBTVVNQRU5ERURcXG59XFxuXFxuZW51bSBBdXRoUHJvdmlkZXIge1xcbiAgQ1JFREVOVElBTFxcbiAgR09PR0xFXFxufVxcblxcbmVudW0gUGFja2FnZVN0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBBUFBST1ZFRFxcbiAgUkVKRUNURURcXG59XFxuXFxuZW51bSBCb29raW5nU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIFBBSURcXG4gIENPTkZJUk1FRFxcbiAgQ0FOQ0VMTEVEXFxuICBDT01QTEVURURcXG59XFxuXFxuZW51bSBQYXltZW50U3RhdHVzIHtcXG4gIElOSVRJQVRFRFxcbiAgU1VDQ0VTU1xcbiAgRkFJTEVEXFxuICBDQU5DRUxMRURcXG4gIFJFRlVOREVEXFxufVxcblxcbmVudW0gUG9zdFN0YXR1cyB7XFxuICBEUkFGVFxcbiAgUFVCTElTSEVEXFxufVxcblxcbm1vZGVsIFBheW1lbnQge1xcbiAgaWQgICAgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgYm9va2luZ0lkICAgICAgU3RyaW5nXFxuICB0cmFuSWQgICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWUgLy8gU1NMQ29tbWVyeiB0cmFuc2FjdGlvbiBpZCwgZ2VuZXJhdGVkIHNlcnZlci1zaWRlXFxuICB2YWxJZCAgICAgICAgICBTdHJpbmc/IC8vIHNldCBhZnRlciBnYXRld2F5IHN1Y2Nlc3MsIHVzZWQgZm9yIHNlcnZlci1zaWRlIHZhbGlkYXRpb25cXG4gIGFtb3VudCAgICAgICAgIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpIC8vID0gYm9va2luZy50b3RhbFByaWNlIGF0IHNlc3Npb24gY3JlYXRpb25cXG4gIGN1cnJlbmN5ICAgICAgIFN0cmluZyAgICAgICAgQGRlZmF1bHQoXFxcIkJEVFxcXCIpXFxuICBzdGF0dXMgICAgICAgICBQYXltZW50U3RhdHVzIEBkZWZhdWx0KElOSVRJQVRFRClcXG4gIGdhdGV3YXlQYWdlVXJsIFN0cmluZz9cXG4gIHNzbFNlc3Npb25LZXkgIFN0cmluZz9cXG4gIGNhcmRUeXBlICAgICAgIFN0cmluZz9cXG4gIGJhbmtUcmFuSWQgICAgIFN0cmluZz9cXG4gIHBhaWRBdCAgICAgICAgIERhdGVUaW1lP1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGJvb2tpbmcgQm9va2luZyBAcmVsYXRpb24oZmllbGRzOiBbYm9va2luZ0lkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW2Jvb2tpbmdJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInBheW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgUmV2aWV3IHtcXG4gIGlkICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICByYXRpbmcgIEludFxcbiAgY29tbWVudCBTdHJpbmdcXG5cXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgVG91clBhY2thZ2UgQHJlbGF0aW9uKGZpZWxkczogW3BhY2thZ2VJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAbWFwKFxcXCJyZXZpZXdzXFxcIilcXG59XFxuXFxuLy8gVGhpcyBpcyB5b3VyIFByaXNtYSBzY2hlbWEgZmlsZSxcXG4vLyBsZWFybiBtb3JlIGFib3V0IGl0IGluIHRoZSBkb2NzOiBodHRwczovL3ByaXMubHkvZC9wcmlzbWEtc2NoZW1hXFxuXFxuZ2VuZXJhdG9yIGNsaWVudCB7XFxuICBwcm92aWRlciA9IFxcXCJwcmlzbWEtY2xpZW50XFxcIlxcbiAgb3V0cHV0ICAgPSBcXFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYVxcXCJcXG59XFxuXFxuZGF0YXNvdXJjZSBkYiB7XFxuICBwcm92aWRlciA9IFxcXCJwb3N0Z3Jlc3FsXFxcIlxcbn1cXG5cXG5tb2RlbCBUb3VyUGFja2FnZSB7XFxuICBpZCAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgICBTdHJpbmdcXG4gIHNsdWcgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZVxcbiAgZGVzY3JpcHRpb24gU3RyaW5nXFxuICBsb2NhdGlvbiAgICBTdHJpbmdcXG4gIHByaWNlICAgICAgIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpXFxuICBkdXJhdGlvbiAgICBJbnRcXG4gIHJhdGluZyAgICAgIEZsb2F0ICAgICAgICAgQGRlZmF1bHQoMClcXG4gIGltYWdlcyAgICAgIFN0cmluZ1tdXFxuICBzdGF0dXMgICAgICBQYWNrYWdlU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuICBpc0RlbGV0ZWQgICBCb29sZWFuICAgICAgIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY2F0ZWdvcnlJZCBTdHJpbmdcXG4gIGFnZW50SWQgICAgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgY2F0ZWdvcnkgQ2F0ZWdvcnkgIEByZWxhdGlvbihmaWVsZHM6IFtjYXRlZ29yeUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGFnZW50ICAgIFVzZXIgICAgICBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiLCBmaWVsZHM6IFthZ2VudElkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGJvb2tpbmdzIEJvb2tpbmdbXVxcbiAgcmV2aWV3cyAgUmV2aWV3W11cXG5cXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWRdKVxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZCwgcHJpY2VdKVxcbiAgQEBpbmRleChbcHJpY2VdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ0b3VyX3BhY2thZ2VzXFxcIilcXG59XFxuXFxubW9kZWwgVXNlciB7XFxuICBpZCAgICAgICAgICAgIFN0cmluZyAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSAgICAgICAgICBTdHJpbmdcXG4gIGVtYWlsICAgICAgICAgU3RyaW5nICAgICAgIEB1bmlxdWVcXG4gIHBhc3N3b3JkICAgICAgU3RyaW5nP1xcbiAgZ29vZ2xlSWQgICAgICBTdHJpbmc/ICAgICAgQHVuaXF1ZVxcbiAgcGhvbmUgICAgICAgICBTdHJpbmc/XFxuICBhdmF0YXJVcmwgICAgIFN0cmluZz9cXG4gIHJvbGUgICAgICAgICAgUm9sZSAgICAgICAgIEBkZWZhdWx0KFVTRVIpXFxuICBzdGF0dXMgICAgICAgIFVzZXJTdGF0dXMgICBAZGVmYXVsdChBQ1RJVkUpXFxuICBhdXRoUHJvdmlkZXIgIEF1dGhQcm92aWRlciBAZGVmYXVsdChDUkVERU5USUFMKVxcbiAgZW1haWxWZXJpZmllZCBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICBpc0RlbGV0ZWQgICAgIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIHRva2VuVmVyc2lvbiAgSW50ICAgICAgICAgIEBkZWZhdWx0KDApXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgcGFja2FnZXMgVG91clBhY2thZ2VbXSBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiKVxcbiAgYm9va2luZ3MgQm9va2luZ1tdICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyQm9va2luZ3NcXFwiKVxcbiAgcmV2aWV3cyAgUmV2aWV3W10gICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIpXFxuICBwb3N0cyAgICBCbG9nUG9zdFtdICAgIEByZWxhdGlvbihcXFwiQXV0aG9yUG9zdHNcXFwiKVxcblxcbiAgQEBpbmRleChbcm9sZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInVzZXJzXFxcIilcXG59XFxuXCIsXG4gIFwicnVudGltZURhdGFNb2RlbFwiOiB7XG4gICAgXCJtb2RlbHNcIjoge30sXG4gICAgXCJlbnVtc1wiOiB7fSxcbiAgICBcInR5cGVzXCI6IHt9XG4gIH0sXG4gIFwicGFyYW1ldGVyaXphdGlvblNjaGVtYVwiOiB7XG4gICAgXCJzdHJpbmdzXCI6IFtdLFxuICAgIFwiZ3JhcGhcIjogXCJcIlxuICB9XG59XG5cbmNvbmZpZy5ydW50aW1lRGF0YU1vZGVsID0gSlNPTi5wYXJzZShcIntcXFwibW9kZWxzXFxcIjp7XFxcIkJsb2dQb3N0XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZXhjZXJwdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY292ZXJJbWFnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUG9zdFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX3Bvc3RzXFxcIn0sXFxcIkJvb2tpbmdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbERhdGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsZXJzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b3RhbFByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1N0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwifSxcXFwiQ2F0ZWdvcnlcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjYXRlZ29yaWVzXFxcIn0sXFxcIkNvbnRhY3RNZXNzYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3ViamVjdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibWVzc2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNSZXNvbHZlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjb250YWN0X21lc3NhZ2VzXFxcIn0sXFxcIlBheW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ2YWxJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYW1vdW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3VycmVuY3lcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnYXRld2F5UGFnZVVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2FyZFR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJhbmtUcmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhaWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJwYXltZW50c1xcXCJ9LFxcXCJSZXZpZXdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJhdGluZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicmV2aWV3c1xcXCJ9LFxcXCJUb3VyUGFja2FnZVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImRlc2NyaXB0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsb2NhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJkdXJhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJGbG9hdFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImltYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGFja2FnZVN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhdGVnb3J5SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFnZW50SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkNhdGVnb3J5XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJldmlld1RvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInVzZXJzXFxcIn19LFxcXCJlbnVtc1xcXCI6e30sXFxcInR5cGVzXFxcIjp7fX1cIilcbmNvbmZpZy5wYXJhbWV0ZXJpemF0aW9uU2NoZW1hID0ge1xuICBzdHJpbmdzOiBKU09OLnBhcnNlKFwiW1xcXCJ3aGVyZVxcXCIsXFxcIm9yZGVyQnlcXFwiLFxcXCJjdXJzb3JcXFwiLFxcXCJwYWNrYWdlc1xcXCIsXFxcIl9jb3VudFxcXCIsXFxcImNhdGVnb3J5XFxcIixcXFwiYWdlbnRcXFwiLFxcXCJ1c2VyXFxcIixcXFwicGFja2FnZVxcXCIsXFxcImJvb2tpbmdcXFwiLFxcXCJwYXltZW50c1xcXCIsXFxcImJvb2tpbmdzXFxcIixcXFwicmV2aWV3c1xcXCIsXFxcInBvc3RzXFxcIixcXFwiYXV0aG9yXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZVxcXCIsXFxcIkJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZEZpcnN0XFxcIixcXFwiQmxvZ1Bvc3QuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJsb2dQb3N0LmZpbmRNYW55XFxcIixcXFwiZGF0YVxcXCIsXFxcIkJsb2dQb3N0LmNyZWF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LmNyZWF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ1Bvc3QudXBkYXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QudXBkYXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJjcmVhdGVcXFwiLFxcXCJ1cGRhdGVcXFwiLFxcXCJCbG9nUG9zdC51cHNlcnRPbmVcXFwiLFxcXCJCbG9nUG9zdC5kZWxldGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5kZWxldGVNYW55XFxcIixcXFwiaGF2aW5nXFxcIixcXFwiX21pblxcXCIsXFxcIl9tYXhcXFwiLFxcXCJCbG9nUG9zdC5ncm91cEJ5XFxcIixcXFwiQmxvZ1Bvc3QuYWdncmVnYXRlXFxcIixcXFwiQm9va2luZy5maW5kVW5pcXVlXFxcIixcXFwiQm9va2luZy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkJvb2tpbmcuZmluZEZpcnN0XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kTWFueVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlT25lXFxcIixcXFwiQm9va2luZy5jcmVhdGVNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQm9va2luZy51cGRhdGVPbmVcXFwiLFxcXCJCb29raW5nLnVwZGF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwc2VydE9uZVxcXCIsXFxcIkJvb2tpbmcuZGVsZXRlT25lXFxcIixcXFwiQm9va2luZy5kZWxldGVNYW55XFxcIixcXFwiX2F2Z1xcXCIsXFxcIl9zdW1cXFwiLFxcXCJCb29raW5nLmdyb3VwQnlcXFwiLFxcXCJCb29raW5nLmFnZ3JlZ2F0ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVcXFwiLFxcXCJDYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRGaXJzdFxcXCIsXFxcIkNhdGVnb3J5LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJDYXRlZ29yeS5maW5kTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cHNlcnRPbmVcXFwiLFxcXCJDYXRlZ29yeS5kZWxldGVPbmVcXFwiLFxcXCJDYXRlZ29yeS5kZWxldGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkuZ3JvdXBCeVxcXCIsXFxcIkNhdGVnb3J5LmFnZ3JlZ2F0ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRGaXJzdFxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cHNlcnRPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5kZWxldGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5kZWxldGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZ3JvdXBCeVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmFnZ3JlZ2F0ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdFxcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZE1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU9uZVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBkYXRlT25lXFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55XFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cHNlcnRPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlTWFueVxcXCIsXFxcIlBheW1lbnQuZ3JvdXBCeVxcXCIsXFxcIlBheW1lbnQuYWdncmVnYXRlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVcXFwiLFxcXCJSZXZpZXcuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJSZXZpZXcuZmluZEZpcnN0XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJSZXZpZXcuZmluZE1hbnlcXFwiLFxcXCJSZXZpZXcuY3JlYXRlT25lXFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cGRhdGVPbmVcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueVxcXCIsXFxcIlJldmlldy51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmV2aWV3LnVwc2VydE9uZVxcXCIsXFxcIlJldmlldy5kZWxldGVPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlTWFueVxcXCIsXFxcIlJldmlldy5ncm91cEJ5XFxcIixcXFwiUmV2aWV3LmFnZ3JlZ2F0ZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRVbmlxdWVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRGaXJzdFxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJUb3VyUGFja2FnZS51cHNlcnRPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5kZWxldGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5kZWxldGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuZ3JvdXBCeVxcXCIsXFxcIlRvdXJQYWNrYWdlLmFnZ3JlZ2F0ZVxcXCIsXFxcIlVzZXIuZmluZFVuaXF1ZVxcXCIsXFxcIlVzZXIuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdFxcXCIsXFxcIlVzZXIuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlVzZXIuZmluZE1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU9uZVxcXCIsXFxcIlVzZXIuY3JlYXRlTWFueVxcXCIsXFxcIlVzZXIuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBkYXRlT25lXFxcIixcXFwiVXNlci51cGRhdGVNYW55XFxcIixcXFwiVXNlci51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVXNlci51cHNlcnRPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU9uZVxcXCIsXFxcIlVzZXIuZGVsZXRlTWFueVxcXCIsXFxcIlVzZXIuZ3JvdXBCeVxcXCIsXFxcIlVzZXIuYWdncmVnYXRlXFxcIixcXFwiQU5EXFxcIixcXFwiT1JcXFwiLFxcXCJOT1RcXFwiLFxcXCJpZFxcXCIsXFxcIm5hbWVcXFwiLFxcXCJlbWFpbFxcXCIsXFxcInBhc3N3b3JkXFxcIixcXFwiZ29vZ2xlSWRcXFwiLFxcXCJwaG9uZVxcXCIsXFxcImF2YXRhclVybFxcXCIsXFxcIlJvbGVcXFwiLFxcXCJyb2xlXFxcIixcXFwiVXNlclN0YXR1c1xcXCIsXFxcInN0YXR1c1xcXCIsXFxcIkF1dGhQcm92aWRlclxcXCIsXFxcImF1dGhQcm92aWRlclxcXCIsXFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJjcmVhdGVkQXRcXFwiLFxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJlcXVhbHNcXFwiLFxcXCJpblxcXCIsXFxcIm5vdEluXFxcIixcXFwibHRcXFwiLFxcXCJsdGVcXFwiLFxcXCJndFxcXCIsXFxcImd0ZVxcXCIsXFxcIm5vdFxcXCIsXFxcImNvbnRhaW5zXFxcIixcXFwic3RhcnRzV2l0aFxcXCIsXFxcImVuZHNXaXRoXFxcIixcXFwiZXZlcnlcXFwiLFxcXCJzb21lXFxcIixcXFwibm9uZVxcXCIsXFxcInRpdGxlXFxcIixcXFwic2x1Z1xcXCIsXFxcImRlc2NyaXB0aW9uXFxcIixcXFwibG9jYXRpb25cXFwiLFxcXCJwcmljZVxcXCIsXFxcImR1cmF0aW9uXFxcIixcXFwicmF0aW5nXFxcIixcXFwiaW1hZ2VzXFxcIixcXFwiUGFja2FnZVN0YXR1c1xcXCIsXFxcImNhdGVnb3J5SWRcXFwiLFxcXCJhZ2VudElkXFxcIixcXFwiaGFzXFxcIixcXFwiaGFzRXZlcnlcXFwiLFxcXCJoYXNTb21lXFxcIixcXFwiY29tbWVudFxcXCIsXFxcInVzZXJJZFxcXCIsXFxcInBhY2thZ2VJZFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwic3ViamVjdFxcXCIsXFxcIm1lc3NhZ2VcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwidXNlcklkX3BhY2thZ2VJZFxcXCIsXFxcImlzXFxcIixcXFwiaXNOb3RcXFwiLFxcXCJjb25uZWN0T3JDcmVhdGVcXFwiLFxcXCJ1cHNlcnRcXFwiLFxcXCJjcmVhdGVNYW55XFxcIixcXFwic2V0XFxcIixcXFwiZGlzY29ubmVjdFxcXCIsXFxcImRlbGV0ZVxcXCIsXFxcImNvbm5lY3RcXFwiLFxcXCJ1cGRhdGVNYW55XFxcIixcXFwiZGVsZXRlTWFueVxcXCIsXFxcInB1c2hcXFwiLFxcXCJpbmNyZW1lbnRcXFwiLFxcXCJkZWNyZW1lbnRcXFwiLFxcXCJtdWx0aXBseVxcXCIsXFxcImRpdmlkZVxcXCJdXCIpLFxuICBncmFwaDogXCJsQVJQZ0FFUERnQUFvUUlBSUpjQkFBQ2ZBZ0F3bUFFQUFCb0FFSmtCQUFDZkFnQXdtZ0VCQUFBQUFhUUJBQUNnQXVFQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFBQUFBZDBCQVFEMUFRQWgzZ0VCQVBVQkFDSGZBUUVBOVFFQUllRUJBUUQxQVFBaEFRQUFBQUVBSUJZRkFBQ3dBZ0FnQmdBQW9RSUFJQXNBQVA0QkFDQU1BQURfQVFBZ2x3RUFBSzBDQURDWUFRQUFBd0FRbVFFQUFLMENBRENhQVFFQTlRRUFJYVFCQUFDdkFzTUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNHOEFRRUE5UUVBSWIwQkFRRDFBUUFodmdFUUFLWUNBQ0dfQVFJQS13RUFJY0FCQ0FDdUFnQWh3UUVBQUlRQ0FDRERBUUVBOVFFQUljUUJBUUQxQVFBaEJBVUFBT1FEQUNBR0FBRGdBd0FnQ3dBQXJ3TUFJQXdBQUxBREFDQVdCUUFBc0FJQUlBWUFBS0VDQUNBTEFBRC1BUUFnREFBQV93RUFJSmNCQUFDdEFnQXdtQUVBQUFNQUVKa0JBQUN0QWdBd21nRUJBQUFBQWFRQkFBQ3ZBc01CSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQUFBQUFid0JBUUQxQVFBaHZRRUJBUFVCQUNHLUFSQUFwZ0lBSWI4QkFnRDdBUUFod0FFSUFLNENBQ0hCQVFBQWhBSUFJTU1CQVFEMUFRQWh4QUVCQVBVQkFDRURBQUFBQXdBZ0FRQUFCQUF3QWdBQUJRQWdBd0FBQUFNQUlBRUFBQVFBTUFJQUFBVUFJQUVBQUFBREFDQVBCd0FBb1FJQUlBZ0FBS1FDQUNBS0FBQ3NBZ0FnbHdFQUFLb0NBRENZQVFBQUNRQVFtUUVBQUtvQ0FEQ2FBUUVBOVFFQUlhUUJBQUNyQXQwQklxb0JRQUQ4QVFBaHF3RkFBUHdCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoMlFGQUFQd0JBQ0hhQVFJQS13RUFJZHNCRUFDbUFnQWhBd2NBQU9BREFDQUlBQURoQXdBZ0NnQUE0d01BSUE4SEFBQ2hBZ0FnQ0FBQXBBSUFJQW9BQUt3Q0FDQ1hBUUFBcWdJQU1KZ0JBQUFKQUJDWkFRQUFxZ0lBTUpvQkFRQUFBQUdrQVFBQXF3TGRBU0txQVVBQV9BRUFJYXNCUUFEOEFRQWh5UUVCQVBVQkFDSEtBUUVBOVFFQUlka0JRQUQ4QVFBaDJnRUNBUHNCQUNIYkFSQUFwZ0lBSVFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBU0NRQUFxUUlBSUpjQkFBQ2xBZ0F3bUFFQUFBMEFFSmtCQUFDbEFnQXdtZ0VCQVBVQkFDR2tBUUFBcHdMUkFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHl3RUJBUFVCQUNITUFRRUE5UUVBSWMwQkFRRDJBUUFoemdFUUFLWUNBQ0hQQVFFQTlRRUFJZEVCQVFEMkFRQWgwZ0VCQVBZQkFDSFRBUUVBOWdFQUlkUUJBUUQyQVFBaDFRRkFBS2dDQUNFSENRQUE0Z01BSU0wQkFBQ3hBZ0FnMFFFQUFMRUNBQ0RTQVFBQXNRSUFJTk1CQUFDeEFnQWcxQUVBQUxFQ0FDRFZBUUFBc1FJQUlCSUpBQUNwQWdBZ2x3RUFBS1VDQURDWUFRQUFEUUFRbVFFQUFLVUNBRENhQVFFQUFBQUJwQUVBQUtjQzBRRWlxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljc0JBUUQxQVFBaHpBRUJBQUFBQWMwQkFRRDJBUUFoemdFUUFLWUNBQ0hQQVFFQTlRRUFJZEVCQVFEMkFRQWgwZ0VCQVBZQkFDSFRBUUVBOWdFQUlkUUJBUUQyQVFBaDFRRkFBS2dDQUNFREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0FRQUFBQTBBSUF3SEFBQ2hBZ0FnQ0FBQXBBSUFJSmNCQUFDakFnQXdtQUVBQUJJQUVKa0JBQUNqQWdBd21nRUJBUFVCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFod0FFQ0FQc0JBQ0hJQVFFQTlRRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDRUNCd0FBNEFNQUlBZ0FBT0VEQUNBTkJ3QUFvUUlBSUFnQUFLUUNBQ0NYQVFBQW93SUFNSmdCQUFBU0FCQ1pBUUFBb3dJQU1Kb0JBUUFBQUFHcUFVQUFfQUVBSWFzQlFBRDhBUUFod0FFQ0FQc0JBQ0hJQVFFQTlRRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGlBUUFBb2dJQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQUJBQUFBQ1FBZ0FRQUFBQklBSUFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0R3NEFBS0VDQUNDWEFRQUFud0lBTUpnQkFBQWFBQkNaQVFBQW53SUFNSm9CQVFEMUFRQWhwQUVBQUtBQzRRRWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWQwQkFRRDFBUUFoM2dFQkFQVUJBQ0hmQVFFQTlRRUFJZUVCQVFEMUFRQWhBUTRBQU9BREFDQURBQUFBR2dBZ0FRQUFHd0F3QWdBQUFRQWdBUUFBQUFNQUlBRUFBQUFKQUNBQkFBQUFFZ0FnQVFBQUFCb0FJQUVBQUFBQkFDQURBQUFBR2dBZ0FRQUFHd0F3QWdBQUFRQWdBd0FBQUJvQUlBRUFBQnNBTUFJQUFBRUFJQU1BQUFBYUFDQUJBQUFiQURBQ0FBQUJBQ0FNRGdBQTN3TUFJSm9CQVFBQUFBR2tBUUFBQU9FQkFxZ0JJQUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBYm9CQVFBQUFBRzdBUUVBQUFBQjNRRUJBQUFBQWQ0QkFRQUFBQUhmQVFFQUFBQUI0UUVCQUFBQUFRRVVBQUFsQUNBTG1nRUJBQUFBQWFRQkFBQUE0UUVDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhkQVFFQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFIaEFRRUFBQUFCQVJRQUFDY0FNQUVVQUFBbkFEQU1EZ0FBM2dNQUlKb0JBUUMzQWdBaHBBRUFBTTBDNFFFaXFBRWdBTHdDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FodWdFQkFMY0NBQ0c3QVFFQXR3SUFJZDBCQVFDM0FnQWgzZ0VCQUxjQ0FDSGZBUUVBdHdJQUllRUJBUUMzQWdBaEFnQUFBQUVBSUJRQUFDb0FJQXVhQVFFQXR3SUFJYVFCQUFETkF1RUJJcWdCSUFDOEFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlib0JBUUMzQWdBaHV3RUJBTGNDQUNIZEFRRUF0d0lBSWQ0QkFRQzNBZ0FoM3dFQkFMY0NBQ0hoQVFFQXR3SUFJUUlBQUFBYUFDQVVBQUFzQUNBQ0FBQUFHZ0FnRkFBQUxBQWdBd0FBQUFFQUlCc0FBQ1VBSUJ3QUFDb0FJQUVBQUFBQkFDQUJBQUFBR2dBZ0F3UUFBTnNEQUNBaEFBRGRBd0FnSWdBQTNBTUFJQTZYQVFBQW13SUFNSmdCQUFBekFCQ1pBUUFBbXdJQU1Kb0JBUURhQVFBaHBBRUFBSndDNFFFaXFBRWdBTjhCQUNHcUFVQUE0UUVBSWFzQlFBRGhBUUFodWdFQkFOb0JBQ0c3QVFFQTJnRUFJZDBCQVFEYUFRQWgzZ0VCQU5vQkFDSGZBUUVBMmdFQUllRUJBUURhQVFBaEF3QUFBQm9BSUFFQUFESUFNQ0FBQURNQUlBTUFBQUFhQUNBQkFBQWJBREFDQUFBQkFDQUJBQUFBQ3dBZ0FRQUFBQXNBSUFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0F3QUFBQWtBSUFFQUFBb0FNQUlBQUFzQUlBd0hBQUNrQXdBZ0NBQUFfQUlBSUFvQUFQMENBQ0NhQVFFQUFBQUJwQUVBQUFEZEFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhLQVFFQUFBQUIyUUZBQUFBQUFkb0JBZ0FBQUFIYkFSQUFBQUFCQVJRQUFEc0FJQW1hQVFFQUFBQUJwQUVBQUFEZEFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhLQVFFQUFBQUIyUUZBQUFBQUFkb0JBZ0FBQUFIYkFSQUFBQUFCQVJRQUFEMEFNQUVVQUFBOUFEQU1Cd0FBb2dNQUlBZ0FBT3NDQUNBS0FBRHNBZ0FnbWdFQkFMY0NBQ0drQVFBQTZRTGRBU0txQVVBQXZnSUFJYXNCUUFDLUFnQWh5UUVCQUxjQ0FDSEtBUUVBdHdJQUlka0JRQUMtQWdBaDJnRUNBTDBDQUNIYkFSQUE2QUlBSVFJQUFBQUxBQ0FVQUFCQUFDQUptZ0VCQUxjQ0FDR2tBUUFBNlFMZEFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSWRrQlFBQy1BZ0FoMmdFQ0FMMENBQ0hiQVJBQTZBSUFJUUlBQUFBSkFDQVVBQUJDQUNBQ0FBQUFDUUFnRkFBQVFnQWdBd0FBQUFzQUlCc0FBRHNBSUJ3QUFFQUFJQUVBQUFBTEFDQUJBQUFBQ1FBZ0JRUUFBTllEQUNBaEFBRFpBd0FnSWdBQTJBTUFJRE1BQU5jREFDQTBBQURhQXdBZ0RKY0JBQUNYQWdBd21BRUFBRWtBRUprQkFBQ1hBZ0F3bWdFQkFOb0JBQ0drQVFBQW1BTGRBU0txQVVBQTRRRUFJYXNCUUFEaEFRQWh5UUVCQU5vQkFDSEtBUUVBMmdFQUlka0JRQURoQVFBaDJnRUNBT0FCQUNIYkFSQUFnZ0lBSVFNQUFBQUpBQ0FCQUFCSUFEQWdBQUJKQUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0NRTUFBUDBCQUNDWEFRQUFsZ0lBTUpnQkFBQlBBQkNaQVFBQWxnSUFNSm9CQVFBQUFBR2JBUUVBQUFBQnFnRkFBUHdCQUNHckFVQUFfQUVBSWJzQkFRQUFBQUVCQUFBQVRBQWdBUUFBQUV3QUlBa0RBQUQ5QVFBZ2x3RUFBSllDQURDWUFRQUFUd0FRbVFFQUFKWUNBRENhQVFFQTlRRUFJWnNCQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlic0JBUUQxQVFBaEFRTUFBSzREQUNBREFBQUFUd0FnQVFBQVVBQXdBZ0FBVEFBZ0F3QUFBRThBSUFFQUFGQUFNQUlBQUV3QUlBTUFBQUJQQUNBQkFBQlFBREFDQUFCTUFDQUdBd0FBMVFNQUlKb0JBUUFBQUFHYkFRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRzdBUUVBQUFBQkFSUUFBRlFBSUFXYUFRRUFBQUFCbXdFQkFBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnV3RUJBQUFBQVFFVUFBQldBREFCRkFBQVZnQXdCZ01BQU1zREFDQ2FBUUVBdHdJQUlac0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJzQkFRQzNBZ0FoQWdBQUFFd0FJQlFBQUZrQUlBV2FBUUVBdHdJQUlac0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJzQkFRQzNBZ0FoQWdBQUFFOEFJQlFBQUZzQUlBSUFBQUJQQUNBVUFBQmJBQ0FEQUFBQVRBQWdHd0FBVkFBZ0hBQUFXUUFnQVFBQUFFd0FJQUVBQUFCUEFDQURCQUFBeUFNQUlDRUFBTW9EQUNBaUFBREpBd0FnQ0pjQkFBQ1ZBZ0F3bUFFQUFHSUFFSmtCQUFDVkFnQXdtZ0VCQU5vQkFDR2JBUUVBMmdFQUlhb0JRQURoQVFBaHF3RkFBT0VCQUNHN0FRRUEyZ0VBSVFNQUFBQlBBQ0FCQUFCaEFEQWdBQUJpQUNBREFBQUFUd0FnQVFBQVVBQXdBZ0FBVEFBZ0M1Y0JBQUNVQWdBd21BRUFBR2dBRUprQkFBQ1VBZ0F3bWdFQkFBQUFBWnNCQVFEMUFRQWhuQUVCQVBVQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaDFnRUJBUFVCQUNIWEFRRUE5UUVBSWRnQklBRDZBUUFoQVFBQUFHVUFJQUVBQUFCbEFDQUxsd0VBQUpRQ0FEQ1lBUUFBYUFBUW1RRUFBSlFDQURDYUFRRUE5UUVBSVpzQkFRRDFBUUFobkFFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWgxZ0VCQVBVQkFDSFhBUUVBOVFFQUlkZ0JJQUQ2QVFBaEFBTUFBQUJvQUNBQkFBQnBBREFDQUFCbEFDQURBQUFBYUFBZ0FRQUFhUUF3QWdBQVpRQWdBd0FBQUdnQUlBRUFBR2tBTUFJQUFHVUFJQWlhQVFFQUFBQUJtd0VCQUFBQUFad0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBZFlCQVFBQUFBSFhBUUVBQUFBQjJBRWdBQUFBQVFFVUFBQnRBQ0FJbWdFQkFBQUFBWnNCQVFBQUFBR2NBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhXQVFFQUFBQUIxd0VCQUFBQUFkZ0JJQUFBQUFFQkZBQUFid0F3QVJRQUFHOEFNQWlhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaDFnRUJBTGNDQUNIWEFRRUF0d0lBSWRnQklBQzhBZ0FoQWdBQUFHVUFJQlFBQUhJQUlBaWFBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoMWdFQkFMY0NBQ0hYQVFFQXR3SUFJZGdCSUFDOEFnQWhBZ0FBQUdnQUlCUUFBSFFBSUFJQUFBQm9BQ0FVQUFCMEFDQURBQUFBWlFBZ0d3QUFiUUFnSEFBQWNnQWdBUUFBQUdVQUlBRUFBQUJvQUNBREJBQUF4UU1BSUNFQUFNY0RBQ0FpQUFER0F3QWdDNWNCQUFDVEFnQXdtQUVBQUhzQUVKa0JBQUNUQWdBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSVp3QkFRRGFBUUFocWdGQUFPRUJBQ0dyQVVBQTRRRUFJZFlCQVFEYUFRQWgxd0VCQU5vQkFDSFlBU0FBM3dFQUlRTUFBQUJvQUNBQkFBQjZBREFnQUFCN0FDQURBQUFBYUFBZ0FRQUFhUUF3QWdBQVpRQWdBUUFBQUE4QUlBRUFBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0F3QUFBQTBBSUFFQUFBNEFNQUlBQUE4QUlBTUFBQUFOQUNBQkFBQU9BREFDQUFBUEFDQVBDUUFBeEFNQUlKb0JBUUFBQUFHa0FRQUFBTkVCQXFvQlFBQUFBQUdyQVVBQUFBQUJ5d0VCQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFUUFBQUFBYzhCQVFBQUFBSFJBUUVBQUFBQjBnRUJBQUFBQWRNQkFRQUFBQUhVQVFFQUFBQUIxUUZBQUFBQUFRRVVBQUNEQVFBZ0Rwb0JBUUFBQUFHa0FRQUFBTkVCQXFvQlFBQUFBQUdyQVVBQUFBQUJ5d0VCQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFUUFBQUFBYzhCQVFBQUFBSFJBUUVBQUFBQjBnRUJBQUFBQWRNQkFRQUFBQUhVQVFFQUFBQUIxUUZBQUFBQUFRRVVBQUNGQVFBd0FSUUFBSVVCQURBUENRQUF3d01BSUpvQkFRQzNBZ0FocEFFQUFQY0MwUUVpcWdGQUFMNENBQ0dyQVVBQXZnSUFJY3NCQVFDM0FnQWh6QUVCQUxjQ0FDSE5BUUVBdUFJQUljNEJFQURvQWdBaHp3RUJBTGNDQUNIUkFRRUF1QUlBSWRJQkFRQzRBZ0FoMHdFQkFMZ0NBQ0hVQVFFQXVBSUFJZFVCUUFENEFnQWhBZ0FBQUE4QUlCUUFBSWdCQUNBT21nRUJBTGNDQUNHa0FRQUE5d0xSQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeXdFQkFMY0NBQ0hNQVFFQXR3SUFJYzBCQVFDNEFnQWh6Z0VRQU9nQ0FDSFBBUUVBdHdJQUlkRUJBUUM0QWdBaDBnRUJBTGdDQUNIVEFRRUF1QUlBSWRRQkFRQzRBZ0FoMVFGQUFQZ0NBQ0VDQUFBQURRQWdGQUFBaWdFQUlBSUFBQUFOQUNBVUFBQ0tBUUFnQXdBQUFBOEFJQnNBQUlNQkFDQWNBQUNJQVFBZ0FRQUFBQThBSUFFQUFBQU5BQ0FMQkFBQXZnTUFJQ0VBQU1FREFDQWlBQURBQXdBZ013QUF2d01BSURRQUFNSURBQ0ROQVFBQXNRSUFJTkVCQUFDeEFnQWcwZ0VBQUxFQ0FDRFRBUUFBc1FJQUlOUUJBQUN4QWdBZzFRRUFBTEVDQUNBUmx3RUFBSXdDQURDWUFRQUFrUUVBRUprQkFBQ01BZ0F3bWdFQkFOb0JBQ0drQVFBQWpRTFJBU0txQVVBQTRRRUFJYXNCUUFEaEFRQWh5d0VCQU5vQkFDSE1BUUVBMmdFQUljMEJBUURiQVFBaHpnRVFBSUlDQUNIUEFRRUEyZ0VBSWRFQkFRRGJBUUFoMGdFQkFOc0JBQ0hUQVFFQTJ3RUFJZFFCQVFEYkFRQWgxUUZBQUk0Q0FDRURBQUFBRFFBZ0FRQUFrQUVBTUNBQUFKRUJBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFCUUFJQUVBQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FKQndBQW1RTUFJQWdBQU4wQ0FDQ2FBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFja0JBUUFBQUFIS0FRRUFBQUFCQVJRQUFKa0JBQ0FIbWdFQkFBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQndBRUNBQUFBQWNnQkFRQUFBQUhKQVFFQUFBQUJ5Z0VCQUFBQUFRRVVBQUNiQVFBd0FSUUFBSnNCQURBSkJ3QUFsd01BSUFnQUFOc0NBQ0NhQVFFQXR3SUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSEFBUUlBdlFJQUljZ0JBUUMzQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSVFJQUFBQVVBQ0FVQUFDZUFRQWdCNW9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSWNvQkFRQzNBZ0FoQWdBQUFCSUFJQlFBQUtBQkFDQUNBQUFBRWdBZ0ZBQUFvQUVBSUFNQUFBQVVBQ0FiQUFDWkFRQWdIQUFBbmdFQUlBRUFBQUFVQUNBQkFBQUFFZ0FnQlFRQUFMa0RBQ0FoQUFDOEF3QWdJZ0FBdXdNQUlETUFBTG9EQUNBMEFBQzlBd0FnQ3BjQkFBQ0xBZ0F3bUFFQUFLY0JBQkNaQVFBQWl3SUFNSm9CQVFEYUFRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUljQUJBZ0RnQVFBaHlBRUJBTm9CQUNISkFRRUEyZ0VBSWNvQkFRRGFBUUFoQXdBQUFCSUFJQUVBQUtZQkFEQWdBQUNuQVFBZ0F3QUFBQklBSUFFQUFCTUFNQUlBQUJRQUlBRUFBQUFGQUNBQkFBQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0V3VUFBS2NEQUNBR0FBQzRBd0FnQ3dBQXFBTUFJQXdBQUtrREFDQ2FBUUVBQUFBQnBBRUFBQUREQVFLb0FTQUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRzZBUUVBQUFBQnV3RUJBQUFBQWJ3QkFRQUFBQUc5QVFFQUFBQUJ2Z0VRQUFBQUFiOEJBZ0FBQUFIQUFRZ0FBQUFCd1FFQUFLWURBQ0REQVFFQUFBQUJ4QUVCQUFBQUFRRVVBQUN2QVFBZ0Q1b0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFSUUFBTEVCQURBQkZBQUFzUUVBTUJNRkFBQ01Bd0FnQmdBQXR3TUFJQXNBQUkwREFDQU1BQUNPQXdBZ21nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0Fnd3dFQkFMY0NBQ0hFQVFFQXR3SUFJUUlBQUFBRkFDQVVBQUMwQVFBZ0Q1b0JBUUMzQWdBaHBBRUFBSW9Ed3dFaXFBRWdBTHdDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FodWdFQkFMY0NBQ0c3QVFFQXR3SUFJYndCQVFDM0FnQWh2UUVCQUxjQ0FDRy1BUkFBNkFJQUliOEJBZ0M5QWdBaHdBRUlBSWdEQUNIQkFRQUFpUU1BSU1NQkFRQzNBZ0FoeEFFQkFMY0NBQ0VDQUFBQUF3QWdGQUFBdGdFQUlBSUFBQUFEQUNBVUFBQzJBUUFnQXdBQUFBVUFJQnNBQUs4QkFDQWNBQUMwQVFBZ0FRQUFBQVVBSUFFQUFBQURBQ0FGQkFBQXNnTUFJQ0VBQUxVREFDQWlBQUMwQXdBZ013QUFzd01BSURRQUFMWURBQ0FTbHdFQUFJRUNBRENZQVFBQXZRRUFFSmtCQUFDQkFnQXdtZ0VCQU5vQkFDR2tBUUFBaFFMREFTS29BU0FBM3dFQUlhb0JRQURoQVFBaHF3RkFBT0VCQUNHNkFRRUEyZ0VBSWJzQkFRRGFBUUFodkFFQkFOb0JBQ0c5QVFFQTJnRUFJYjRCRUFDQ0FnQWh2d0VDQU9BQkFDSEFBUWdBZ3dJQUljRUJBQUNFQWdBZ3d3RUJBTm9CQUNIRUFRRUEyZ0VBSVFNQUFBQURBQ0FCQUFDOEFRQXdJQUFBdlFFQUlBTUFBQUFEQUNBQkFBQUVBREFDQUFBRkFDQVdBd0FBX1FFQUlBc0FBUDRCQUNBTUFBRF9BUUFnRFFBQWdBSUFJSmNCQUFEMEFRQXdtQUVBQU1NQkFCQ1pBUUFBOUFFQU1Kb0JBUUFBQUFHYkFRRUE5UUVBSVp3QkFRQUFBQUdkQVFFQTlnRUFJWjRCQVFBQUFBR2ZBUUVBOWdFQUlhQUJBUUQyQVFBaG9nRUFBUGNCb2dFaXBBRUFBUGdCcEFFaXBnRUFBUGtCcGdFaXB3RWdBUG9CQUNHb0FTQUEtZ0VBSWFrQkFnRDdBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJUUVBQUFEQUFRQWdBUUFBQU1BQkFDQVdBd0FBX1FFQUlBc0FBUDRCQUNBTUFBRF9BUUFnRFFBQWdBSUFJSmNCQUFEMEFRQXdtQUVBQU1NQkFCQ1pBUUFBOUFFQU1Kb0JBUUQxQVFBaG13RUJBUFVCQUNHY0FRRUE5UUVBSVowQkFRRDJBUUFobmdFQkFQWUJBQ0dmQVFFQTlnRUFJYUFCQVFEMkFRQWhvZ0VBQVBjQm9nRWlwQUVBQVBnQnBBRWlwZ0VBQVBrQnBnRWlwd0VnQVBvQkFDR29BU0FBLWdFQUlha0JBZ0Q3QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSVFnREFBQ3VBd0FnQ3dBQXJ3TUFJQXdBQUxBREFDQU5BQUN4QXdBZ25RRUFBTEVDQUNDZUFRQUFzUUlBSUo4QkFBQ3hBZ0Fnb0FFQUFMRUNBQ0FEQUFBQXd3RUFJQUVBQU1RQkFEQUNBQURBQVFBZ0F3QUFBTU1CQUNBQkFBREVBUUF3QWdBQXdBRUFJQU1BQUFEREFRQWdBUUFBeEFFQU1BSUFBTUFCQUNBVEF3QUFxZ01BSUFzQUFLc0RBQ0FNQUFDc0F3QWdEUUFBclFNQUlKb0JBUUFBQUFHYkFRRUFBQUFCbkFFQkFBQUFBWjBCQVFBQUFBR2VBUUVBQUFBQm53RUJBQUFBQWFBQkFRQUFBQUdpQVFBQUFLSUJBcVFCQUFBQXBBRUNwZ0VBQUFDbUFRS25BU0FBQUFBQnFBRWdBQUFBQWFrQkFnQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFRRVVBQURJQVFBZ0Q1b0JBUUFBQUFHYkFRRUFBQUFCbkFFQkFBQUFBWjBCQVFBQUFBR2VBUUVBQUFBQm53RUJBQUFBQWFBQkFRQUFBQUdpQVFBQUFLSUJBcVFCQUFBQXBBRUNwZ0VBQUFDbUFRS25BU0FBQUFBQnFBRWdBQUFBQWFrQkFnQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFRRVVBQURLQVFBd0FSUUFBTW9CQURBVEF3QUF2d0lBSUFzQUFNQUNBQ0FNQUFEQkFnQWdEUUFBd2dJQUlKb0JBUUMzQWdBaG13RUJBTGNDQUNHY0FRRUF0d0lBSVowQkFRQzRBZ0FobmdFQkFMZ0NBQ0dmQVFFQXVBSUFJYUFCQVFDNEFnQWhvZ0VBQUxrQ29nRWlwQUVBQUxvQ3BBRWlwZ0VBQUxzQ3BnRWlwd0VnQUx3Q0FDR29BU0FBdkFJQUlha0JBZ0M5QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSVFJQUFBREFBUUFnRkFBQXpRRUFJQS1hQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRUNBQUFBd3dFQUlCUUFBTThCQUNBQ0FBQUF3d0VBSUJRQUFNOEJBQ0FEQUFBQXdBRUFJQnNBQU1nQkFDQWNBQUROQVFBZ0FRQUFBTUFCQUNBQkFBQUF3d0VBSUFrRUFBQ3lBZ0FnSVFBQXRRSUFJQ0lBQUxRQ0FDQXpBQUN6QWdBZ05BQUF0Z0lBSUowQkFBQ3hBZ0FnbmdFQUFMRUNBQ0NmQVFBQXNRSUFJS0FCQUFDeEFnQWdFcGNCQUFEWkFRQXdtQUVBQU5ZQkFCQ1pBUUFBMlFFQU1Kb0JBUURhQVFBaG13RUJBTm9CQUNHY0FRRUEyZ0VBSVowQkFRRGJBUUFobmdFQkFOc0JBQ0dmQVFFQTJ3RUFJYUFCQVFEYkFRQWhvZ0VBQU53Qm9nRWlwQUVBQU4wQnBBRWlwZ0VBQU40QnBnRWlwd0VnQU44QkFDR29BU0FBM3dFQUlha0JBZ0RnQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSVFNQUFBRERBUUFnQVFBQTFRRUFNQ0FBQU5ZQkFDQURBQUFBd3dFQUlBRUFBTVFCQURBQ0FBREFBUUFnRXBjQkFBRFpBUUF3bUFFQUFOWUJBQkNaQVFBQTJRRUFNSm9CQVFEYUFRQWhtd0VCQU5vQkFDR2NBUUVBMmdFQUlaMEJBUURiQVFBaG5nRUJBTnNCQUNHZkFRRUEyd0VBSWFBQkFRRGJBUUFob2dFQUFOd0JvZ0VpcEFFQUFOMEJwQUVpcGdFQUFONEJwZ0VpcHdFZ0FOOEJBQ0dvQVNBQTN3RUFJYWtCQWdEZ0FRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlRNEVBQURqQVFBZ0lRQUE4d0VBSUNJQUFQTUJBQ0NzQVFFQUFBQUJyUUVCQUFBQUJLNEJBUUFBQUFTdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBUElCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRU9CQUFBOEFFQUlDRUFBUEVCQUNBaUFBRHhBUUFnckFFQkFBQUFBYTBCQVFBQUFBV3VBUUVBQUFBRnJ3RUJBQUFBQWJBQkFRQUFBQUd4QVFFQUFBQUJzZ0VCQUFBQUFiTUJBUUR2QVFBaHRBRUJBQUFBQWJVQkFRQUFBQUcyQVFFQUFBQUJCd1FBQU9NQkFDQWhBQUR1QVFBZ0lnQUE3Z0VBSUt3QkFBQUFvZ0VDclFFQUFBQ2lBUWl1QVFBQUFLSUJDTE1CQUFEdEFhSUJJZ2NFQUFEakFRQWdJUUFBN0FFQUlDSUFBT3dCQUNDc0FRQUFBS1FCQXEwQkFBQUFwQUVJcmdFQUFBQ2tBUWl6QVFBQTZ3R2tBU0lIQkFBQTR3RUFJQ0VBQU9vQkFDQWlBQURxQVFBZ3JBRUFBQUNtQVFLdEFRQUFBS1lCQ0s0QkFBQUFwZ0VJc3dFQUFPa0JwZ0VpQlFRQUFPTUJBQ0FoQUFEb0FRQWdJZ0FBNkFFQUlLd0JJQUFBQUFHekFTQUE1d0VBSVEwRUFBRGpBUUFnSVFBQTR3RUFJQ0lBQU9NQkFDQXpBQURtQVFBZ05BQUE0d0VBSUt3QkFnQUFBQUd0QVFJQUFBQUVyZ0VDQUFBQUJLOEJBZ0FBQUFHd0FRSUFBQUFCc1FFQ0FBQUFBYklCQWdBQUFBR3pBUUlBNVFFQUlRc0VBQURqQVFBZ0lRQUE1QUVBSUNJQUFPUUJBQ0NzQVVBQUFBQUJyUUZBQUFBQUJLNEJRQUFBQUFTdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBT0lCQUNFTEJBQUE0d0VBSUNFQUFPUUJBQ0FpQUFEa0FRQWdyQUZBQUFBQUFhMEJRQUFBQUFTdUFVQUFBQUFFcndGQUFBQUFBYkFCUUFBQUFBR3hBVUFBQUFBQnNnRkFBQUFBQWJNQlFBRGlBUUFoQ0t3QkFnQUFBQUd0QVFJQUFBQUVyZ0VDQUFBQUJLOEJBZ0FBQUFHd0FRSUFBQUFCc1FFQ0FBQUFBYklCQWdBQUFBR3pBUUlBNHdFQUlRaXNBVUFBQUFBQnJRRkFBQUFBQks0QlFBQUFBQVN2QVVBQUFBQUJzQUZBQUFBQUFiRUJRQUFBQUFHeUFVQUFBQUFCc3dGQUFPUUJBQ0VOQkFBQTR3RUFJQ0VBQU9NQkFDQWlBQURqQVFBZ013QUE1Z0VBSURRQUFPTUJBQ0NzQVFJQUFBQUJyUUVDQUFBQUJLNEJBZ0FBQUFTdkFRSUFBQUFCc0FFQ0FBQUFBYkVCQWdBQUFBR3lBUUlBQUFBQnN3RUNBT1VCQUNFSXJBRUlBQUFBQWEwQkNBQUFBQVN1QVFnQUFBQUVyd0VJQUFBQUFiQUJDQUFBQUFHeEFRZ0FBQUFCc2dFSUFBQUFBYk1CQ0FEbUFRQWhCUVFBQU9NQkFDQWhBQURvQVFBZ0lnQUE2QUVBSUt3QklBQUFBQUd6QVNBQTV3RUFJUUtzQVNBQUFBQUJzd0VnQU9nQkFDRUhCQUFBNHdFQUlDRUFBT29CQUNBaUFBRHFBUUFnckFFQUFBQ21BUUt0QVFBQUFLWUJDSzRCQUFBQXBnRUlzd0VBQU9rQnBnRWlCS3dCQUFBQXBnRUNyUUVBQUFDbUFRaXVBUUFBQUtZQkNMTUJBQURxQWFZQklnY0VBQURqQVFBZ0lRQUE3QUVBSUNJQUFPd0JBQ0NzQVFBQUFLUUJBcTBCQUFBQXBBRUlyZ0VBQUFDa0FRaXpBUUFBNndHa0FTSUVyQUVBQUFDa0FRS3RBUUFBQUtRQkNLNEJBQUFBcEFFSXN3RUFBT3dCcEFFaUJ3UUFBT01CQUNBaEFBRHVBUUFnSWdBQTdnRUFJS3dCQUFBQW9nRUNyUUVBQUFDaUFRaXVBUUFBQUtJQkNMTUJBQUR0QWFJQklnU3NBUUFBQUtJQkFxMEJBQUFBb2dFSXJnRUFBQUNpQVFpekFRQUE3Z0dpQVNJT0JBQUE4QUVBSUNFQUFQRUJBQ0FpQUFEeEFRQWdyQUVCQUFBQUFhMEJBUUFBQUFXdUFRRUFBQUFGcndFQkFBQUFBYkFCQVFBQUFBR3hBUUVBQUFBQnNnRUJBQUFBQWJNQkFRRHZBUUFodEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQkNLd0JBZ0FBQUFHdEFRSUFBQUFGcmdFQ0FBQUFCYThCQWdBQUFBR3dBUUlBQUFBQnNRRUNBQUFBQWJJQkFnQUFBQUd6QVFJQThBRUFJUXVzQVFFQUFBQUJyUUVCQUFBQUJhNEJBUUFBQUFXdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBUEVCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRU9CQUFBNHdFQUlDRUFBUE1CQUNBaUFBRHpBUUFnckFFQkFBQUFBYTBCQVFBQUFBU3VBUUVBQUFBRXJ3RUJBQUFBQWJBQkFRQUFBQUd4QVFFQUFBQUJzZ0VCQUFBQUFiTUJBUUR5QVFBaHRBRUJBQUFBQWJVQkFRQUFBQUcyQVFFQUFBQUJDNndCQVFBQUFBR3RBUUVBQUFBRXJnRUJBQUFBQks4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4d0VBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFSWURBQUQ5QVFBZ0N3QUFfZ0VBSUF3QUFQOEJBQ0FOQUFDQUFnQWdsd0VBQVBRQkFEQ1lBUUFBd3dFQUVKa0JBQUQwQVFBd21nRUJBUFVCQUNHYkFRRUE5UUVBSVp3QkFRRDFBUUFoblFFQkFQWUJBQ0dlQVFFQTlnRUFJWjhCQVFEMkFRQWhvQUVCQVBZQkFDR2lBUUFBOXdHaUFTS2tBUUFBLUFHa0FTS21BUUFBLVFHbUFTS25BU0FBLWdFQUlhZ0JJQUQ2QVFBaHFRRUNBUHNCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoQzZ3QkFRQUFBQUd0QVFFQUFBQUVyZ0VCQUFBQUJLOEJBUUFBQUFHd0FRRUFBQUFCc1FFQkFBQUFBYklCQVFBQUFBR3pBUUVBOHdFQUliUUJBUUFBQUFHMUFRRUFBQUFCdGdFQkFBQUFBUXVzQVFFQUFBQUJyUUVCQUFBQUJhNEJBUUFBQUFXdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBUEVCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRUVyQUVBQUFDaUFRS3RBUUFBQUtJQkNLNEJBQUFBb2dFSXN3RUFBTzRCb2dFaUJLd0JBQUFBcEFFQ3JRRUFBQUNrQVFpdUFRQUFBS1FCQ0xNQkFBRHNBYVFCSWdTc0FRQUFBS1lCQXEwQkFBQUFwZ0VJcmdFQUFBQ21BUWl6QVFBQTZnR21BU0lDckFFZ0FBQUFBYk1CSUFEb0FRQWhDS3dCQWdBQUFBR3RBUUlBQUFBRXJnRUNBQUFBQks4QkFnQUFBQUd3QVFJQUFBQUJzUUVDQUFBQUFiSUJBZ0FBQUFHekFRSUE0d0VBSVFpc0FVQUFBQUFCclFGQUFBQUFCSzRCUUFBQUFBU3ZBVUFBQUFBQnNBRkFBQUFBQWJFQlFBQUFBQUd5QVVBQUFBQUJzd0ZBQU9RQkFDRUR0d0VBQUFNQUlMZ0JBQUFEQUNDNUFRQUFBd0FnQTdjQkFBQUpBQ0M0QVFBQUNRQWd1UUVBQUFrQUlBTzNBUUFBRWdBZ3VBRUFBQklBSUxrQkFBQVNBQ0FEdHdFQUFCb0FJTGdCQUFBYUFDQzVBUUFBR2dBZ0VwY0JBQUNCQWdBd21BRUFBTDBCQUJDWkFRQUFnUUlBTUpvQkFRRGFBUUFocEFFQUFJVUN3d0VpcUFFZ0FOOEJBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh1Z0VCQU5vQkFDRzdBUUVBMmdFQUlid0JBUURhQVFBaHZRRUJBTm9CQUNHLUFSQUFnZ0lBSWI4QkFnRGdBUUFod0FFSUFJTUNBQ0hCQVFBQWhBSUFJTU1CQVFEYUFRQWh4QUVCQU5vQkFDRU5CQUFBNHdFQUlDRUFBSW9DQUNBaUFBQ0tBZ0FnTXdBQWlnSUFJRFFBQUlvQ0FDQ3NBUkFBQUFBQnJRRVFBQUFBQks0QkVBQUFBQVN2QVJBQUFBQUJzQUVRQUFBQUFiRUJFQUFBQUFHeUFSQUFBQUFCc3dFUUFJa0NBQ0VOQkFBQTR3RUFJQ0VBQU9ZQkFDQWlBQURtQVFBZ013QUE1Z0VBSURRQUFPWUJBQ0NzQVFnQUFBQUJyUUVJQUFBQUJLNEJDQUFBQUFTdkFRZ0FBQUFCc0FFSUFBQUFBYkVCQ0FBQUFBR3lBUWdBQUFBQnN3RUlBSWdDQUNFRXJBRUJBQUFBQmNVQkFRQUFBQUhHQVFFQUFBQUV4d0VCQUFBQUJBY0VBQURqQVFBZ0lRQUFod0lBSUNJQUFJY0NBQ0NzQVFBQUFNTUJBcTBCQUFBQXd3RUlyZ0VBQUFEREFRaXpBUUFBaGdMREFTSUhCQUFBNHdFQUlDRUFBSWNDQUNBaUFBQ0hBZ0FnckFFQUFBRERBUUt0QVFBQUFNTUJDSzRCQUFBQXd3RUlzd0VBQUlZQ3d3RWlCS3dCQUFBQXd3RUNyUUVBQUFEREFRaXVBUUFBQU1NQkNMTUJBQUNIQXNNQklnMEVBQURqQVFBZ0lRQUE1Z0VBSUNJQUFPWUJBQ0F6QUFEbUFRQWdOQUFBNWdFQUlLd0JDQUFBQUFHdEFRZ0FBQUFFcmdFSUFBQUFCSzhCQ0FBQUFBR3dBUWdBQUFBQnNRRUlBQUFBQWJJQkNBQUFBQUd6QVFnQWlBSUFJUTBFQUFEakFRQWdJUUFBaWdJQUlDSUFBSW9DQUNBekFBQ0tBZ0FnTkFBQWlnSUFJS3dCRUFBQUFBR3RBUkFBQUFBRXJnRVFBQUFBQks4QkVBQUFBQUd3QVJBQUFBQUJzUUVRQUFBQUFiSUJFQUFBQUFHekFSQUFpUUlBSVFpc0FSQUFBQUFCclFFUUFBQUFCSzRCRUFBQUFBU3ZBUkFBQUFBQnNBRVFBQUFBQWJFQkVBQUFBQUd5QVJBQUFBQUJzd0VRQUlvQ0FDRUtsd0VBQUlzQ0FEQ1lBUUFBcHdFQUVKa0JBQUNMQWdBd21nRUJBTm9CQUNHcUFVQUE0UUVBSWFzQlFBRGhBUUFod0FFQ0FPQUJBQ0hJQVFFQTJnRUFJY2tCQVFEYUFRQWh5Z0VCQU5vQkFDRVJsd0VBQUl3Q0FEQ1lBUUFBa1FFQUVKa0JBQUNNQWdBd21nRUJBTm9CQUNHa0FRQUFqUUxSQVNLcUFVQUE0UUVBSWFzQlFBRGhBUUFoeXdFQkFOb0JBQ0hNQVFFQTJnRUFJYzBCQVFEYkFRQWh6Z0VRQUlJQ0FDSFBBUUVBMmdFQUlkRUJBUURiQVFBaDBnRUJBTnNCQUNIVEFRRUEyd0VBSWRRQkFRRGJBUUFoMVFGQUFJNENBQ0VIQkFBQTR3RUFJQ0VBQUpJQ0FDQWlBQUNTQWdBZ3JBRUFBQURSQVFLdEFRQUFBTkVCQ0s0QkFBQUEwUUVJc3dFQUFKRUMwUUVpQ3dRQUFQQUJBQ0FoQUFDUUFnQWdJZ0FBa0FJQUlLd0JRQUFBQUFHdEFVQUFBQUFGcmdGQUFBQUFCYThCUUFBQUFBR3dBVUFBQUFBQnNRRkFBQUFBQWJJQlFBQUFBQUd6QVVBQWp3SUFJUXNFQUFEd0FRQWdJUUFBa0FJQUlDSUFBSkFDQUNDc0FVQUFBQUFCclFGQUFBQUFCYTRCUUFBQUFBV3ZBVUFBQUFBQnNBRkFBQUFBQWJFQlFBQUFBQUd5QVVBQUFBQUJzd0ZBQUk4Q0FDRUlyQUZBQUFBQUFhMEJRQUFBQUFXdUFVQUFBQUFGcndGQUFBQUFBYkFCUUFBQUFBR3hBVUFBQUFBQnNnRkFBQUFBQWJNQlFBQ1FBZ0FoQndRQUFPTUJBQ0FoQUFDU0FnQWdJZ0FBa2dJQUlLd0JBQUFBMFFFQ3JRRUFBQURSQVFpdUFRQUFBTkVCQ0xNQkFBQ1JBdEVCSWdTc0FRQUFBTkVCQXEwQkFBQUEwUUVJcmdFQUFBRFJBUWl6QVFBQWtnTFJBU0lMbHdFQUFKTUNBRENZQVFBQWV3QVFtUUVBQUpNQ0FEQ2FBUUVBMmdFQUlac0JBUURhQVFBaG5BRUJBTm9CQUNHcUFVQUE0UUVBSWFzQlFBRGhBUUFoMWdFQkFOb0JBQ0hYQVFFQTJnRUFJZGdCSUFEZkFRQWhDNWNCQUFDVUFnQXdtQUVBQUdnQUVKa0JBQUNVQWdBd21nRUJBUFVCQUNHYkFRRUE5UUVBSVp3QkFRRDFBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJZFlCQVFEMUFRQWgxd0VCQVBVQkFDSFlBU0FBLWdFQUlRaVhBUUFBbFFJQU1KZ0JBQUJpQUJDWkFRQUFsUUlBTUpvQkFRRGFBUUFobXdFQkFOb0JBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh1d0VCQU5vQkFDRUpBd0FBX1FFQUlKY0JBQUNXQWdBd21BRUFBRThBRUprQkFBQ1dBZ0F3bWdFQkFQVUJBQ0diQVFFQTlRRUFJYW9CUUFEOEFRQWhxd0ZBQVB3QkFDRzdBUUVBOVFFQUlReVhBUUFBbHdJQU1KZ0JBQUJKQUJDWkFRQUFsd0lBTUpvQkFRRGFBUUFocEFFQUFKZ0MzUUVpcWdGQUFPRUJBQ0dyQVVBQTRRRUFJY2tCQVFEYUFRQWh5Z0VCQU5vQkFDSFpBVUFBNFFFQUlkb0JBZ0RnQVFBaDJ3RVFBSUlDQUNFSEJBQUE0d0VBSUNFQUFKb0NBQ0FpQUFDYUFnQWdyQUVBQUFEZEFRS3RBUUFBQU4wQkNLNEJBQUFBM1FFSXN3RUFBSmtDM1FFaUJ3UUFBT01CQUNBaEFBQ2FBZ0FnSWdBQW1nSUFJS3dCQUFBQTNRRUNyUUVBQUFEZEFRaXVBUUFBQU4wQkNMTUJBQUNaQXQwQklnU3NBUUFBQU4wQkFxMEJBQUFBM1FFSXJnRUFBQURkQVFpekFRQUFtZ0xkQVNJT2x3RUFBSnNDQURDWUFRQUFNd0FRbVFFQUFKc0NBRENhQVFFQTJnRUFJYVFCQUFDY0F1RUJJcWdCSUFEZkFRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlib0JBUURhQVFBaHV3RUJBTm9CQUNIZEFRRUEyZ0VBSWQ0QkFRRGFBUUFoM3dFQkFOb0JBQ0hoQVFFQTJnRUFJUWNFQUFEakFRQWdJUUFBbmdJQUlDSUFBSjRDQUNDc0FRQUFBT0VCQXEwQkFBQUE0UUVJcmdFQUFBRGhBUWl6QVFBQW5RTGhBU0lIQkFBQTR3RUFJQ0VBQUo0Q0FDQWlBQUNlQWdBZ3JBRUFBQURoQVFLdEFRQUFBT0VCQ0s0QkFBQUE0UUVJc3dFQUFKMEM0UUVpQkt3QkFBQUE0UUVDclFFQUFBRGhBUWl1QVFBQUFPRUJDTE1CQUFDZUF1RUJJZzhPQUFDaEFnQWdsd0VBQUo4Q0FEQ1lBUUFBR2dBUW1RRUFBSjhDQURDYUFRRUE5UUVBSWFRQkFBQ2dBdUVCSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQVBVQkFDSGRBUUVBOVFFQUlkNEJBUUQxQVFBaDN3RUJBUFVCQUNIaEFRRUE5UUVBSVFTc0FRQUFBT0VCQXEwQkFBQUE0UUVJcmdFQUFBRGhBUWl6QVFBQW5nTGhBU0lZQXdBQV9RRUFJQXNBQVA0QkFDQU1BQURfQVFBZ0RRQUFnQUlBSUpjQkFBRDBBUUF3bUFFQUFNTUJBQkNaQVFBQTlBRUFNSm9CQVFEMUFRQWhtd0VCQVBVQkFDR2NBUUVBOVFFQUlaMEJBUUQyQVFBaG5nRUJBUFlCQUNHZkFRRUE5Z0VBSWFBQkFRRDJBUUFob2dFQUFQY0JvZ0VpcEFFQUFQZ0JwQUVpcGdFQUFQa0JwZ0VpcHdFZ0FQb0JBQ0dvQVNBQS1nRUFJYWtCQWdEN0FRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUllTUJBQUREQVFBZzVBRUFBTU1CQUNBQ3lRRUJBQUFBQWNvQkFRQUFBQUVNQndBQW9RSUFJQWdBQUtRQ0FDQ1hBUUFBb3dJQU1KZ0JBQUFTQUJDWkFRQUFvd0lBTUpvQkFRRDFBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJY0FCQWdEN0FRQWh5QUVCQVBVQkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaEdBVUFBTEFDQUNBR0FBQ2hBZ0FnQ3dBQV9nRUFJQXdBQVA4QkFDQ1hBUUFBclFJQU1KZ0JBQUFEQUJDWkFRQUFyUUlBTUpvQkFRRDFBUUFocEFFQUFLOEN3d0VpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBOVFFQUlid0JBUUQxQVFBaHZRRUJBUFVCQUNHLUFSQUFwZ0lBSWI4QkFnRDdBUUFod0FFSUFLNENBQ0hCQVFBQWhBSUFJTU1CQVFEMUFRQWh4QUVCQVBVQkFDSGpBUUFBQXdBZzVBRUFBQU1BSUJJSkFBQ3BBZ0FnbHdFQUFLVUNBRENZQVFBQURRQVFtUUVBQUtVQ0FEQ2FBUUVBOVFFQUlhUUJBQUNuQXRFQklxb0JRQUQ4QVFBaHF3RkFBUHdCQUNITEFRRUE5UUVBSWN3QkFRRDFBUUFoelFFQkFQWUJBQ0hPQVJBQXBnSUFJYzhCQVFEMUFRQWgwUUVCQVBZQkFDSFNBUUVBOWdFQUlkTUJBUUQyQVFBaDFBRUJBUFlCQUNIVkFVQUFxQUlBSVFpc0FSQUFBQUFCclFFUUFBQUFCSzRCRUFBQUFBU3ZBUkFBQUFBQnNBRVFBQUFBQWJFQkVBQUFBQUd5QVJBQUFBQUJzd0VRQUlvQ0FDRUVyQUVBQUFEUkFRS3RBUUFBQU5FQkNLNEJBQUFBMFFFSXN3RUFBSklDMFFFaUNLd0JRQUFBQUFHdEFVQUFBQUFGcmdGQUFBQUFCYThCUUFBQUFBR3dBVUFBQUFBQnNRRkFBQUFBQWJJQlFBQUFBQUd6QVVBQWtBSUFJUkVIQUFDaEFnQWdDQUFBcEFJQUlBb0FBS3dDQUNDWEFRQUFxZ0lBTUpnQkFBQUpBQkNaQVFBQXFnSUFNSm9CQVFEMUFRQWhwQUVBQUtzQzNRRWlxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNIWkFVQUFfQUVBSWRvQkFnRDdBUUFoMndFUUFLWUNBQ0hqQVFBQUNRQWc1QUVBQUFrQUlBOEhBQUNoQWdBZ0NBQUFwQUlBSUFvQUFLd0NBQ0NYQVFBQXFnSUFNSmdCQUFBSkFCQ1pBUUFBcWdJQU1Kb0JBUUQxQVFBaHBBRUFBS3NDM1FFaXFnRkFBUHdCQUNHckFVQUFfQUVBSWNrQkFRRDFBUUFoeWdFQkFQVUJBQ0haQVVBQV9BRUFJZG9CQWdEN0FRQWgyd0VRQUtZQ0FDRUVyQUVBQUFEZEFRS3RBUUFBQU4wQkNLNEJBQUFBM1FFSXN3RUFBSm9DM1FFaUE3Y0JBQUFOQUNDNEFRQUFEUUFndVFFQUFBMEFJQllGQUFDd0FnQWdCZ0FBb1FJQUlBc0FBUDRCQUNBTUFBRF9BUUFnbHdFQUFLMENBRENZQVFBQUF3QVFtUUVBQUswQ0FEQ2FBUUVBOVFFQUlhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0c4QVFFQTlRRUFJYjBCQVFEMUFRQWh2Z0VRQUtZQ0FDR19BUUlBLXdFQUljQUJDQUN1QWdBaHdRRUFBSVFDQUNEREFRRUE5UUVBSWNRQkFRRDFBUUFoQ0t3QkNBQUFBQUd0QVFnQUFBQUVyZ0VJQUFBQUJLOEJDQUFBQUFHd0FRZ0FBQUFCc1FFSUFBQUFBYklCQ0FBQUFBR3pBUWdBNWdFQUlRU3NBUUFBQU1NQkFxMEJBQUFBd3dFSXJnRUFBQUREQVFpekFRQUFod0xEQVNJTEF3QUFfUUVBSUpjQkFBQ1dBZ0F3bUFFQUFFOEFFSmtCQUFDV0FnQXdtZ0VCQVBVQkFDR2JBUUVBOVFFQUlhb0JRQUQ4QVFBaHF3RkFBUHdCQUNHN0FRRUE5UUVBSWVNQkFBQlBBQ0RrQVFBQVR3QWdBQUFBQUFBQUFlZ0JBUUFBQUFFQjZBRUJBQUFBQVFIb0FRQUFBS0lCQWdIb0FRQUFBS1FCQWdIb0FRQUFBS1lCQWdIb0FTQUFBQUFCQmVnQkFnQUFBQUh2QVFJQUFBQUI4QUVDQUFBQUFmRUJBZ0FBQUFIeUFRSUFBQUFCQWVnQlFBQUFBQUVMR3dBQV9nSUFNQndBQUlNREFERGxBUUFBX3dJQU1PWUJBQUNBQXdBdzV3RUFBSUVEQUNEb0FRQUFnZ01BTU9rQkFBQ0NBd0F3NmdFQUFJSURBRERyQVFBQWdnTUFNT3dCQUFDRUF3QXc3UUVBQUlVREFEQUxHd0FBM2dJQU1Cd0FBT01DQUREbEFRQUEzd0lBTU9ZQkFBRGdBZ0F3NXdFQUFPRUNBQ0RvQVFBQTRnSUFNT2tCQUFEaUFnQXc2Z0VBQU9JQ0FERHJBUUFBNGdJQU1Pd0JBQURrQWdBdzdRRUFBT1VDQURBTEd3QUEwQUlBTUJ3QUFOVUNBRERsQVFBQTBRSUFNT1lCQUFEU0FnQXc1d0VBQU5NQ0FDRG9BUUFBMUFJQU1Pa0JBQURVQWdBdzZnRUFBTlFDQUREckFRQUExQUlBTU93QkFBRFdBZ0F3N1FFQUFOY0NBREFMR3dBQXd3SUFNQndBQU1nQ0FERGxBUUFBeEFJQU1PWUJBQURGQWdBdzV3RUFBTVlDQUNEb0FRQUF4d0lBTU9rQkFBREhBZ0F3NmdFQUFNY0NBRERyQVFBQXh3SUFNT3dCQUFESkFnQXc3UUVBQU1vQ0FEQUttZ0VCQUFBQUFhUUJBQUFBNFFFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFIZEFRRUFBQUFCM2dFQkFBQUFBZDhCQVFBQUFBRUNBQUFBQVFBZ0d3QUF6d0lBSUFNQUFBQUJBQ0FiQUFEUEFnQWdIQUFBemdJQUlBRVVBQUNVQkFBd0R3NEFBS0VDQUNDWEFRQUFud0lBTUpnQkFBQWFBQkNaQVFBQW53SUFNSm9CQVFBQUFBR2tBUUFBb0FMaEFTS29BU0FBLWdFQUlhb0JRQUQ4QVFBaHF3RkFBUHdCQUNHNkFRRUE5UUVBSWJzQkFRQUFBQUhkQVFFQTlRRUFJZDRCQVFEMUFRQWgzd0VCQVBVQkFDSGhBUUVBOVFFQUlRSUFBQUFCQUNBVUFBRE9BZ0FnQWdBQUFNc0NBQ0FVQUFETUFnQWdEcGNCQUFES0FnQXdtQUVBQU1zQ0FCQ1pBUUFBeWdJQU1Kb0JBUUQxQVFBaHBBRUFBS0FDNFFFaXFBRWdBUG9CQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFodWdFQkFQVUJBQ0c3QVFFQTlRRUFJZDBCQVFEMUFRQWgzZ0VCQVBVQkFDSGZBUUVBOVFFQUllRUJBUUQxQVFBaERwY0JBQURLQWdBd21BRUFBTXNDQUJDWkFRQUF5Z0lBTUpvQkFRRDFBUUFocEFFQUFLQUM0UUVpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBOVFFQUlkMEJBUUQxQVFBaDNnRUJBUFVCQUNIZkFRRUE5UUVBSWVFQkFRRDFBUUFoQ3BvQkFRQzNBZ0FocEFFQUFNMEM0UUVpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlkMEJBUUMzQWdBaDNnRUJBTGNDQUNIZkFRRUF0d0lBSVFIb0FRQUFBT0VCQWdxYUFRRUF0d0lBSWFRQkFBRE5BdUVCSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDSGRBUUVBdHdJQUlkNEJBUUMzQWdBaDN3RUJBTGNDQUNFS21nRUJBQUFBQWFRQkFBQUE0UUVDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhkQVFFQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFFSENBQUEzUUlBSUpvQkFRQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFjQUJBZ0FBQUFISUFRRUFBQUFCeWdFQkFBQUFBUUlBQUFBVUFDQWJBQURjQWdBZ0F3QUFBQlFBSUJzQUFOd0NBQ0FjQUFEYUFnQWdBUlFBQUpNRUFEQU5Cd0FBb1FJQUlBZ0FBS1FDQUNDWEFRQUFvd0lBTUpnQkFBQVNBQkNaQVFBQW93SUFNSm9CQVFBQUFBR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHdBRUNBUHNCQUNISUFRRUE5UUVBSWNrQkFRRDFBUUFoeWdFQkFQVUJBQ0hpQVFBQW9nSUFJQUlBQUFBVUFDQVVBQURhQWdBZ0FnQUFBTmdDQUNBVUFBRFpBZ0FnQ3BjQkFBRFhBZ0F3bUFFQUFOZ0NBQkNaQVFBQTF3SUFNSm9CQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljQUJBZ0Q3QVFBaHlBRUJBUFVCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoQ3BjQkFBRFhBZ0F3bUFFQUFOZ0NBQkNaQVFBQTF3SUFNSm9CQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljQUJBZ0Q3QVFBaHlBRUJBUFVCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoQnBvQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJY0FCQWdDOUFnQWh5QUVCQUxjQ0FDSEtBUUVBdHdJQUlRY0lBQURiQWdBZ21nRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0Fod0FFQ0FMMENBQ0hJQVFFQXR3SUFJY29CQVFDM0FnQWhCUnNBQUk0RUFDQWNBQUNSQkFBZzVRRUFBSThFQUNEbUFRQUFrQVFBSU9zQkFBQUZBQ0FIQ0FBQTNRSUFJSm9CQVFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWNBQkFnQUFBQUhJQVFFQUFBQUJ5Z0VCQUFBQUFRTWJBQUNPQkFBZzVRRUFBSThFQUNEckFRQUFCUUFnQ2dnQUFQd0NBQ0FLQUFEOUFnQWdtZ0VCQUFBQUFhUUJBQUFBM1FFQ3FnRkFBQUFBQWFzQlFBQUFBQUhLQVFFQUFBQUIyUUZBQUFBQUFkb0JBZ0FBQUFIYkFSQUFBQUFCQWdBQUFBc0FJQnNBQVBzQ0FDQURBQUFBQ3dBZ0d3QUEtd0lBSUJ3QUFPb0NBQ0FCRkFBQWpRUUFNQThIQUFDaEFnQWdDQUFBcEFJQUlBb0FBS3dDQUNDWEFRQUFxZ0lBTUpnQkFBQUpBQkNaQVFBQXFnSUFNSm9CQVFBQUFBR2tBUUFBcXdMZEFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHlRRUJBUFVCQUNIS0FRRUE5UUVBSWRrQlFBRDhBUUFoMmdFQ0FQc0JBQ0hiQVJBQXBnSUFJUUlBQUFBTEFDQVVBQURxQWdBZ0FnQUFBT1lDQUNBVUFBRG5BZ0FnREpjQkFBRGxBZ0F3bUFFQUFPWUNBQkNaQVFBQTVRSUFNSm9CQVFEMUFRQWhwQUVBQUtzQzNRRWlxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNIWkFVQUFfQUVBSWRvQkFnRDdBUUFoMndFUUFLWUNBQ0VNbHdFQUFPVUNBRENZQVFBQTVnSUFFSmtCQUFEbEFnQXdtZ0VCQVBVQkFDR2tBUUFBcXdMZEFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHlRRUJBUFVCQUNIS0FRRUE5UUVBSWRrQlFBRDhBUUFoMmdFQ0FQc0JBQ0hiQVJBQXBnSUFJUWlhQVFFQXR3SUFJYVFCQUFEcEF0MEJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSEtBUUVBdHdJQUlka0JRQUMtQWdBaDJnRUNBTDBDQUNIYkFSQUE2QUlBSVFYb0FSQUFBQUFCN3dFUUFBQUFBZkFCRUFBQUFBSHhBUkFBQUFBQjhnRVFBQUFBQVFIb0FRQUFBTjBCQWdvSUFBRHJBZ0FnQ2dBQTdBSUFJSm9CQVFDM0FnQWhwQUVBQU9rQzNRRWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljb0JBUUMzQWdBaDJRRkFBTDRDQUNIYUFRSUF2UUlBSWRzQkVBRG9BZ0FoQlJzQUFJY0VBQ0FjQUFDTEJBQWc1UUVBQUlnRUFDRG1BUUFBaWdRQUlPc0JBQUFGQUNBTEd3QUE3UUlBTUJ3QUFQSUNBRERsQVFBQTdnSUFNT1lCQUFEdkFnQXc1d0VBQVBBQ0FDRG9BUUFBOFFJQU1Pa0JBQUR4QWdBdzZnRUFBUEVDQUREckFRQUE4UUlBTU93QkFBRHpBZ0F3N1FFQUFQUUNBREFObWdFQkFBQUFBYVFCQUFBQTBRRUNxZ0ZBQUFBQUFhc0JRQUFBQUFITUFRRUFBQUFCelFFQkFBQUFBYzRCRUFBQUFBSFBBUUVBQUFBQjBRRUJBQUFBQWRJQkFRQUFBQUhUQVFFQUFBQUIxQUVCQUFBQUFkVUJRQUFBQUFFQ0FBQUFEd0FnR3dBQS1nSUFJQU1BQUFBUEFDQWJBQUQ2QWdBZ0hBQUEtUUlBSUFFVUFBQ0pCQUF3RWdrQUFLa0NBQ0NYQVFBQXBRSUFNSmdCQUFBTkFCQ1pBUUFBcFFJQU1Kb0JBUUFBQUFHa0FRQUFwd0xSQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeXdFQkFQVUJBQ0hNQVFFQUFBQUJ6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJUUlBQUFBUEFDQVVBQUQ1QWdBZ0FnQUFBUFVDQUNBVUFBRDJBZ0FnRVpjQkFBRDBBZ0F3bUFFQUFQVUNBQkNaQVFBQTlBSUFNSm9CQVFEMUFRQWhwQUVBQUtjQzBRRWlxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljc0JBUUQxQVFBaHpBRUJBUFVCQUNITkFRRUE5Z0VBSWM0QkVBQ21BZ0FoendFQkFQVUJBQ0hSQVFFQTlnRUFJZElCQVFEMkFRQWgwd0VCQVBZQkFDSFVBUUVBOWdFQUlkVUJRQUNvQWdBaEVaY0JBQUQwQWdBd21BRUFBUFVDQUJDWkFRQUE5QUlBTUpvQkFRRDFBUUFocEFFQUFLY0MwUUVpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY3NCQVFEMUFRQWh6QUVCQVBVQkFDSE5BUUVBOWdFQUljNEJFQUNtQWdBaHp3RUJBUFVCQUNIUkFRRUE5Z0VBSWRJQkFRRDJBUUFoMHdFQkFQWUJBQ0hVQVFFQTlnRUFJZFVCUUFDb0FnQWhEWm9CQVFDM0FnQWhwQUVBQVBjQzBRRWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljd0JBUUMzQWdBaHpRRUJBTGdDQUNIT0FSQUE2QUlBSWM4QkFRQzNBZ0FoMFFFQkFMZ0NBQ0hTQVFFQXVBSUFJZE1CQVFDNEFnQWgxQUVCQUxnQ0FDSFZBVUFBLUFJQUlRSG9BUUFBQU5FQkFnSG9BVUFBQUFBQkRab0JBUUMzQWdBaHBBRUFBUGNDMFFFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWN3QkFRQzNBZ0FoelFFQkFMZ0NBQ0hPQVJBQTZBSUFJYzhCQVFDM0FnQWgwUUVCQUxnQ0FDSFNBUUVBdUFJQUlkTUJBUUM0QWdBaDFBRUJBTGdDQUNIVkFVQUEtQUlBSVEyYUFRRUFBQUFCcEFFQUFBRFJBUUtxQVVBQUFBQUJxd0ZBQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFUUFBQUFBYzhCQVFBQUFBSFJBUUVBQUFBQjBnRUJBQUFBQWRNQkFRQUFBQUhVQVFFQUFBQUIxUUZBQUFBQUFRb0lBQUQ4QWdBZ0NnQUFfUUlBSUpvQkFRQUFBQUdrQVFBQUFOMEJBcW9CUUFBQUFBR3JBVUFBQUFBQnlnRUJBQUFBQWRrQlFBQUFBQUhhQVFJQUFBQUIyd0VRQUFBQUFRTWJBQUNIQkFBZzVRRUFBSWdFQUNEckFRQUFCUUFnQkJzQUFPMENBRERsQVFBQTdnSUFNT2NCQUFEd0FnQWc2d0VBQVBFQ0FEQVJCUUFBcHdNQUlBc0FBS2dEQUNBTUFBQ3BBd0FnbWdFQkFBQUFBYVFCQUFBQXd3RUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBRzhBUUVBQUFBQnZRRUJBQUFBQWI0QkVBQUFBQUdfQVFJQUFBQUJ3QUVJQUFBQUFjRUJBQUNtQXdBZ3d3RUJBQUFBQVFJQUFBQUZBQ0FiQUFDbEF3QWdBd0FBQUFVQUlCc0FBS1VEQUNBY0FBQ0xBd0FnQVJRQUFJWUVBREFXQlFBQXNBSUFJQVlBQUtFQ0FDQUxBQUQtQVFBZ0RBQUFfd0VBSUpjQkFBQ3RBZ0F3bUFFQUFBTUFFSmtCQUFDdEFnQXdtZ0VCQUFBQUFhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFBQUFBYndCQVFEMUFRQWh2UUVCQVBVQkFDRy1BUkFBcGdJQUliOEJBZ0Q3QVFBaHdBRUlBSzRDQUNIQkFRQUFoQUlBSU1NQkFRRDFBUUFoeEFFQkFQVUJBQ0VDQUFBQUJRQWdGQUFBaXdNQUlBSUFBQUNHQXdBZ0ZBQUFod01BSUJLWEFRQUFoUU1BTUpnQkFBQ0dBd0FRbVFFQUFJVURBRENhQVFFQTlRRUFJYVFCQUFDdkFzTUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNHOEFRRUE5UUVBSWIwQkFRRDFBUUFodmdFUUFLWUNBQ0dfQVFJQS13RUFJY0FCQ0FDdUFnQWh3UUVBQUlRQ0FDRERBUUVBOVFFQUljUUJBUUQxQVFBaEVwY0JBQUNGQXdBd21BRUFBSVlEQUJDWkFRQUFoUU1BTUpvQkFRRDFBUUFocEFFQUFLOEN3d0VpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBOVFFQUlid0JBUUQxQVFBaHZRRUJBUFVCQUNHLUFSQUFwZ0lBSWI4QkFnRDdBUUFod0FFSUFLNENBQ0hCQVFBQWhBSUFJTU1CQVFEMUFRQWh4QUVCQVBVQkFDRU9tZ0VCQUxjQ0FDR2tBUUFBaWdQREFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FodkFFQkFMY0NBQ0c5QVFFQXR3SUFJYjRCRUFEb0FnQWh2d0VDQUwwQ0FDSEFBUWdBaUFNQUljRUJBQUNKQXdBZ3d3RUJBTGNDQUNFRjZBRUlBQUFBQWU4QkNBQUFBQUh3QVFnQUFBQUI4UUVJQUFBQUFmSUJDQUFBQUFFQzZBRUJBQUFBQk80QkFRQUFBQVVCNkFFQUFBRERBUUlSQlFBQWpBTUFJQXNBQUkwREFDQU1BQUNPQXdBZ21nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0Fnd3dFQkFMY0NBQ0VGR3dBQTlRTUFJQndBQUlRRUFDRGxBUUFBOWdNQUlPWUJBQUNEQkFBZzZ3RUFBRXdBSUFzYkFBQ2FBd0F3SEFBQW5nTUFNT1VCQUFDYkF3QXc1Z0VBQUp3REFERG5BUUFBblFNQUlPZ0JBQURpQWdBdzZRRUFBT0lDQUREcUFRQUE0Z0lBTU9zQkFBRGlBZ0F3N0FFQUFKOERBRER0QVFBQTVRSUFNQXNiQUFDUEF3QXdIQUFBa3dNQU1PVUJBQUNRQXdBdzVnRUFBSkVEQUREbkFRQUFrZ01BSU9nQkFBRFVBZ0F3NlFFQUFOUUNBRERxQVFBQTFBSUFNT3NCQUFEVUFnQXc3QUVBQUpRREFERHRBUUFBMXdJQU1BY0hBQUNaQXdBZ21nRUJBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ3QUVDQUFBQUFjZ0JBUUFBQUFISkFRRUFBQUFCQWdBQUFCUUFJQnNBQUpnREFDQURBQUFBRkFBZ0d3QUFtQU1BSUJ3QUFKWURBQ0FCRkFBQWdnUUFNQUlBQUFBVUFDQVVBQUNXQXdBZ0FnQUFBTmdDQUNBVUFBQ1ZBd0FnQnBvQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJY0FCQWdDOUFnQWh5QUVCQUxjQ0FDSEpBUUVBdHdJQUlRY0hBQUNYQXdBZ21nRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0Fod0FFQ0FMMENBQ0hJQVFFQXR3SUFJY2tCQVFDM0FnQWhCUnNBQVAwREFDQWNBQUNBQkFBZzVRRUFBUDREQUNEbUFRQUFfd01BSU9zQkFBREFBUUFnQndjQUFKa0RBQ0NhQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFIQUFRSUFBQUFCeUFFQkFBQUFBY2tCQVFBQUFBRURHd0FBX1FNQUlPVUJBQUQtQXdBZzZ3RUFBTUFCQUNBS0J3QUFwQU1BSUFvQUFQMENBQ0NhQVFFQUFBQUJwQUVBQUFEZEFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhaQVVBQUFBQUIyZ0VDQUFBQUFkc0JFQUFBQUFFQ0FBQUFDd0FnR3dBQW93TUFJQU1BQUFBTEFDQWJBQUNqQXdBZ0hBQUFvUU1BSUFFVUFBRDhBd0F3QWdBQUFBc0FJQlFBQUtFREFDQUNBQUFBNWdJQUlCUUFBS0FEQUNBSW1nRUJBTGNDQUNHa0FRQUE2UUxkQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeVFFQkFMY0NBQ0haQVVBQXZnSUFJZG9CQWdDOUFnQWgyd0VRQU9nQ0FDRUtCd0FBb2dNQUlBb0FBT3dDQUNDYUFRRUF0d0lBSWFRQkFBRHBBdDBCSXFvQlFBQy1BZ0FocXdGQUFMNENBQ0hKQVFFQXR3SUFJZGtCUUFDLUFnQWgyZ0VDQUwwQ0FDSGJBUkFBNkFJQUlRVWJBQUQzQXdBZ0hBQUEtZ01BSU9VQkFBRDRBd0FnNWdFQUFQa0RBQ0RyQVFBQXdBRUFJQW9IQUFDa0F3QWdDZ0FBX1FJQUlKb0JBUUFBQUFHa0FRQUFBTjBCQXFvQlFBQUFBQUdyQVVBQUFBQUJ5UUVCQUFBQUFka0JRQUFBQUFIYUFRSUFBQUFCMndFUUFBQUFBUU1iQUFEM0F3QWc1UUVBQVBnREFDRHJBUUFBd0FFQUlCRUZBQUNuQXdBZ0N3QUFxQU1BSUF3QUFLa0RBQ0NhQVFFQUFBQUJwQUVBQUFEREFRS29BU0FBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc2QVFFQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFUUFBQUFBYjhCQWdBQUFBSEFBUWdBQUFBQndRRUFBS1lEQUNEREFRRUFBQUFCQWVnQkFRQUFBQVFER3dBQTlRTUFJT1VCQUFEMkF3QWc2d0VBQUV3QUlBUWJBQUNhQXdBdzVRRUFBSnNEQUREbkFRQUFuUU1BSU9zQkFBRGlBZ0F3QkJzQUFJOERBRERsQVFBQWtBTUFNT2NCQUFDU0F3QWc2d0VBQU5RQ0FEQUVHd0FBX2dJQU1PVUJBQURfQWdBdzV3RUFBSUVEQUNEckFRQUFnZ01BTUFRYkFBRGVBZ0F3NVFFQUFOOENBRERuQVFBQTRRSUFJT3NCQUFEaUFnQXdCQnNBQU5BQ0FERGxBUUFBMFFJQU1PY0JBQURUQWdBZzZ3RUFBTlFDQURBRUd3QUF3d0lBTU9VQkFBREVBZ0F3NXdFQUFNWUNBQ0RyQVFBQXh3SUFNQUFBQUFBQUFBQUFBQVViQUFEd0F3QWdIQUFBOHdNQUlPVUJBQUR4QXdBZzVnRUFBUElEQUNEckFRQUF3QUVBSUFNYkFBRHdBd0FnNVFFQUFQRURBQ0RyQVFBQXdBRUFJQUFBQUFBQUFBQUFBQUFGR3dBQTZ3TUFJQndBQU80REFDRGxBUUFBN0FNQUlPWUJBQUR0QXdBZzZ3RUFBQXNBSUFNYkFBRHJBd0FnNVFFQUFPd0RBQ0RyQVFBQUN3QWdBQUFBQUFBQUN4c0FBTXdEQURBY0FBRFFBd0F3NVFFQUFNMERBRERtQVFBQXpnTUFNT2NCQUFEUEF3QWc2QUVBQUlJREFERHBBUUFBZ2dNQU1Pb0JBQUNDQXdBdzZ3RUFBSUlEQUREc0FRQUEwUU1BTU8wQkFBQ0ZBd0F3RVFZQUFMZ0RBQ0FMQUFDb0F3QWdEQUFBcVFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTVFCQVFBQUFBRUNBQUFBQlFBZ0d3QUExQU1BSUFNQUFBQUZBQ0FiQUFEVUF3QWdIQUFBMHdNQUlBRVVBQURxQXdBd0FnQUFBQVVBSUJRQUFOTURBQ0FDQUFBQWhnTUFJQlFBQU5JREFDQU9tZ0VCQUxjQ0FDR2tBUUFBaWdQREFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FodkFFQkFMY0NBQ0c5QVFFQXR3SUFJYjRCRUFEb0FnQWh2d0VDQUwwQ0FDSEFBUWdBaUFNQUljRUJBQUNKQXdBZ3hBRUJBTGNDQUNFUkJnQUF0d01BSUFzQUFJMERBQ0FNQUFDT0F3QWdtZ0VCQUxjQ0FDR2tBUUFBaWdQREFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FodkFFQkFMY0NBQ0c5QVFFQXR3SUFJYjRCRUFEb0FnQWh2d0VDQUwwQ0FDSEFBUWdBaUFNQUljRUJBQUNKQXdBZ3hBRUJBTGNDQUNFUkJnQUF1QU1BSUFzQUFLZ0RBQ0FNQUFDcEF3QWdtZ0VCQUFBQUFhUUJBQUFBd3dFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCRUFBQUFBR19BUUlBQUFBQndBRUlBQUFBQWNFQkFBQ21Bd0FneEFFQkFBQUFBUVFiQUFETUF3QXc1UUVBQU0wREFERG5BUUFBendNQUlPc0JBQUNDQXdBd0FBQUFBQUFBQUFBRkd3QUE1UU1BSUJ3QUFPZ0RBQ0RsQVFBQTVnTUFJT1lCQUFEbkF3QWc2d0VBQU1BQkFDQURHd0FBNVFNQUlPVUJBQURtQXdBZzZ3RUFBTUFCQUNBSUF3QUFyZ01BSUFzQUFLOERBQ0FNQUFDd0F3QWdEUUFBc1FNQUlKMEJBQUN4QWdBZ25nRUFBTEVDQUNDZkFRQUFzUUlBSUtBQkFBQ3hBZ0FnQkFVQUFPUURBQ0FHQUFEZ0F3QWdDd0FBcndNQUlBd0FBTEFEQUNBREJ3QUE0QU1BSUFnQUFPRURBQ0FLQUFEakF3QWdBQUVEQUFDdUF3QWdFZ01BQUtvREFDQUxBQUNyQXdBZ0RBQUFyQU1BSUpvQkFRQUFBQUdiQVFFQUFBQUJuQUVCQUFBQUFaMEJBUUFBQUFHZUFRRUFBQUFCbndFQkFBQUFBYUFCQVFBQUFBR2lBUUFBQUtJQkFxUUJBQUFBcEFFQ3BnRUFBQUNtQVFLbkFTQUFBQUFCcUFFZ0FBQUFBYWtCQWdBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQVFJQUFBREFBUUFnR3dBQTVRTUFJQU1BQUFEREFRQWdHd0FBNVFNQUlCd0FBT2tEQUNBVUFBQUF3d0VBSUFNQUFMOENBQ0FMQUFEQUFnQWdEQUFBd1FJQUlCUUFBT2tEQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dkQVFFQXVBSUFJWjRCQVFDNEFnQWhud0VCQUxnQ0FDR2dBUUVBdUFJQUlhSUJBQUM1QXFJQklxUUJBQUM2QXFRQklxWUJBQUM3QXFZQklxY0JJQUM4QWdBaHFBRWdBTHdDQUNHcEFRSUF2UUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0VTQXdBQXZ3SUFJQXNBQU1BQ0FDQU1BQURCQWdBZ21nRUJBTGNDQUNHYkFRRUF0d0lBSVp3QkFRQzNBZ0FoblFFQkFMZ0NBQ0dlQVFFQXVBSUFJWjhCQVFDNEFnQWhvQUVCQUxnQ0FDR2lBUUFBdVFLaUFTS2tBUUFBdWdLa0FTS21BUUFBdXdLbUFTS25BU0FBdkFJQUlhZ0JJQUM4QWdBaHFRRUNBTDBDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoRHBvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNUUJBUUFBQUFFTEJ3QUFwQU1BSUFnQUFQd0NBQ0NhQVFFQUFBQUJwQUVBQUFEZEFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhLQVFFQUFBQUIyUUZBQUFBQUFkb0JBZ0FBQUFIYkFSQUFBQUFCQWdBQUFBc0FJQnNBQU9zREFDQURBQUFBQ1FBZ0d3QUE2d01BSUJ3QUFPOERBQ0FOQUFBQUNRQWdCd0FBb2dNQUlBZ0FBT3NDQUNBVUFBRHZBd0FnbWdFQkFMY0NBQ0drQVFBQTZRTGRBU0txQVVBQXZnSUFJYXNCUUFDLUFnQWh5UUVCQUxjQ0FDSEtBUUVBdHdJQUlka0JRQUMtQWdBaDJnRUNBTDBDQUNIYkFSQUE2QUlBSVFzSEFBQ2lBd0FnQ0FBQTZ3SUFJSm9CQVFDM0FnQWhwQUVBQU9rQzNRRWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlja0JBUUMzQWdBaHlnRUJBTGNDQUNIWkFVQUF2Z0lBSWRvQkFnQzlBZ0FoMndFUUFPZ0NBQ0VTQ3dBQXF3TUFJQXdBQUt3REFDQU5BQUN0QXdBZ21nRUJBQUFBQVpzQkFRQUFBQUdjQVFFQUFBQUJuUUVCQUFBQUFaNEJBUUFBQUFHZkFRRUFBQUFCb0FFQkFBQUFBYUlCQUFBQW9nRUNwQUVBQUFDa0FRS21BUUFBQUtZQkFxY0JJQUFBQUFHb0FTQUFBQUFCcVFFQ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQkFnQUFBTUFCQUNBYkFBRHdBd0FnQXdBQUFNTUJBQ0FiQUFEd0F3QWdIQUFBOUFNQUlCUUFBQUREQVFBZ0N3QUF3QUlBSUF3QUFNRUNBQ0FOQUFEQ0FnQWdGQUFBOUFNQUlKb0JBUUMzQWdBaG13RUJBTGNDQUNHY0FRRUF0d0lBSVowQkFRQzRBZ0FobmdFQkFMZ0NBQ0dmQVFFQXVBSUFJYUFCQVFDNEFnQWhvZ0VBQUxrQ29nRWlwQUVBQUxvQ3BBRWlwZ0VBQUxzQ3BnRWlwd0VnQUx3Q0FDR29BU0FBdkFJQUlha0JBZ0M5QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSVJJTEFBREFBZ0FnREFBQXdRSUFJQTBBQU1JQ0FDQ2FBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHZEFRRUF1QUlBSVo0QkFRQzRBZ0FobndFQkFMZ0NBQ0dnQVFFQXVBSUFJYUlCQUFDNUFxSUJJcVFCQUFDNkFxUUJJcVlCQUFDN0FxWUJJcWNCSUFDOEFnQWhxQUVnQUx3Q0FDR3BBUUlBdlFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNFRm1nRUJBQUFBQVpzQkFRQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFic0JBUUFBQUFFQ0FBQUFUQUFnR3dBQTlRTUFJQklEQUFDcUF3QWdEQUFBckFNQUlBMEFBSzBEQUNDYUFRRUFBQUFCbXdFQkFBQUFBWndCQVFBQUFBR2RBUUVBQUFBQm5nRUJBQUFBQVo4QkFRQUFBQUdnQVFFQUFBQUJvZ0VBQUFDaUFRS2tBUUFBQUtRQkFxWUJBQUFBcGdFQ3B3RWdBQUFBQWFnQklBQUFBQUdwQVFJQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFFQ0FBQUF3QUVBSUJzQUFQY0RBQ0FEQUFBQXd3RUFJQnNBQVBjREFDQWNBQUQ3QXdBZ0ZBQUFBTU1CQUNBREFBQ19BZ0FnREFBQXdRSUFJQTBBQU1JQ0FDQVVBQUQ3QXdBZ21nRUJBTGNDQUNHYkFRRUF0d0lBSVp3QkFRQzNBZ0FoblFFQkFMZ0NBQ0dlQVFFQXVBSUFJWjhCQVFDNEFnQWhvQUVCQUxnQ0FDR2lBUUFBdVFLaUFTS2tBUUFBdWdLa0FTS21BUUFBdXdLbUFTS25BU0FBdkFJQUlhZ0JJQUM4QWdBaHFRRUNBTDBDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoRWdNQUFMOENBQ0FNQUFEQkFnQWdEUUFBd2dJQUlKb0JBUUMzQWdBaG13RUJBTGNDQUNHY0FRRUF0d0lBSVowQkFRQzRBZ0FobmdFQkFMZ0NBQ0dmQVFFQXVBSUFJYUFCQVFDNEFnQWhvZ0VBQUxrQ29nRWlwQUVBQUxvQ3BBRWlwZ0VBQUxzQ3BnRWlwd0VnQUx3Q0FDR29BU0FBdkFJQUlha0JBZ0M5QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSVFpYUFRRUFBQUFCcEFFQUFBRGRBUUtxQVVBQUFBQUJxd0ZBQUFBQUFja0JBUUFBQUFIWkFVQUFBQUFCMmdFQ0FBQUFBZHNCRUFBQUFBRVNBd0FBcWdNQUlBc0FBS3NEQUNBTkFBQ3RBd0FnbWdFQkFBQUFBWnNCQVFBQUFBR2NBUUVBQUFBQm5RRUJBQUFBQVo0QkFRQUFBQUdmQVFFQUFBQUJvQUVCQUFBQUFhSUJBQUFBb2dFQ3BBRUFBQUNrQVFLbUFRQUFBS1lCQXFjQklBQUFBQUdvQVNBQUFBQUJxUUVDQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCQWdBQUFNQUJBQ0FiQUFEOUF3QWdBd0FBQU1NQkFDQWJBQUQ5QXdBZ0hBQUFnUVFBSUJRQUFBRERBUUFnQXdBQXZ3SUFJQXNBQU1BQ0FDQU5BQURDQWdBZ0ZBQUFnUVFBSUpvQkFRQzNBZ0FobXdFQkFMY0NBQ0djQVFFQXR3SUFJWjBCQVFDNEFnQWhuZ0VCQUxnQ0FDR2ZBUUVBdUFJQUlhQUJBUUM0QWdBaG9nRUFBTGtDb2dFaXBBRUFBTG9DcEFFaXBnRUFBTHNDcGdFaXB3RWdBTHdDQUNHb0FTQUF2QUlBSWFrQkFnQzlBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJUklEQUFDX0FnQWdDd0FBd0FJQUlBMEFBTUlDQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dkQVFFQXVBSUFJWjRCQVFDNEFnQWhud0VCQUxnQ0FDR2dBUUVBdUFJQUlhSUJBQUM1QXFJQklxUUJBQUM2QXFRQklxWUJBQUM3QXFZQklxY0JJQUM4QWdBaHFBRWdBTHdDQUNHcEFRSUF2UUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0VHbWdFQkFBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQndBRUNBQUFBQWNnQkFRQUFBQUhKQVFFQUFBQUJBd0FBQUU4QUlCc0FBUFVEQUNBY0FBQ0ZCQUFnQndBQUFFOEFJQlFBQUlVRUFDQ2FBUUVBdHdJQUlac0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJzQkFRQzNBZ0FoQlpvQkFRQzNBZ0FobXdFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1d0VCQUxjQ0FDRU9tZ0VCQUFBQUFhUUJBQUFBd3dFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCRUFBQUFBR19BUUlBQUFBQndBRUlBQUFBQWNFQkFBQ21Bd0Fnd3dFQkFBQUFBUklGQUFDbkF3QWdCZ0FBdUFNQUlBd0FBS2tEQUNDYUFRRUFBQUFCcEFFQUFBRERBUUtvQVNBQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFHNkFRRUFBQUFCdXdFQkFBQUFBYndCQVFBQUFBRzlBUUVBQUFBQnZnRVFBQUFBQWI4QkFnQUFBQUhBQVFnQUFBQUJ3UUVBQUtZREFDRERBUUVBQUFBQnhBRUJBQUFBQVFJQUFBQUZBQ0FiQUFDSEJBQWdEWm9CQVFBQUFBR2tBUUFBQU5FQkFxb0JRQUFBQUFHckFVQUFBQUFCekFFQkFBQUFBYzBCQVFBQUFBSE9BUkFBQUFBQnp3RUJBQUFBQWRFQkFRQUFBQUhTQVFFQUFBQUIwd0VCQUFBQUFkUUJBUUFBQUFIVkFVQUFBQUFCQXdBQUFBTUFJQnNBQUljRUFDQWNBQUNNQkFBZ0ZBQUFBQU1BSUFVQUFJd0RBQ0FHQUFDM0F3QWdEQUFBamdNQUlCUUFBSXdFQUNDYUFRRUF0d0lBSWFRQkFBQ0tBOE1CSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDRzhBUUVBdHdJQUliMEJBUUMzQWdBaHZnRVFBT2dDQUNHX0FRSUF2UUlBSWNBQkNBQ0lBd0Fod1FFQUFJa0RBQ0REQVFFQXR3SUFJY1FCQVFDM0FnQWhFZ1VBQUl3REFDQUdBQUMzQXdBZ0RBQUFqZ01BSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRUltZ0VCQUFBQUFhUUJBQUFBM1FFQ3FnRkFBQUFBQWFzQlFBQUFBQUhLQVFFQUFBQUIyUUZBQUFBQUFkb0JBZ0FBQUFIYkFSQUFBQUFCRWdVQUFLY0RBQ0FHQUFDNEF3QWdDd0FBcUFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFnQUFBQVVBSUJzQUFJNEVBQ0FEQUFBQUF3QWdHd0FBamdRQUlCd0FBSklFQUNBVUFBQUFBd0FnQlFBQWpBTUFJQVlBQUxjREFDQUxBQUNOQXdBZ0ZBQUFrZ1FBSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRVNCUUFBakFNQUlBWUFBTGNEQUNBTEFBQ05Bd0FnbWdFQkFMY0NBQ0drQVFBQWlnUERBU0tvQVNBQXZBSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzZBUUVBdHdJQUlic0JBUUMzQWdBaHZBRUJBTGNDQUNHOUFRRUF0d0lBSWI0QkVBRG9BZ0FodndFQ0FMMENBQ0hBQVFnQWlBTUFJY0VCQUFDSkF3QWd3d0VCQUxjQ0FDSEVBUUVBdHdJQUlRYWFBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFjb0JBUUFBQUFFS21nRUJBQUFBQWFRQkFBQUE0UUVDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhkQVFFQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFFQkRnQUNCUU1HQXdRQUN3c1lCZ3daQ1EwY0FRVUVBQW9GQUFRR0FBSUxEQVlNRlFrQ0F3Y0RCQUFGQVFNSUFBUUVBQWdIQUFJSUFBTUtFQWNCQ1FBR0FRb1JBQUlIQUFJSUFBTUNDeFlBREJjQUJBTWRBQXNlQUF3ZkFBMGdBQUFCRGdBQ0FRNEFBZ01FQUJBaEFCRWlBQklBQUFBREJBQVFJUUFSSWdBU0FnY0FBZ2dBQXdJSEFBSUlBQU1GQkFBWElRQWFJZ0FiTXdBWU5BQVpBQUFBQUFBRkJBQVhJUUFhSWdBYk13QVlOQUFaQUFBREJBQWdJUUFoSWdBaUFBQUFBd1FBSUNFQUlTSUFJZ0FBQUFNRUFDZ2hBQ2tpQUNvQUFBQURCQUFvSVFBcElnQXFBUWtBQmdFSkFBWUZCQUF2SVFBeUlnQXpNd0F3TkFBeEFBQUFBQUFGQkFBdklRQXlJZ0F6TXdBd05BQXhBZ2NBQWdnQUF3SUhBQUlJQUFNRkJBQTRJUUE3SWdBOE13QTVOQUE2QUFBQUFBQUZCQUE0SVFBN0lnQThNd0E1TkFBNkFnVUFCQVlBQWdJRkFBUUdBQUlGQkFCQklRQkVJZ0JGTXdCQ05BQkRBQUFBQUFBRkJBQkJJUUJFSWdCRk13QkNOQUJEQUFBRkJBQktJUUJOSWdCT013QkxOQUJNQUFBQUFBQUZCQUJLSVFCTklnQk9Nd0JMTkFCTUR3SUJFQ0VCRVNJQkVpTUJFeVFCRlNZQkZpZ01GeWtOR0NzQkdTME1HaTRPSFM4QkhqQUJIekVNSXpRUEpEVVRKVFlHSmpjR0p6Z0dLRGtHS1RvR0tqd0dLejRNTEQ4VUxVRUdMa01NTDBRVk1FVUdNVVlHTWtjTU5Vb1dOa3NjTjAwRU9FNEVPVkVFT2xJRU8xTUVQRlVFUFZjTVBsZ2RQMW9FUUZ3TVFWMGVRbDRFUTE4RVJHQU1SV01mUm1RalIyWWtTR2NrU1dva1Ntc2tTMndrVEc0a1RYQU1UbkVsVDNNa1VIVU1VWFltVW5ja1UzZ2tWSGtNVlh3blZuMHJWMzRIV0g4SFdZQUJCMXFCQVFkYmdnRUhYSVFCQjEyR0FReGVod0VzWDRrQkIyQ0xBUXhoakFFdFlvMEJCMk9PQVFka2p3RU1aWklCTG1hVEFUUm5sQUVKYUpVQkNXbVdBUWxxbHdFSmE1Z0JDV3lhQVFsdG5BRU1icDBCTlctZkFRbHdvUUVNY2FJQk5uS2pBUWx6cEFFSmRLVUJESFdvQVRkMnFRRTlkNm9CQTNpckFRTjVyQUVEZXEwQkEzdXVBUU44c0FFRGZiSUJESDZ6QVQ1X3RRRURnQUczQVF5QkFiZ0JQNElCdVFFRGd3RzZBUU9FQWJzQkRJVUJ2Z0ZBaGdHX0FVYUhBY0VCQW9nQndnRUNpUUhGQVFLS0FjWUJBb3NCeHdFQ2pBSEpBUUtOQWNzQkRJNEJ6QUZIandIT0FRS1FBZEFCREpFQjBRRklrZ0hTQVFLVEFkTUJBcFFCMUFFTWxRSFhBVW1XQWRnQlR3XCJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVjb2RlQmFzZTY0QXNXYXNtKHdhc21CYXNlNjQ6IHN0cmluZyk6IFByb21pc2U8V2ViQXNzZW1ibHkuTW9kdWxlPiB7XG4gIGNvbnN0IHsgQnVmZmVyIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6YnVmZmVyJylcbiAgY29uc3Qgd2FzbUFycmF5ID0gQnVmZmVyLmZyb20od2FzbUJhc2U2NCwgJ2Jhc2U2NCcpXG4gIHJldHVybiBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKHdhc21BcnJheSlcbn1cblxuY29uZmlnLmNvbXBpbGVyV2FzbSA9IHtcbiAgZ2V0UnVudGltZTogYXN5bmMgKCkgPT4gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwubWpzXCIpLFxuXG4gIGdldFF1ZXJ5Q29tcGlsZXJXYXNtTW9kdWxlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyB3YXNtIH0gPSBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC53YXNtLWJhc2U2NC5tanNcIilcbiAgICByZXR1cm4gYXdhaXQgZGVjb2RlQmFzZTY0QXNXYXNtKHdhc20pXG4gIH0sXG5cbiAgaW1wb3J0TmFtZTogXCIuL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcuanNcIlxufVxuXG5cblxuZXhwb3J0IHR5cGUgTG9nT3B0aW9uczxDbGllbnRPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgJ2xvZycgZXh0ZW5kcyBrZXlvZiBDbGllbnRPcHRpb25zID8gQ2xpZW50T3B0aW9uc1snbG9nJ10gZXh0ZW5kcyBBcnJheTxQcmlzbWEuTG9nTGV2ZWwgfCBQcmlzbWEuTG9nRGVmaW5pdGlvbj4gPyBQcmlzbWEuR2V0RXZlbnRzPENsaWVudE9wdGlvbnNbJ2xvZyddPiA6IG5ldmVyIDogbmV2ZXJcblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gICAgLyoqXG4gICAqICMjIFByaXNtYSBDbGllbnRcbiAgICogXG4gICAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiB9KVxuICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAgICovXG5cbiAgbmV3IDxcbiAgICBPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyxcbiAgICBMb2dPcHRzIGV4dGVuZHMgTG9nT3B0aW9uczxPcHRpb25zPiA9IExvZ09wdGlvbnM8T3B0aW9ucz4sXG4gICAgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gT3B0aW9ucyBleHRlbmRzIHsgb21pdDogaW5mZXIgVSB9ID8gVSA6IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gICAgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3NcbiAgPihvcHRpb25zOiBQcmlzbWEuUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnM+KTogUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxufVxuXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudDxcbiAgaW4gTG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLFxuICBpbiBvdXQgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgaW4gb3V0IEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4+IHtcbiAgW0s6IHN5bWJvbF06IHsgdHlwZXM6IFByaXNtYS5UeXBlTWFwPEV4dEFyZ3M+WydvdGhlciddIH1cblxuICAkb248ViBleHRlbmRzIExvZ09wdHM+KGV2ZW50VHlwZTogViwgY2FsbGJhY2s6IChldmVudDogViBleHRlbmRzICdxdWVyeScgPyBQcmlzbWEuUXVlcnlFdmVudCA6IFByaXNtYS5Mb2dFdmVudCkgPT4gdm9pZCk6IFByaXNtYUNsaWVudDtcblxuICAvKipcbiAgICogQ29ubmVjdCB3aXRoIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGNvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRkaXNjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAgICogRXhlY3V0ZXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3YFVQREFURSBVc2VyIFNFVCBjb29sID0gJHt0cnVlfSBXSEVSRSBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd1Vuc2FmZSgnVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAkMSBXSEVSRSBlbWFpbCA9ICQyIDsnLCB0cnVlLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJHsxfSBPUiBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlKCdTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkMSBPUiBlbWFpbCA9ICQyOycsIDEsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuXG4gIC8qKlxuICAgKiBBbGxvd3MgdGhlIHJ1bm5pbmcgb2YgYSBzZXF1ZW5jZSBvZiByZWFkL3dyaXRlIG9wZXJhdGlvbnMgdGhhdCBhcmUgZ3VhcmFudGVlZCB0byBlaXRoZXIgc3VjY2VlZCBvciBmYWlsIGFzIGEgd2hvbGUuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBbZ2VvcmdlLCBib2IsIGFsaWNlXSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0dlb3JnZScgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdCb2InIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQWxpY2UnIH0gfSksXG4gICAqIF0pXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3Mvb3JtL3ByaXNtYS1jbGllbnQvcXVlcmllcy90cmFuc2FjdGlvbnMpLlxuICAgKi9cbiAgJHRyYW5zYWN0aW9uPFAgZXh0ZW5kcyBQcmlzbWEuUHJpc21hUHJvbWlzZTxhbnk+W10+KGFyZzogWy4uLlBdLCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxydW50aW1lLlR5cGVzLlV0aWxzLlVud3JhcFR1cGxlPFA+PlxuXG4gICR0cmFuc2FjdGlvbjxSPihmbjogKHByaXNtYTogT21pdDxQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+KSA9PiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPiwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj5cblxuICAkZXh0ZW5kczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZXh0ZW5kc1wiLCBQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwgRXh0QXJncywgcnVudGltZS5UeXBlcy5VdGlscy5DYWxsPFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCB7XG4gICAgZXh0QXJnczogRXh0QXJnc1xuICB9Pj5cblxuICAgICAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ1Bvc3RgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ1Bvc3QqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nUG9zdCgpOiBQcmlzbWEuQmxvZ1Bvc3REZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJvb2tpbmdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQm9va2luZyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQm9va2luZ3NcbiAgICAqIGNvbnN0IGJvb2tpbmdzID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJvb2tpbmcoKTogUHJpc21hLkJvb2tpbmdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNhdGVnb3J5YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNhdGVnb3J5KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDYXRlZ29yaWVzXG4gICAgKiBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjYXRlZ29yeSgpOiBQcmlzbWEuQ2F0ZWdvcnlEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNvbnRhY3RNZXNzYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNvbnRhY3RNZXNzYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDb250YWN0TWVzc2FnZXNcbiAgICAqIGNvbnN0IGNvbnRhY3RNZXNzYWdlcyA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY29udGFjdE1lc3NhZ2UoKTogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZXZpZXdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmV2aWV3KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZXZpZXdzXG4gICAgKiBjb25zdCByZXZpZXdzID0gYXdhaXQgcHJpc21hLnJldmlldy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmV2aWV3KCk6IFByaXNtYS5SZXZpZXdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnRvdXJQYWNrYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlRvdXJQYWNrYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBUb3VyUGFja2FnZXNcbiAgICAqIGNvbnN0IHRvdXJQYWNrYWdlcyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdG91clBhY2thZ2UoKTogUHJpc21hLlRvdXJQYWNrYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS51c2VyYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlVzZXIqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFVzZXJzXG4gICAgKiBjb25zdCB1c2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB1c2VyKCk6IFByaXNtYS5Vc2VyRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nUG9zdDogJ0Jsb2dQb3N0JyxcbiAgQm9va2luZzogJ0Jvb2tpbmcnLFxuICBDYXRlZ29yeTogJ0NhdGVnb3J5JyxcbiAgQ29udGFjdE1lc3NhZ2U6ICdDb250YWN0TWVzc2FnZScsXG4gIFBheW1lbnQ6ICdQYXltZW50JyxcbiAgUmV2aWV3OiAnUmV2aWV3JyxcbiAgVG91clBhY2thZ2U6ICdUb3VyUGFja2FnZScsXG4gIFVzZXI6ICdVc2VyJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBNb2RlbE5hbWUgPSAodHlwZW9mIE1vZGVsTmFtZSlba2V5b2YgdHlwZW9mIE1vZGVsTmFtZV1cblxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZU1hcENiPEdsb2JhbE9taXRPcHRpb25zID0ge30+IGV4dGVuZHMgcnVudGltZS5UeXBlcy5VdGlscy5Gbjx7ZXh0QXJnczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyB9LCBydW50aW1lLlR5cGVzLlV0aWxzLlJlY29yZDxzdHJpbmcsIGFueT4+IHtcbiAgcmV0dXJuczogVHlwZU1hcDx0aGlzWydwYXJhbXMnXVsnZXh0QXJncyddLCBHbG9iYWxPbWl0T3B0aW9ucz5cbn1cblxuZXhwb3J0IHR5cGUgVHlwZU1hcDxFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncywgR2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gPSB7XG4gIGdsb2JhbE9taXRPcHRpb25zOiB7XG4gICAgb21pdDogR2xvYmFsT21pdE9wdGlvbnNcbiAgfVxuICBtZXRhOiB7XG4gICAgbW9kZWxQcm9wczogXCJibG9nUG9zdFwiIHwgXCJib29raW5nXCIgfCBcImNhdGVnb3J5XCIgfCBcImNvbnRhY3RNZXNzYWdlXCIgfCBcInBheW1lbnRcIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIlxuICAgIHR4SXNvbGF0aW9uTGV2ZWw6IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICBtb2RlbDoge1xuICAgIEJsb2dQb3N0OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQmxvZ1Bvc3RGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQmxvZ1Bvc3Q+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIEJvb2tpbmc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQm9va2luZ1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJvb2tpbmdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJvb2tpbmc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ2F0ZWdvcnk6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5DYXRlZ29yeUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDYXRlZ29yeT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ29udGFjdE1lc3NhZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDb250YWN0TWVzc2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUGF5bWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRQYXltZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUGF5bWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUGF5bWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZXZpZXc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmV2aWV3UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmV2aWV3RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmV2aWV3PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVG91clBhY2thZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ub3VyUGFja2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVUb3VyUGFja2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVXNlcjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRVc2VyUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVXNlckZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVXNlcj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSAmIHtcbiAgb3RoZXI6IHtcbiAgICBwYXlsb2FkOiBhbnlcbiAgICBvcGVyYXRpb25zOiB7XG4gICAgICAkZXhlY3V0ZVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRleGVjdXRlUmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW51bXNcbiAqL1xuXG5leHBvcnQgY29uc3QgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9IHJ1bnRpbWUubWFrZVN0cmljdEVudW0oe1xuICBSZWFkVW5jb21taXR0ZWQ6ICdSZWFkVW5jb21taXR0ZWQnLFxuICBSZWFkQ29tbWl0dGVkOiAnUmVhZENvbW1pdHRlZCcsXG4gIFJlcGVhdGFibGVSZWFkOiAnUmVwZWF0YWJsZVJlYWQnLFxuICBTZXJpYWxpemFibGU6ICdTZXJpYWxpemFibGUnXG59IGFzIGNvbnN0KVxuXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gKHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsKVtrZXlvZiB0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbF1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBib29raW5nSWQ6ICdib29raW5nSWQnLFxuICB0cmFuSWQ6ICd0cmFuSWQnLFxuICB2YWxJZDogJ3ZhbElkJyxcbiAgYW1vdW50OiAnYW1vdW50JyxcbiAgY3VycmVuY3k6ICdjdXJyZW5jeScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGdhdGV3YXlQYWdlVXJsOiAnZ2F0ZXdheVBhZ2VVcmwnLFxuICBzc2xTZXNzaW9uS2V5OiAnc3NsU2Vzc2lvbktleScsXG4gIGNhcmRUeXBlOiAnY2FyZFR5cGUnLFxuICBiYW5rVHJhbklkOiAnYmFua1RyYW5JZCcsXG4gIHBhaWRBdDogJ3BhaWRBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJldmlld1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGNvbW1lbnQ6ICdjb21tZW50JyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBkZXNjcmlwdGlvbjogJ2Rlc2NyaXB0aW9uJyxcbiAgbG9jYXRpb246ICdsb2NhdGlvbicsXG4gIHByaWNlOiAncHJpY2UnLFxuICBkdXJhdGlvbjogJ2R1cmF0aW9uJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgaW1hZ2VzOiAnaW1hZ2VzJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgY2F0ZWdvcnlJZDogJ2NhdGVnb3J5SWQnLFxuICBhZ2VudElkOiAnYWdlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgZ29vZ2xlSWQ6ICdnb29nbGVJZCcsXG4gIHBob25lOiAncGhvbmUnLFxuICBhdmF0YXJVcmw6ICdhdmF0YXJVcmwnLFxuICByb2xlOiAncm9sZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGF1dGhQcm92aWRlcjogJ2F1dGhQcm92aWRlcicsXG4gIGVtYWlsVmVyaWZpZWQ6ICdlbWFpbFZlcmlmaWVkJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdG9rZW5WZXJzaW9uOiAndG9rZW5WZXJzaW9uJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgU29ydE9yZGVyID0ge1xuICBhc2M6ICdhc2MnLFxuICBkZXNjOiAnZGVzYydcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgU29ydE9yZGVyID0gKHR5cGVvZiBTb3J0T3JkZXIpW2tleW9mIHR5cGVvZiBTb3J0T3JkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFF1ZXJ5TW9kZSA9IHtcbiAgZGVmYXVsdDogJ2RlZmF1bHQnLFxuICBpbnNlbnNpdGl2ZTogJ2luc2Vuc2l0aXZlJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBRdWVyeU1vZGUgPSAodHlwZW9mIFF1ZXJ5TW9kZSlba2V5b2YgdHlwZW9mIFF1ZXJ5TW9kZV1cblxuXG5leHBvcnQgY29uc3QgTnVsbHNPcmRlciA9IHtcbiAgZmlyc3Q6ICdmaXJzdCcsXG4gIGxhc3Q6ICdsYXN0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOdWxsc09yZGVyID0gKHR5cGVvZiBOdWxsc09yZGVyKVtrZXlvZiB0eXBlb2YgTnVsbHNPcmRlcl1cblxuXG5cbi8qKlxuICogRmllbGQgcmVmZXJlbmNlc1xuICovXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmcnXG4gKi9cbmV4cG9ydCB0eXBlIFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmdbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZ1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29sZWFuJ1xuICovXG5leHBvcnQgdHlwZSBCb29sZWFuRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9vbGVhbic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZSdcbiAqL1xuZXhwb3J0IHR5cGUgRGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludCdcbiAqL1xuZXhwb3J0IHR5cGUgSW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0SW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbCdcbiAqL1xuZXhwb3J0IHR5cGUgRGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWwnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWxbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0J1xuICovXG5leHBvcnQgdHlwZSBGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcltdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcltdJz5cbiAgICBcblxuLyoqXG4gKiBCYXRjaCBQYXlsb2FkIGZvciB1cGRhdGVNYW55ICYgZGVsZXRlTWFueSAmIGNyZWF0ZU1hbnlcbiAqL1xuZXhwb3J0IHR5cGUgQmF0Y2hQYXlsb2FkID0ge1xuICBjb3VudDogbnVtYmVyXG59XG5cbmV4cG9ydCBjb25zdCBkZWZpbmVFeHRlbnNpb24gPSBydW50aW1lLkV4dGVuc2lvbnMuZGVmaW5lRXh0ZW5zaW9uIGFzIHVua25vd24gYXMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZGVmaW5lXCIsIFR5cGVNYXBDYiwgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPlxuZXhwb3J0IHR5cGUgRGVmYXVsdFByaXNtYUNsaWVudCA9IFByaXNtYUNsaWVudFxuZXhwb3J0IHR5cGUgRXJyb3JGb3JtYXQgPSAncHJldHR5JyB8ICdjb2xvcmxlc3MnIHwgJ21pbmltYWwnXG4vKipcbiAqIE9wdGlvbnMgY29tbW9uIHRvIGFsbCB2YXJpYW50cyBvZiBgUHJpc21hQ2xpZW50T3B0aW9uc2AsIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlciBvciB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEBkZWZhdWx0IFwiY29sb3JsZXNzXCJcbiAgICovXG4gIGVycm9yRm9ybWF0PzogRXJyb3JGb3JtYXRcbiAgLyoqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiAvLyBTaG9ydGhhbmQgZm9yIGBlbWl0OiAnc3Rkb3V0J2BcbiAgICogbG9nOiBbJ3F1ZXJ5JywgJ2luZm8nLCAnd2FybicsICdlcnJvciddXG4gICAqIFxuICAgKiAvLyBFbWl0IGFzIGV2ZW50cyBvbmx5XG4gICAqIGxvZzogW1xuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBdXG4gICAqIFxuICAgKiAvIEVtaXQgYXMgZXZlbnRzIGFuZCBsb2cgdG8gc3Rkb3V0XG4gICAqIG9nOiBbXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIFxuICAgKiBgYGBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvbG9nZ2luZykuXG4gICAqL1xuICBsb2c/OiAoTG9nTGV2ZWwgfCBMb2dEZWZpbml0aW9uKVtdXG4gIC8qKlxuICAgKiBUaGUgZGVmYXVsdCB2YWx1ZXMgZm9yIHRyYW5zYWN0aW9uT3B0aW9uc1xuICAgKiBtYXhXYWl0ID89IDIwMDBcbiAgICogdGltZW91dCA/PSA1MDAwXG4gICAqL1xuICB0cmFuc2FjdGlvbk9wdGlvbnM/OiB7XG4gICAgbWF4V2FpdD86IG51bWJlclxuICAgIHRpbWVvdXQ/OiBudW1iZXJcbiAgICBpc29sYXRpb25MZXZlbD86IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICAvKipcbiAgICogR2xvYmFsIGNvbmZpZ3VyYXRpb24gZm9yIG9taXR0aW5nIG1vZGVsIGZpZWxkcyBieSBkZWZhdWx0LlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIG9taXQ6IHtcbiAgICogICAgIHVzZXI6IHtcbiAgICogICAgICAgcGFzc3dvcmQ6IHRydWVcbiAgICogICAgIH1cbiAgICogICB9XG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgb21pdD86IEdsb2JhbE9taXRDb25maWdcbiAgLyoqXG4gICAqIFNRTCBjb21tZW50ZXIgcGx1Z2lucyB0aGF0IGFkZCBtZXRhZGF0YSB0byBTUUwgcXVlcmllcyBhcyBjb21tZW50cy5cbiAgICogQ29tbWVudHMgZm9sbG93IHRoZSBzcWxjb21tZW50ZXIgZm9ybWF0OiBodHRwczovL2dvb2dsZS5naXRodWIuaW8vc3FsY29tbWVudGVyL1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgY29tbWVudHM6IFtcbiAgICogICAgIHRyYWNlQ29udGV4dCgpLFxuICAgKiAgICAgcXVlcnlJbnNpZ2h0cygpLFxuICAgKiAgIF0sXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgY29tbWVudHM/OiBydW50aW1lLlNxbENvbW1lbnRlclBsdWdpbltdXG4gIC8qKlxuICAgKiBPcHRpb25hbCBtYXhpbXVtIHNpemUgZm9yIHRoZSBxdWVyeSBwbGFuIGNhY2hlLiBJZiBub3QgcHJvdmlkZWQsIGEgZGVmYXVsdCBzaXplIHdpbGwgYmUgdXNlZC5cbiAgICogQSB2YWx1ZSBvZiBgMGAgY2FuIGJlIHVzZWQgdG8gZGlzYWJsZSB0aGUgY2FjaGUgZW50aXJlbHkuIEEgaGlnaGVyIGNhY2hlIHNpemUgY2FuIGltcHJvdmVcbiAgICogcGVyZm9ybWFuY2UgZm9yIGFwcGxpY2F0aW9ucyB0aGF0IGV4ZWN1dGUgYSBsYXJnZSBudW1iZXIgb2YgdW5pcXVlIHF1ZXJpZXMsIHdoaWxlIGEgc21hbGxlclxuICAgKiBjYWNoZSBzaXplIGNhbiByZWR1Y2UgbWVtb3J5IHVzYWdlLlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplOiAxMDAsXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplPzogbnVtYmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiBhIGRyaXZlciBhZGFwdGVyLlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIFByaXNtYSBBY2NlbGVyYXRlIGNvbm5lY3Rpb24gVVJMLiBVc2UgdGhpcyBvcHRpb24gdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiB1c2luZyBhIGRyaXZlciBhZGFwdGVyIHRvIGNvbm5lY3QgZGlyZWN0bHkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gICAqL1xuICBhY2NlbGVyYXRlVXJsOiBzdHJpbmdcbiAgYWRhcHRlcj86IG5ldmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlci4gVGhpcyBpcyB0aGUgY29tbW9uIGNhc2UgaW4gUHJpc21hIDcuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlciBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgdGhhdCBQcmlzbWFDbGllbnQgdXNlcyB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UsIHN1Y2ggYXMgdGhlIG9uZXMgcHJvdmlkZWQgYnkgYEBwcmlzbWEvYWRhcHRlci1wZ2AsIGBAcHJpc21hL2FkYXB0ZXItbGlic3FsYCwgYEBwcmlzbWEvYWRhcHRlci1wbGFuZXRzY2FsZWAsIGV0Yy5cbiAgICogXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgaXMgKipyZXF1aXJlZCoqIHVubGVzcyB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgKGluIHdoaWNoIGNhc2UgdXNlIGBhY2NlbGVyYXRlVXJsYCBpbnN0ZWFkKS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tICdAcHJpc21hL2FkYXB0ZXItcGcnXG4gICAqIGltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJy4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnQnXG4gICAqIFxuICAgKiBjb25zdCBhZGFwdGVyID0gbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgYWRhcHRlcjogcnVudGltZS5TcWxEcml2ZXJBZGFwdGVyRmFjdG9yeVxuICBhY2NlbGVyYXRlVXJsPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBPcHRpb25zIHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKiBcbiAqIEEgZHJpdmVyIGFkYXB0ZXIgKG9yLCBhbHRlcm5hdGl2ZWx5LCBhIFByaXNtYSBBY2NlbGVyYXRlIFVSTCkgaXMgKipyZXF1aXJlZCoqLiBTZWUge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlcn0gYW5kIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmx9IGZvciB0aGUgdHdvIHZhcmlhbnRzLiBBbGwgb3RoZXIgcHJvcGVydGllcyBsaXZlIGluIHtAbGluayBQcmlzbWFDbGllbnRCYXNlT3B0aW9uc30gYW5kIGFyZSBvcHRpb25hbC5cbiAqIFxuICogTGVhcm4gbW9yZSBhYm91dCBkcml2ZXIgYWRhcHRlcnM6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIHwgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyXG5leHBvcnQgdHlwZSBHbG9iYWxPbWl0Q29uZmlnID0ge1xuICBibG9nUG9zdD86IFByaXNtYS5CbG9nUG9zdE9taXRcbiAgYm9va2luZz86IFByaXNtYS5Cb29raW5nT21pdFxuICBjYXRlZ29yeT86IFByaXNtYS5DYXRlZ29yeU9taXRcbiAgY29udGFjdE1lc3NhZ2U/OiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VPbWl0XG4gIHBheW1lbnQ/OiBQcmlzbWEuUGF5bWVudE9taXRcbiAgcmV2aWV3PzogUHJpc21hLlJldmlld09taXRcbiAgdG91clBhY2thZ2U/OiBQcmlzbWEuVG91clBhY2thZ2VPbWl0XG4gIHVzZXI/OiBQcmlzbWEuVXNlck9taXRcbn1cblxuLyogVHlwZXMgZm9yIExvZ2dpbmcgKi9cbmV4cG9ydCB0eXBlIExvZ0xldmVsID0gJ2luZm8nIHwgJ3F1ZXJ5JyB8ICd3YXJuJyB8ICdlcnJvcidcbmV4cG9ydCB0eXBlIExvZ0RlZmluaXRpb24gPSB7XG4gIGxldmVsOiBMb2dMZXZlbFxuICBlbWl0OiAnc3Rkb3V0JyB8ICdldmVudCdcbn1cblxuZXhwb3J0IHR5cGUgQ2hlY2tJc0xvZ0xldmVsPFQ+ID0gVCBleHRlbmRzIExvZ0xldmVsID8gVCA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBHZXRMb2dUeXBlPFQ+ID0gQ2hlY2tJc0xvZ0xldmVsPFxuICBUIGV4dGVuZHMgTG9nRGVmaW5pdGlvbiA/IFRbJ2xldmVsJ10gOiBUXG4+O1xuXG5leHBvcnQgdHlwZSBHZXRFdmVudHM8VCBleHRlbmRzIGFueVtdPiA9IFQgZXh0ZW5kcyBBcnJheTxMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24+XG4gID8gR2V0TG9nVHlwZTxUW251bWJlcl0+XG4gIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBxdWVyeTogc3RyaW5nXG4gIHBhcmFtczogc3RyaW5nXG4gIGR1cmF0aW9uOiBudW1iZXJcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgTG9nRXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBtZXNzYWdlOiBzdHJpbmdcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cbi8qIEVuZCBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuXG5cbmV4cG9ydCB0eXBlIFByaXNtYUFjdGlvbiA9XG4gIHwgJ2ZpbmRVbmlxdWUnXG4gIHwgJ2ZpbmRVbmlxdWVPclRocm93J1xuICB8ICdmaW5kTWFueSdcbiAgfCAnZmluZEZpcnN0J1xuICB8ICdmaW5kRmlyc3RPclRocm93J1xuICB8ICdjcmVhdGUnXG4gIHwgJ2NyZWF0ZU1hbnknXG4gIHwgJ2NyZWF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3VwZGF0ZSdcbiAgfCAndXBkYXRlTWFueSdcbiAgfCAndXBkYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBzZXJ0J1xuICB8ICdkZWxldGUnXG4gIHwgJ2RlbGV0ZU1hbnknXG4gIHwgJ2V4ZWN1dGVSYXcnXG4gIHwgJ3F1ZXJ5UmF3J1xuICB8ICdhZ2dyZWdhdGUnXG4gIHwgJ2NvdW50J1xuICB8ICdydW5Db21tYW5kUmF3J1xuICB8ICdmaW5kUmF3J1xuICB8ICdncm91cEJ5J1xuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIHByb3h5IGF2YWlsYWJsZSBpbiBpbnRlcmFjdGl2ZSB0cmFuc2FjdGlvbnMuXG4gKi9cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uQ2xpZW50ID0gT21pdDxEZWZhdWx0UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PlxuXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4qIFRoaXMgZmlsZSBleHBvcnRzIGFsbCBlbnVtIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgc2NoZW1hLlxuKlxuKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuKi9cblxuZXhwb3J0IGNvbnN0IFJvbGUgPSB7XG4gIFVTRVI6ICdVU0VSJyxcbiAgQUdFTlQ6ICdBR0VOVCcsXG4gIEFETUlOOiAnQURNSU4nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJvbGUgPSAodHlwZW9mIFJvbGUpW2tleW9mIHR5cGVvZiBSb2xlXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU3RhdHVzID0ge1xuICBBQ1RJVkU6ICdBQ1RJVkUnLFxuICBTVVNQRU5ERUQ6ICdTVVNQRU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTdGF0dXMgPSAodHlwZW9mIFVzZXJTdGF0dXMpW2tleW9mIHR5cGVvZiBVc2VyU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBBdXRoUHJvdmlkZXIgPSB7XG4gIENSRURFTlRJQUw6ICdDUkVERU5USUFMJyxcbiAgR09PR0xFOiAnR09PR0xFJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBBdXRoUHJvdmlkZXIgPSAodHlwZW9mIEF1dGhQcm92aWRlcilba2V5b2YgdHlwZW9mIEF1dGhQcm92aWRlcl1cblxuXG5leHBvcnQgY29uc3QgUGFja2FnZVN0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBBUFBST1ZFRDogJ0FQUFJPVkVEJyxcbiAgUkVKRUNURUQ6ICdSRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGFja2FnZVN0YXR1cyA9ICh0eXBlb2YgUGFja2FnZVN0YXR1cylba2V5b2YgdHlwZW9mIFBhY2thZ2VTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgUEFJRDogJ1BBSUQnLFxuICBDT05GSVJNRUQ6ICdDT05GSVJNRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBDT01QTEVURUQ6ICdDT01QTEVURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTdGF0dXMgPSAodHlwZW9mIEJvb2tpbmdTdGF0dXMpW2tleW9mIHR5cGVvZiBCb29raW5nU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U3RhdHVzID0ge1xuICBJTklUSUFURUQ6ICdJTklUSUFURUQnLFxuICBTVUNDRVNTOiAnU1VDQ0VTUycsXG4gIEZBSUxFRDogJ0ZBSUxFRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIFJFRlVOREVEOiAnUkVGVU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTdGF0dXMgPSAodHlwZW9mIFBheW1lbnRTdGF0dXMpW2tleW9mIHR5cGVvZiBQYXltZW50U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQb3N0U3RhdHVzID0ge1xuICBEUkFGVDogJ0RSQUZUJyxcbiAgUFVCTElTSEVEOiAnUFVCTElTSEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQb3N0U3RhdHVzID0gKHR5cGVvZiBQb3N0U3RhdHVzKVtrZXlvZiB0eXBlb2YgUG9zdFN0YXR1c11cbiIsICIvLyBBcHBFcnJvciBrZWVwcyB0aGUgZXhhY3Qgc2FtZSBcImp1c3QgdGhyb3cgaXRcIiBlcmdvbm9taWNzIGJ1dCBjYXJyaWVzXG4vLyBhIHN0YXR1c0NvZGUgdGhlIGdsb2JhbCBoYW5kbGVyIGNhbiByZWFkIChzZWUgbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXIudHMpLlxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3RhdHVzQ29kZTogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkFwcEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSBcIkBwcmlzbWEvYWRhcHRlci1wZ1wiO1xuaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY29uc3QgY29ubmVjdGlvblN0cmluZyA9IGNvbmZpZy5kYXRhYmFzZV91cmw7XG5cbi8vIFNlcnZlcmxlc3MtZnJpZW5kbHkgcG9vbDogb25lIGNvbm5lY3Rpb24gcGVyIHdhcm0gaW5zdGFuY2Ugc28gbWFueVxuLy8gY29uY3VycmVudCBpbnZvY2F0aW9ucyBjYW4ndCBleGhhdXN0IHRoZSBkYXRhYmFzZSdzIGNvbm5lY3Rpb24gbGltaXQuXG4vLyBMb2NhbC9WTSBydW5zIGFyZSB1bmFmZmVjdGVkIChhIHNpbmdsZSBwcm9jZXNzIHVzZXMgb25lIGNvbm5lY3Rpb24gYW55d2F5KS5cbmNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nLCBtYXg6IDEgfSk7XG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KTtcblxuZXhwb3J0IHsgcHJpc21hIH07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IGF1dGhDb250cm9sbGVyIH0gZnJvbSBcIi4vYXV0aC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBhdXRoVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9hdXRoLnZhbGlkYXRpb25cIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBSZWdpc3RlciBcdTIwMTQgcm9sZSBpcyBvcHRpb25hbCBhbmQgcmVzdHJpY3RlZCB0byBVU0VSL0FHRU5UIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVnaXN0ZXJcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZ2lzdGVyU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWdpc3RlclVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5sb2dpblVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZ29vZ2xlXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5nb29nbGVMb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZ29vZ2xlTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZGVtby1sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZGVtb0xvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5kZW1vTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVmcmVzaFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVmcmVzaFRva2VuU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWZyZXNoVG9rZW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcIi9sb2dvdXRcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5sb2dvdXRVc2VyKTtcblxucm91dGVyLmdldChcIi9tZVwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmdldE1lKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBhdXRoU2VydmljZSB9IGZyb20gXCIuL2F1dGguc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIjtcblxuLy8gRGV2IChsb2NhbGhvc3Q6MzAwMCBcdTIxOTIgOjQwMDApIGlzIHNhbWUtc2l0ZSBcdTIxOTIgbGF4IHdvcmtzIHdpdGggc2VjdXJlOmZhbHNlLlxuLy8gUHJvZCAoY3Jvc3Mtc2l0ZSBmcm9udGVuZC9iYWNrZW5kKSByZXF1aXJlcyBTYW1lU2l0ZT1Ob25lICsgU2VjdXJlLlxuY29uc3QgY29va2llT3B0aW9uczoge1xuICBodHRwT25seTogdHJ1ZTtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzYW1lU2l0ZTogXCJsYXhcIiB8IFwibm9uZVwiO1xufSA9IHtcbiAgaHR0cE9ubHk6IHRydWUsXG4gIHNlY3VyZTogaXNQcm9kdWN0aW9uLFxuICBzYW1lU2l0ZTogaXNQcm9kdWN0aW9uID8gXCJub25lXCIgOiBcImxheFwiLFxufTtcblxuY29uc3QgQUNDRVNTX0NPT0tJRV9NQVhfQUdFID0gMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMSBkYXlcbmNvbnN0IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDMwIGRheXNcblxuY29uc3Qgc2V0QXV0aENvb2tpZXMgPSAoXG4gIHJlczogUmVzcG9uc2UsXG4gIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9OiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IHJlZnJlc2hUb2tlbjogc3RyaW5nIH0sXG4pID0+IHtcbiAgcmVzLmNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGFjY2Vzc1Rva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IEFDQ0VTU19DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG4gIHJlcy5jb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgcmVmcmVzaFRva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xufTtcblxuY29uc3QgY2xlYXJBdXRoQ29va2llcyA9IChyZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5jbGVhckNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xuICByZXMuY2xlYXJDb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG59O1xuXG4vLyBSZWdpc3RlciBjb250cm9sbGVyXG5jb25zdCByZWdpc3RlclVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYXV0aFNlcnZpY2UucmVnaXN0ZXJVc2VyKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgUmVnaXN0ZXJlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9naW4gY29udHJvbGxlclxuY29uc3QgbG9naW5Vc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0gPSBhd2FpdCBhdXRoU2VydmljZS5sb2dpblVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdylcbmNvbnN0IGdvb2dsZUxvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5nb29nbGVMb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVtbyBsb2dpbiBjb250cm9sbGVyXG5jb25zdCBkZW1vTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmRlbW9Mb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEZW1vIHVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZWZyZXNoIHRva2VuIGNvbnRyb2xsZXJcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Db29raWUgPSByZXEuY29va2llcy5yZWZyZXNoVG9rZW47XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUJvZHkgPSByZXEuYm9keT8ucmVmcmVzaFRva2VuO1xuXG4gICAgaWYgKCFyZWZyZXNoVG9rZW5Gcm9tQ29va2llICYmICFyZWZyZXNoVG9rZW5Gcm9tQm9keSkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVELFxuICAgICAgICBtZXNzYWdlOiBcIlJlZnJlc2ggdG9rZW4gaXMgcmVxdWlyZWRcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0gPVxuICAgICAgYXdhaXQgYXV0aFNlcnZpY2UucmVmcmVzaFRva2VuKHtcbiAgICAgICAgcmVmcmVzaFRva2VuOiByZWZyZXNoVG9rZW5Gcm9tQ29va2llIHx8IHJlZnJlc2hUb2tlbkZyb21Cb2R5LFxuICAgICAgfSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4sXG4gICAgfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVG9rZW4gcmVmcmVzaGVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIExvZ291dCBjb250cm9sbGVyXG5jb25zdCBsb2dvdXRVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ291dCh1c2VySWQpO1xuICAgIGNsZWFyQXV0aENvb2tpZXMocmVzKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBvdXQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IE1lIGNvbnRyb2xsZXJcbmNvbnN0IGdldE1lID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5nZXRNZUZyb21EQih1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhDb250cm9sbGVyID0ge1xuICByZWdpc3RlclVzZXIsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXRVc2VyLFxuICBnZXRNZSxcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IGdvb2dsZUNsaWVudCB9IGZyb20gXCIuLi8uLi9saWIvZ29vZ2xlQXV0aFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2p3dFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQXV0aCxcbiAgSURlbW9Mb2dpblBheWxvYWQsXG4gIElHb29nbGVMb2dpblBheWxvYWQsXG4gIElMb2dpblVzZXIsXG4gIElSZWZyZXNoVG9rZW5QYXlsb2FkLFxufSBmcm9tIFwiLi9hdXRoLmludGVyZmFjZVwiO1xuXG5jb25zdCBidWlsZFRva2VuUGF5bG9hZCA9ICh1c2VyOiB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcm9sZTogUm9sZTtcbiAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG59KSA9PiAoe1xuICBpZDogdXNlci5pZCxcbiAgbmFtZTogdXNlci5uYW1lLFxuICBlbWFpbDogdXNlci5lbWFpbCxcbiAgcm9sZTogdXNlci5yb2xlLFxuICB0b2tlblZlcnNpb246IHVzZXIudG9rZW5WZXJzaW9uLFxufSk7XG5cbmNvbnN0IGlzc3VlVG9rZW5zID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+IHtcbiAgY29uc3QgdG9rZW5QYXlsb2FkID0gYnVpbGRUb2tlblBheWxvYWQodXNlcik7XG5cbiAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X2FjY2Vzc19leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IHJlZnJlc2hUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X3JlZnJlc2hfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuXG4gIHJldHVybiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTtcbn07XG5cbmNvbnN0IHNhbml0aXplVXNlciA9IDxUIGV4dGVuZHMgeyBwYXNzd29yZDogc3RyaW5nIHwgbnVsbCB9Pih1c2VyOiBUKSA9PiB7XG4gIGNvbnN0IHsgcGFzc3dvcmQsIC4uLnJlc3QgfSA9IHVzZXI7XG4gIHJldHVybiByZXN0O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZ2lzdGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVnaXN0ZXJVc2VyID0gYXN5bmMgKHBheWxvYWQ6IElBdXRoKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgZW1haWwsIHBhc3N3b3JkLCBwaG9uZSwgcm9sZSB9ID0gcGF5bG9hZDtcblxuICAvLyBPbmx5IHVzZXJzL2FnZW50cyBjYW4gc2VsZi1yZWdpc3RlcjsgYWRtaW5zIGFyZSBjcmVhdGVkIHZpYSBkZW1vLWxvZ2luL3NlZWRcbiAgaWYgKHJvbGUgJiYgcm9sZSAhPT0gXCJVU0VSXCIgJiYgcm9sZSAhPT0gXCJBR0VOVFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSb2xlIG11c3QgYmUgZWl0aGVyIFVTRVIgb3IgQUdFTlRcIik7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcbiAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVXNlciB3aXRoIHRoaXMgZW1haWwgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cblxuICBjb25zdCBoYXNoZWRQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIHBhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICBjb25zdCBjcmVhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZSxcbiAgICAgIGVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IGhhc2hlZFBhc3N3b3JkLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHJvbGU6IHJvbGUgfHwgXCJVU0VSXCIsXG4gICAgICBwaG9uZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9naW5Vc2VyID0gYXN5bmMgKHBheWxvYWQ6IElMb2dpblVzZXIpID0+IHtcbiAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiVGhpcyBhY2NvdW50IHVzZXMgR29vZ2xlIGxvZ2luLiBQbGVhc2UgbG9nIGluIHdpdGggR29vZ2xlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBpc1Bhc3N3b3JkVmFsaWQgPSBhd2FpdCBiY3J5cHQuY29tcGFyZShwYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgaWYgKCFpc1Bhc3N3b3JkVmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdvb2dsZUxvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElHb29nbGVMb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBpZFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGlmICghY29uZmlnLmdvb2dsZV9jbGllbnRfaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkdvb2dsZSBsb2dpbiBpcyBub3QgY29uZmlndXJlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICApO1xuICB9XG5cbiAgbGV0IHRpY2tldDtcbiAgdHJ5IHtcbiAgICB0aWNrZXQgPSBhd2FpdCBnb29nbGVDbGllbnQudmVyaWZ5SWRUb2tlbih7XG4gICAgICBpZFRva2VuLFxuICAgICAgYXVkaWVuY2U6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgR29vZ2xlIHRva2VuXCIpO1xuICB9XG5cbiAgY29uc3QgZ29vZ2xlRGF0YSA9IHRpY2tldC5nZXRQYXlsb2FkKCk7XG4gIGlmICghZ29vZ2xlRGF0YSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBHb29nbGUgdG9rZW4gcGF5bG9hZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHsgZW1haWwsIG5hbWUsIHN1YiwgcGljdHVyZSB9ID0gZ29vZ2xlRGF0YTtcblxuICBpZiAoIWVtYWlsIHx8ICFnb29nbGVEYXRhLmVtYWlsX3ZlcmlmaWVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJHb29nbGUgYWNjb3VudCBlbWFpbCBpcyBub3QgdmVyaWZpZWRcIik7XG4gIH1cblxuICBsZXQgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBnb29nbGVJZDogc3ViIH0gfSk7XG5cbiAgLy8gRXhpc3RpbmcgdXNlciBcdTIxOTIgbGluayBHb29nbGUgYWNjb3VudCBpZiBub3QgYWxyZWFkeSBsaW5rZWRcbiAgaWYgKCF1c2VyICYmIGVtYWlsKSB7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICAgIGlmICh1c2VyKSB7XG4gICAgICBpZiAodXNlci5nb29nbGVJZCAmJiB1c2VyLmdvb2dsZUlkICE9PSBzdWIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIkVtYWlsIGlzIGFscmVhZHkgbGlua2VkIHRvIGFub3RoZXIgR29vZ2xlIGFjY291bnRcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogdXNlci5pZCB9LFxuICAgICAgICBkYXRhOiB7IGdvb2dsZUlkOiBzdWIsIGVtYWlsVmVyaWZpZWQ6IHRydWUgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJyYW5kIG5ldyB1c2VyXG4gIGlmICghdXNlcikge1xuICAgIGNvbnN0IGxvY2FsUGFydCA9IGVtYWlsLnNwbGl0KFwiQFwiKVswXSA/PyBlbWFpbDtcbiAgICBjb25zdCBkaXNwbGF5TmFtZSA9IChuYW1lID8/IFwiXCIpLnRyaW0oKSB8fCBsb2NhbFBhcnQ7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGVtYWlsLFxuICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIGF1dGhQcm92aWRlcjogXCJHT09HTEVcIixcbiAgICAgICAgZ29vZ2xlSWQ6IHN1YixcbiAgICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgcm9sZTogXCJVU0VSXCIsXG4gICAgICAgIGF2YXRhclVybDogcGljdHVyZSB8fCBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VucyA9IGlzc3VlVG9rZW5zKHVzZXIhKTtcbiAgY29uc3Qgc2FuaXRpemVkVXNlciA9IHNhbml0aXplVXNlcih1c2VyISk7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBzYW5pdGl6ZWRVc2VyIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRGVtbyBsb2dpbiAoZ3JhZGluZykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBERU1PX1BBU1NXT1JEID0gXCJkZW1vMTIzXCI7XG5cbmNvbnN0IGRlbW9Mb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJRGVtb0xvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgZGVtb1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cHNlcnQoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAgfSxcbiAgICAvLyByZXN1cnJlY3QgZGVtbyBhY2NvdW50cyB0aGF0IGFuIGFkbWluIHN1c3BlbmRlZCBvciBzb2Z0LWRlbGV0ZWRcbiAgICB1cGRhdGU6IHsgc3RhdHVzOiBcIkFDVElWRVwiLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgY3JlYXRlOiB7XG4gICAgICBuYW1lOiBgRGVtbyAke3JvbGUuY2hhckF0KDApICsgcm9sZS5zbGljZSgxKS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gLFxuICAgICAgcGFzc3dvcmQ6IGF3YWl0IGJjcnlwdC5oYXNoKERFTU9fUEFTU1dPUkQsIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSksXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZSxcbiAgICAgIHN0YXR1czogXCJBQ1RJVkVcIixcbiAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IC4uLmlzc3VlVG9rZW5zKGRlbW9Vc2VyKSwgdXNlcjogZGVtb1VzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZyZXNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVmcmVzaFRva2VuID0gYXN5bmMgKHBheWxvYWQ6IElSZWZyZXNoVG9rZW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcmVmcmVzaFRva2VuOiBwcm92aWRlZFJlZnJlc2hUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB2ZXJpZmllZCA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgIHByb3ZpZGVkUmVmcmVzaFRva2VuLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICk7XG5cbiAgaWYgKCF2ZXJpZmllZC5zdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWQuZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uOiB0b2tlblRva2VuVmVyc2lvbiB9ID1cbiAgICB2ZXJpZmllZC5kYXRhIGFzIEp3dFBheWxvYWQgJiB7IHRva2VuVmVyc2lvbjogbnVtYmVyIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cblxuICAvLyB0b2tlblZlcnNpb24gY2hhbmdlZCBcdTIxOTIgdG9rZW5zIHdlcmUgcmV2b2tlZCAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlKVxuICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVG9rZW5WZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJUb2tlbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9nb3V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9nb3V0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGE6IHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdldCBtZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE1lRnJvbURCID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgYXV0aFNlcnZpY2UgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dCxcbiAgZ2V0TWVGcm9tREIsXG59OyIsICJpbXBvcnQgeyBPQXV0aDJDbGllbnQgfSBmcm9tIFwiZ29vZ2xlLWF1dGgtbGlicmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBjb25zdCBnb29nbGVDbGllbnQgPSBuZXcgT0F1dGgyQ2xpZW50KHtcbiAgY2xpZW50SWQ6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxufSk7IiwgImltcG9ydCBqd3QsIHsgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5cbmNvbnN0IGNyZWF0ZVRva2VuID0gKFxuICBwYXlsb2FkOiBKd3RQYXlsb2FkLFxuICBzZWNyZXQ6IHN0cmluZyxcbiAgZXhwaXJlc0luOiBTaWduT3B0aW9ucyxcbikgPT4ge1xuICBjb25zdCB0b2tlbiA9IGp3dC5zaWduKHBheWxvYWQsIHNlY3JldCwgZXhwaXJlc0luKTtcblxuICByZXR1cm4gdG9rZW47XG59O1xuXG5jb25zdCB2ZXJpZnlUb2tlbiA9ICh0b2tlbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3QudmVyaWZ5KHRva2VuLCBzZWNyZXQpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZGF0YTogdmVyaWZpZWRUb2tlbixcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5sb2coXCJUb2tlbiBWZXJpZmljYXRpb24gRmFpbGVkOlwiLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGp3dFV0aWxzID0ge1xuICBjcmVhdGVUb2tlbixcbiAgdmVyaWZ5VG9rZW4sXG59O1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVxdWVzdEhhbmRsZXIsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGNhdGNoQXN5bmMgPSAoZm46IFJlcXVlc3RIYW5kbGVyKSA9PiB7XG4gIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZm4ocmVxLCByZXMsIG5leHQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH07XG59O1xuIiwgImltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxudHlwZSBUTWV0YSA9IHtcbiAgcGFnZTogbnVtYmVyO1xuICBsaW1pdDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICB0b3RhbFBhZ2VzOiBudW1iZXI7XG59O1xuXG50eXBlIFRSZXNwb25zZURhdGE8VD4gPSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBkYXRhOiBUO1xuICBtZXRhPzogVE1ldGE7XG59O1xuXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gPFQ+KHJlczogUmVzcG9uc2UsIGRhdGE6IFRSZXNwb25zZURhdGE8VD4pID0+IHtcbiAgcmVzLnN0YXR1cyhkYXRhLnN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGRhdGEuc3VjY2VzcyxcbiAgICBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UsXG4gICAgZGF0YTogZGF0YS5kYXRhLFxuICAgIG1ldGE6IGRhdGEubWV0YSxcbiAgfSk7XG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgcmVnaXN0ZXJTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG4gIHBob25lOiB6XG4gICAgLnN0cmluZygpXG4gICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgbG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZ29vZ2xlTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkVG9rZW46IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiR29vZ2xlIGlkVG9rZW4gaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZGVtb0xvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiLFxuICB9KSxcbn0pO1xuXG4vLyByZWZyZXNoVG9rZW4gbWF5IGNvbWUgZnJvbSB0aGUgaHR0cE9ubHkgY29va2llIE9SIHRoZSByZXF1ZXN0IGJvZHkgXHUyMDE0XG4vLyB2YWxpZGF0aW9uIGlzIGxlbmllbnQgaGVyZTsgdGhlIGNvbnRyb2xsZXIgaGFuZGxlcyBib3RoIHNvdXJjZXMuXG5jb25zdCByZWZyZXNoVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJlZnJlc2hUb2tlbjogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUUmVnaXN0ZXJTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWdpc3RlclNjaGVtYT47XG5leHBvcnQgdHlwZSBUTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBsb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUR29vZ2xlTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnb29nbGVMb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVmcmVzaFRva2VuU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVmcmVzaFRva2VuU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGF1dGhWYWxpZGF0aW9ucyA9IHtcbiAgcmVnaXN0ZXJTY2hlbWEsXG4gIGxvZ2luU2NoZW1hLFxuICBnb29nbGVMb2dpblNjaGVtYSxcbiAgZGVtb0xvZ2luU2NoZW1hLFxuICByZWZyZXNoVG9rZW5TY2hlbWEsXG59OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFpvZFR5cGUgfSBmcm9tIFwiem9kXCI7XG5cbnR5cGUgVmFsaWRhdGlvblNjaGVtYSA9IHtcbiAgYm9keT86IFpvZFR5cGU7XG4gIHF1ZXJ5PzogWm9kVHlwZTtcbiAgcGFyYW1zPzogWm9kVHlwZTtcbn07XG5cbi8vIFJ1bnMgWm9kIHNjaGVtYXMgYWdhaW5zdCByZXEuYm9keS9xdWVyeS9wYXJhbXMgYW5kIHJlcGxhY2VzIHRoZSBwYXJzZWRcbi8vIHZhbHVlcyBzbyBkb3duc3RyZWFtIGhhbmRsZXJzIHdvcmsgd2l0aCB2YWxpZGF0ZWQgKGFuZCB0eXBlZCkgZGF0YS5cbi8vIEFueSBab2RFcnJvciB0aHJvd24gaGVyZSBpcyBtYXBwZWQgdG8gYSA0MDAgYnkgZ2xvYmFsRXJyb3JIYW5kbGVyLlxuLy9cbi8vIHJlcS5ib2R5IGlzIHNhZmVseSB3cml0YWJsZSwgYnV0IGluIEV4cHJlc3MgNSByZXEucXVlcnkvcmVxLnBhcmFtcyBhcmVcbi8vIGdldHRlci1vbmx5IFx1MjAxNCB0aGV5IG11c3QgYmUgcmVkZWZpbmVkIHZpYSBkZWZpbmVQcm9wZXJ0eSB0byBzd2FwIGluIHRoZVxuLy8gcGFyc2VkIHZhbHVlcy5cbmNvbnN0IHZhbGlkYXRlUmVxdWVzdCA9IChzY2hlbWE6IFZhbGlkYXRpb25TY2hlbWEpID0+IHtcbiAgcmV0dXJuIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmIChzY2hlbWEuYm9keSkge1xuICAgICAgcmVxLmJvZHkgPSBzY2hlbWEuYm9keS5wYXJzZShyZXEuYm9keSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucXVlcnkpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFF1ZXJ5ID0gc2NoZW1hLnF1ZXJ5LnBhcnNlKHJlcS5xdWVyeSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInF1ZXJ5XCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFF1ZXJ5LFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucGFyYW1zKSB7XG4gICAgICBjb25zdCBwYXJzZWRQYXJhbXMgPSBzY2hlbWEucGFyYW1zLnBhcnNlKHJlcS5wYXJhbXMpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJwYXJhbXNcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUGFyYW1zLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgdmFsaWRhdGVSZXF1ZXN0OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uL3V0aWxzL2p3dFwiO1xuXG4vLyBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pIFx1MjE5MiBvbmx5IHRob3NlIHJvbGVzIHBhc3Ncbi8vIGF1dGgoKSBcdTIxOTIgYW55IGF1dGhlbnRpY2F0ZWQgdXNlciBwYXNzZXNcbmNvbnN0IGF1dGggPSAoLi4ucmVxdWlyZWRSb2xlczogUm9sZVtdKSA9PiB7XG4gIHJldHVybiBjYXRjaEFzeW5jKGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgID8gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbj8uc3RhcnRzV2l0aChcIkJlYXJlciBcIilcbiAgICAgICAgPyByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uLnNwbGl0KFwiIFwiKVsxXVxuICAgICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG5cbiAgICAvLyAxLiB0b2tlbiBtdXN0IGJlIHByZXNlbnRcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uIFBsZWFzZSBsb2dpbiB0byBjb250aW51ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gMi4gdmVyaWZ5IHRoZSBhY2Nlc3MgdG9rZW5cbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgICB0b2tlbixcbiAgICAgIGNvbmZpZy5qd3RfYWNjZXNzX3NlY3JldCxcbiAgICApO1xuXG4gICAgaWYgKCF2ZXJpZmllZFRva2VuLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkVG9rZW4uZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbiB9ID0gdmVyaWZpZWRUb2tlbi5kYXRhIGFzIEp3dFBheWxvYWQgJiB7XG4gICAgICB0b2tlblZlcnNpb246IG51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gMy4gcmUtZmV0Y2ggdXNlciB0byBlbmZvcmNlIGFjY291bnQgc3RhdGUgb24gZXZlcnkgcmVxdWVzdFxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNC4gdG9rZW5WZXJzaW9uIG11c3QgbWF0Y2ggREIgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSBraWxscyBvbGQgdG9rZW5zKVxuICAgIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5WZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJTZXNzaW9uIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA1LiBhdXRob3JpemF0aW9uIHVzZXMgdGhlIERCIHJvbGUsIG5vdCB0aGUgKHBvc3NpYmx5IHN0YWxlKSBKV1Qgcm9sZVxuICAgIGlmIChyZXF1aXJlZFJvbGVzLmxlbmd0aCAmJiAhcmVxdWlyZWRSb2xlcy5pbmNsdWRlcyh1c2VyLnJvbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIGFjY2VzcyB0aGlzIHJvdXRlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA2LiBhdHRhY2ggdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciB0byB0aGUgcmVxdWVzdFxuICAgIHJlcS51c2VyID0ge1xuICAgICAgaWQ6IHVzZXIuaWQsXG4gICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIHJvbGU6IHVzZXIucm9sZSxcbiAgICB9O1xuXG4gICAgbmV4dCgpO1xuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGF1dGg7IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyB1c2VyQ29udHJvbGxlciB9IGZyb20gXCIuL3VzZXIuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgdXNlclZhbGlkYXRpb25zIH0gZnJvbSBcIi4vdXNlci52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPd24gcHJvZmlsZSBcdTIwMTQgYW55IGF1dGhlbnRpY2F0ZWQgdXNlclxucm91dGVyLnBhdGNoKFxuICBcIi9wcm9maWxlXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogdXNlclZhbGlkYXRpb25zLnVwZGF0ZVByb2ZpbGVTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLnVwZGF0ZVByb2ZpbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgbGlzdCB1c2VycyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHVzZXJWYWxpZGF0aW9ucy51c2VyUXVlcnlTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmdldFVzZXJzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHJvbGUgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvcm9sZVwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVJvbGVTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VSb2xlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHN0YXR1cyBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VTdGF0dXMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc29mdCBkZWxldGVcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5kZWxldGVVc2VyLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1c2VyU2VydmljZSB9IGZyb20gXCIuL3VzZXIuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIFVwZGF0ZSBwcm9maWxlIGNvbnRyb2xsZXJcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUHJvZmlsZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIHVzZXJzIChhZG1pbilcbmNvbnN0IGdldFVzZXJzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlclNlcnZpY2UuZ2V0VXNlcnMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VycyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciByb2xlIChhZG1pbilcbmNvbnN0IGNoYW5nZVJvbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRvd25ncmFkZS9jaGFuZ2UgdGhlaXIgb3duIHJvbGVcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHJvbGUuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlUm9sZShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgcm9sZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciBzdGF0dXMgKGFkbWluKVxuY29uc3QgY2hhbmdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBzdXNwZW5kL2FjdGl2YXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biBzdGF0dXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gU29mdCBkZWxldGUgdXNlciAoYWRtaW4pXG5jb25zdCBkZWxldGVVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkZWxldGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgZGVsZXRlIHlvdXIgb3duIGFjY291bnQuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuZGVsZXRlVXNlcihpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlckNvbnRyb2xsZXIgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgYmNyeXB0IGZyb20gXCJiY3J5cHRqc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQ2hhbmdlUm9sZSxcbiAgSUNoYW5nZVN0YXR1cyxcbiAgSVVwZGF0ZVByb2ZpbGUsXG4gIElVc2VyUXVlcnksXG59IGZyb20gXCIuL3VzZXIuaW50ZXJmYWNlXCI7XG5cbmNvbnN0IHZhbGlkYXRlQWN0aXZlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBVcGRhdGUgcHJvZmlsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVQcm9maWxlKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGhvbmUsIGF2YXRhclVybCwgY3VycmVudFBhc3N3b3JkLCBuZXdQYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogdXNlcklkIH0gfSk7XG5cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAzLFxuICAgICAgXCJHb29nbGUgYWNjb3VudHMgY2Fubm90IGNoYW5nZSBwYXNzd29yZC4gVXNlIEdvb2dsZSBzaWduLWluIHRvIG1hbmFnZSB5b3VyIHByb2ZpbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Vc2VyVXBkYXRlSW5wdXQgPSB7fTtcblxuICBpZiAobmFtZSkgZGF0YS5uYW1lID0gbmFtZTtcbiAgaWYgKHBob25lKSBkYXRhLnBob25lID0gcGhvbmU7XG4gIGlmIChhdmF0YXJVcmwpIGRhdGEuYXZhdGFyVXJsID0gYXZhdGFyVXJsO1xuXG4gIC8vIFBhc3N3b3JkIGNoYW5nZSByZXF1aXJlcyBjdXJyZW50UGFzc3dvcmQgKyBuZXdQYXNzd29yZFxuICBpZiAobmV3UGFzc3dvcmQpIHtcbiAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudFBhc3N3b3JkID09PSBuZXdQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJOZXcgcGFzc3dvcmQgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgaXNNYXRjaCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGN1cnJlbnRQYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgICBpZiAoIWlzTWF0Y2gpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjdXJyZW50IHBhc3N3b3JkXCIpO1xuICAgIH1cblxuICAgIGRhdGEucGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICAgIG5ld1Bhc3N3b3JkLFxuICAgICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICAgICk7XG4gICAgZGF0YS50b2tlblZlcnNpb24gPSB7IGluY3JlbWVudDogMSB9O1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBkYXRhLFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBsaXN0IHVzZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0VXNlcnMgPSBhc3luYyAocXVlcnk6IElVc2VyUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgfHwgMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlVzZXJXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLk9SID0gW1xuICAgICAgeyBuYW1lOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICB7IGVtYWlsOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgXTtcbiAgfVxuICBpZiAocXVlcnkucm9sZSkgd2hlcmUucm9sZSA9IHF1ZXJ5LnJvbGU7XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCBbdXNlcnMsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBsaW1pdCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiB1c2VycyxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgcm9sZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVJvbGUgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVJvbGUpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGF3YWl0IHZhbGlkYXRlQWN0aXZlVXNlcihpZCk7XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyByb2xlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHN0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlU3RhdHVzKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHtcbiAgICAgIHN0YXR1cyxcbiAgICAgIC8vIHJlYWN0aXZhdGluZyBwcmVzZXJ2ZXMgdGhlIGFjY291bnQgd2hpbGUgc3VzcGVuZGluZyByZXZva2VzIGFsbCBzZXNzaW9uc1xuICAgICAgLi4uKHN0YXR1cyA9PT0gVXNlclN0YXR1cy5TVVNQRU5ERUQgJiYgeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSksXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogc29mdCBkZWxldGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBkZWxldGVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgZGVsZXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGRlbGV0ZWRVc2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZXJTZXJ2aWNlID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCB1cGRhdGVQcm9maWxlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBuYW1lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgcGhvbmU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGF2YXRhclVybDogei5zdHJpbmcoKS50cmltKCkudXJsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBpbWFnZSBVUkxcIikub3B0aW9uYWwoKSxcbiAgICBjdXJyZW50UGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgbmV3UGFzc3dvcmQ6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZShcbiAgICAoZGF0YSkgPT5cbiAgICAgIGRhdGEubmV3UGFzc3dvcmQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgZGF0YS5jdXJyZW50UGFzc3dvcmQgIT09IHVuZGVmaW5lZCxcbiAgICB7IG1lc3NhZ2U6IFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZCB0byBjaGFuZ2UgcGFzc3dvcmRcIiB9LFxuICApO1xuXG5jb25zdCB1c2VyUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXNlclBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVXNlciBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VSb2xlU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwgeyByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHJvbGVcIiB9KSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUVXBkYXRlUHJvZmlsZVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVByb2ZpbGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVzZXJRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVzZXJRdWVyeVNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCB1c2VyVmFsaWRhdGlvbnMgPSB7XG4gIHVwZGF0ZVByb2ZpbGVTY2hlbWEsXG4gIHVzZXJRdWVyeVNjaGVtYSxcbiAgdXNlclBhcmFtc1NjaGVtYSxcbiAgY2hhbmdlUm9sZVNjaGVtYSxcbiAgY2hhbmdlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgeyB1cGxvYWRzQ29udHJvbGxlciB9IGZyb20gXCIuL3VwbG9hZHMuY29udHJvbGxlclwiO1xuXG5jb25zdCB1cGxvYWQgPSBtdWx0ZXIoe1xuICBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpLFxuICBsaW1pdHM6IHsgZmlsZVNpemU6IDUgKiAxMDI0ICogMTAyNCB9LFxuICBmaWxlRmlsdGVyOiAoX3JlcSwgZmlsZSwgY2IpID0+IHtcbiAgICBpZiAoL15pbWFnZVxcLyhqcGVnfHBuZ3x3ZWJwKSQvLnRlc3QoZmlsZS5taW1ldHlwZSkpIHtcbiAgICAgIGNiKG51bGwsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYihcbiAgICAgICAgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoXCJPbmx5IGpwZywgcG5nIG9yIHdlYnAgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpLCB7XG4gICAgICAgICAgY29kZTogXCJJTlZBTElEX0ZJTEVfVFlQRVwiLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9LFxufSk7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvaW1hZ2VcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdXBsb2FkLnNpbmdsZShcImltYWdlXCIpLFxuICB1cGxvYWRzQ29udHJvbGxlci51cGxvYWRJbWFnZSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSB9IGZyb20gXCIuL3VwbG9hZHMuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBVcGxvYWQgYSBzaW5nbGUgaW1hZ2UgKEFHRU5UL0FETUlOKSBcdTIxOTIgQ2xvdWRpbmFyeVxuY29uc3QgdXBsb2FkSW1hZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoIXJlcS5maWxlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIGZpbGUgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkocmVxLmZpbGUpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiSW1hZ2UgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZHNDb250cm9sbGVyID0ge1xuICB1cGxvYWRJbWFnZSxcbn07IiwgImltcG9ydCB7IHYyIGFzIGNsb3VkaW5hcnkgfSBmcm9tIFwiY2xvdWRpbmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmNsb3VkaW5hcnkuY29uZmlnKHtcbiAgY2xvdWRfbmFtZTogY29uZmlnLmNsb3VkaW5hcnlfY2xvdWRfbmFtZSxcbiAgYXBpX2tleTogY29uZmlnLmNsb3VkaW5hcnlfYXBpX2tleSxcbiAgYXBpX3NlY3JldDogY29uZmlnLmNsb3VkaW5hcnlfYXBpX3NlY3JldCxcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjbG91ZGluYXJ5OyIsICJpbXBvcnQgY2xvdWRpbmFyeSBmcm9tIFwiLi4vLi4vbGliL2Nsb3VkaW5hcnlcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSA9IChcbiAgZmlsZTogRXhwcmVzcy5NdWx0ZXIuRmlsZSxcbik6IFByb21pc2U8eyB1cmw6IHN0cmluZzsgcHVibGljSWQ6IHN0cmluZyB9PiA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgdXBsb2FkU3RyZWFtID0gY2xvdWRpbmFyeS51cGxvYWRlci51cGxvYWRfc3RyZWFtKFxuICAgICAgeyBmb2xkZXI6IFwidHJpcHZlcnNlXCIgfSxcbiAgICAgIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvciB8fCAhcmVzdWx0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgdXBsb2FkIGZhaWxlZC4gUGxlYXNlIHRyeSBhZ2Fpbi5cIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHsgdXJsOiByZXN1bHQuc2VjdXJlX3VybCwgcHVibGljSWQ6IHJlc3VsdC5wdWJsaWNfaWQgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB1cGxvYWRTdHJlYW0uZW5kKGZpbGUuYnVmZmVyKTtcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY29udGFjdENvbnRyb2xsZXIgfSBmcm9tIFwiLi9jb250YWN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNvbnRhY3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NvbnRhY3QudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSByb3V0ZSAocHVibGljLCBubyBhdXRoKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMuY3JlYXRlTWVzc2FnZVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuY3JlYXRlTWVzc2FnZSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RRdWVyeVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuZ2V0TWVzc2FnZXMsXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY29udGFjdFZhbGlkYXRpb25zLnVwZGF0ZVJlc29sdmVkU2NoZW1hLFxuICB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIudXBkYXRlUmVzb2x2ZWQsXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNvbnRhY3RTZXJ2aWNlIH0gZnJvbSBcIi4vY29udGFjdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmNyZWF0ZU1lc3NhZ2UocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzZW50IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IGdldE1lc3NhZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGFjdFNlcnZpY2UubGlzdE1lc3NhZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29udGFjdCBtZXNzYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgdXBkYXRlUmVzb2x2ZWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCB7IGlzUmVzb2x2ZWQgfSA9IHJlcS5ib2R5O1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLnJlc29sdmVNZXNzYWdlKGlkLCBpc1Jlc29sdmVkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGdldE1lc3NhZ2VzLFxuICB1cGRhdGVSZXNvbHZlZCxcbn07IiwgImltcG9ydCB7IFJlc2VuZCB9IGZyb20gXCJyZXNlbmRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRhY3RFbWFpbERldGFpbHMge1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHN1YmplY3Q6IHN0cmluZztcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ/OiBEYXRlO1xufVxuXG4vLyBMYXppbHkgaW5pdGlhbGlzZWQgc28gdGhlIG1vZHVsZSBpcyBpbXBvcnRhYmxlIGV2ZW4gd2hlbiBSRVNFTkRfQVBJX0tFWVxuLy8gaXMgbm90IGNvbmZpZ3VyZWQgKGUuZy4gbG9jYWwgZGV2IC8gZGVtbyB3aXRob3V0IGVtYWlsKS5cbmxldCByZXNlbmQ6IFJlc2VuZCB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRSZXNlbmQoKTogUmVzZW5kIHwgbnVsbCB7XG4gIGlmIChyZXNlbmQpIHJldHVybiByZXNlbmQ7XG4gIGlmICghY29uZmlnLnJlc2VuZF9hcGlfa2V5KSByZXR1cm4gbnVsbDtcbiAgcmVzZW5kID0gbmV3IFJlc2VuZChjb25maWcucmVzZW5kX2FwaV9rZXkpO1xuICByZXR1cm4gcmVzZW5kO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csIFwiJnF1b3Q7XCIpXG4gICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIik7XG59XG5cbmNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IGNyZWF0ZWRBdCA9IGRldGFpbHMuY3JlYXRlZEF0Py50b0lTT1N0cmluZygpID8/IFwianVzdCBub3dcIjtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5OZXcgY29udGFjdCBtZXNzYWdlPC9oMj5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5OYW1lPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPkVtYWlsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMuZW1haWwpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+U3ViamVjdDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWNlaXZlZDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChjcmVhdGVkQXQpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDE2cHg7IHBhZGRpbmc6IDE2cHg7IGJhY2tncm91bmQ6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwO1wiPlxuICAgICAgJHtlc2NhcGVIdG1sKGRldGFpbHMubWVzc2FnZSl9XG4gICAgPC9kaXY+XG4gIGA7XG5cbiAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICBmcm9tLFxuICAgIHRvOiBbY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWxdLFxuICAgIHN1YmplY3Q6IGBOZXcgY29udGFjdCBtZXNzYWdlOiAke2RldGFpbHMuc3ViamVjdH1gLFxuICAgIGh0bWw6IGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICB9KTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IHJlY2VpdmVyRW1haWwgPSBjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbDtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5UaGFua3MgZm9yIHJlYWNoaW5nIG91dCwgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9ITwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgV2UmYXBvczt2ZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgYWJvdXRcbiAgICAgIDxzdHJvbmc+JmxkcXVvOyR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfSZyZHF1bzs8L3N0cm9uZz4gYW5kIG91ciBzdXBwb3J0XG4gICAgICB0ZWFtIHdpbGwgZ2V0IGJhY2sgdG8geW91IHdpdGhpbiBvbmUgYnVzaW5lc3MgZGF5LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICByZXBseVRvOiByZWNlaXZlckVtYWlsLFxuICAgIHN1YmplY3Q6IFwiV2UgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIC0gVHJpcFZlcnNlXCIsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmcm9tID0gY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIjtcbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBzdGF0dXNDb3B5OiBSZWNvcmQ8XG4gICAgQm9va2luZ1N0YXR1cyxcbiAgICB7IHN1YmplY3Q6IHN0cmluZzsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfVxuICA+ID0ge1xuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJXZSd2ZSByZWNlaXZlZCB5b3VyIGJvb2tpbmcgcmVxdWVzdC4gVGhlIGFnZW50IHdpbGwgY29uZmlybSBpdCBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiUGF5bWVudCByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJQYXltZW50IHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgcGF5bWVudCBoYXMgYmVlbiByZWNlaXZlZCwgYW5kIHRoZSBhZ2VudCB3aWxsIGNvbmZpcm0geW91ciBib29raW5nIHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY29uZmlybWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICBib2R5OiBcIkdyZWF0IG5ld3MgXHUyMDE0IHlvdXIgYm9va2luZyBoYXMgYmVlbiBjb25maXJtZWQuIFdlIGxvb2sgZm9yd2FyZCB0byBob3N0aW5nIHlvdSFcIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjYW5jZWxsZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBib29raW5nIGhhcyBiZWVuIGNhbmNlbGxlZC4gSWYgdGhpcyB3YXNuJ3QgZXhwZWN0ZWQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlRyaXAgY29tcGxldGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlRyaXAgY29tcGxldGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgdHJpcCBoYXMgYmVlbiBtYXJrZWQgYXMgY29tcGxldGVkLiBUaGFuayB5b3UgZm9yIHRyYXZlbGxpbmcgd2l0aCBUcmlwVmVyc2UhXCIsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBjb3B5ID0gc3RhdHVzQ29weVtkZXRhaWxzLnN0YXR1c107XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+JHtjb3B5LmhlYWRpbmd9PC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgICR7Y29weS5ib2R5fVxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWxlcnM8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoU3RyaW5nKGRldGFpbHMudHJhdmVsZXJzKSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5Ub3RhbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLnRvdGFsUHJpY2UudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICBzdWJqZWN0OiBjb3B5LnN1YmplY3QsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgc2VuZENvbnRhY3RBdXRvUmVwbHksXG4gIHNlbmRDb250YWN0Tm90aWZpY2F0aW9uLFxufSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IElDb250YWN0UXVlcnksIElDcmVhdGVDb250YWN0UGF5bG9hZCB9IGZyb20gXCIuL2NvbnRhY3QuaW50ZXJmYWNlXCI7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2UgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNvbnRhY3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGNyZWF0ZWRNZXNzYWdlID0gYXdhaXQgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZTogcGF5bG9hZC5uYW1lLFxuICAgICAgZW1haWw6IHBheWxvYWQuZW1haWwsXG4gICAgICBzdWJqZWN0OiBwYXlsb2FkLnN1YmplY3QsXG4gICAgICBtZXNzYWdlOiBwYXlsb2FkLm1lc3NhZ2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRW1haWxzIGFyZSBiZXN0LWVmZm9ydDogYSBmYWlsdXJlIGhlcmUgbXVzdCBuZXZlciBmYWlsIHRoZSBzdWJtaXNzaW9uXG4gIC8vICh0aGUgbWVzc2FnZSBpcyBhbHJlYWR5IHNhdmVkIHRvIHRoZSBpbmJveCkuXG4gIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24oeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gICAgc2VuZENvbnRhY3RBdXRvUmVwbHkoeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gIF0pO1xuXG4gIHJldHVybiBjcmVhdGVkTWVzc2FnZTtcbn07XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyAoYWRtaW4gb25seSwgcGFnaW5hdGVkLCBmaWx0ZXJhYmxlIGJ5IGlzUmVzb2x2ZWQpXG5jb25zdCBsaXN0TWVzc2FnZXMgPSBhc3luYyAocXVlcnk6IElDb250YWN0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkNvbnRhY3RNZXNzYWdlV2hlcmVJbnB1dCB8IHVuZGVmaW5lZCA9XG4gICAgcXVlcnkuaXNSZXNvbHZlZCA9PT0gdW5kZWZpbmVkXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7IGlzUmVzb2x2ZWQ6IHF1ZXJ5LmlzUmVzb2x2ZWQgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIDMuIE1hcmsgYSBjb250YWN0IG1lc3NhZ2UgcmVzb2x2ZWQvdW5yZXNvbHZlZCAoYWRtaW4gb25seSlcbmNvbnN0IHJlc29sdmVNZXNzYWdlID0gYXN5bmMgKGlkOiBzdHJpbmcsIGlzUmVzb2x2ZWQ6IGJvb2xlYW4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jb250YWN0TWVzc2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc1Jlc29sdmVkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RTZXJ2aWNlID0ge1xuICBjcmVhdGVNZXNzYWdlLFxuICBsaXN0TWVzc2FnZXMsXG4gIHJlc29sdmVNZXNzYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlTWVzc2FnZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsIGFkZHJlc3NcIiksXG4gIHN1YmplY3Q6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiU3ViamVjdCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgyMDAsIFwiU3ViamVjdCBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIiksXG4gIG1lc3NhZ2U6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMTAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMDAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IG1vc3QgMjAwMCBjaGFyYWN0ZXJzXCIpLFxufSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNvbnRhY3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgaXNSZXNvbHZlZDogelxuICAgIC5lbnVtKFtcInRydWVcIiwgXCJmYWxzZVwiXSlcbiAgICAub3B0aW9uYWwoKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gKHZhbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogdmFsID09PSBcInRydWVcIikpLFxufSk7XG5cbmNvbnN0IGNvbnRhY3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk1lc3NhZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlUmVzb2x2ZWRTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIGlzUmVzb2x2ZWQ6IHouYm9vbGVhbih7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJpc1Jlc29sdmVkIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gdHlwZW9mIGRhdGEuaXNSZXNvbHZlZCA9PT0gXCJib29sZWFuXCIsIHtcbiAgICBtZXNzYWdlOiBcImlzUmVzb2x2ZWQgbXVzdCBiZSBhIGJvb2xlYW5cIixcbiAgfSk7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZU1lc3NhZ2VTY2hlbWEsXG4gIGNvbnRhY3RRdWVyeVNjaGVtYSxcbiAgY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgdXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYm9va2luZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ib29raW5nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJvb2tpbmdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jvb2tpbmcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gQ3JlYXRlIGJvb2tpbmcgKGN1c3RvbWVyIG9ubHkgXHUyMDE0IGFnZW50cyBzZWxsLCBhZG1pbnMgbWFuYWdlKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmNyZWF0ZUJvb2tpbmcsXG4pO1xuXG4vLyBNeSBib29raW5ncyBcdTIwMTQgb3duIGJvb2tpbmdzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb24gKG93bmVyIGlzIGFsd2F5cyBVU0VSKVxuLy8gTk9URTogcmVnaXN0ZXJlZCBiZWZvcmUgXCIvOmlkXCIgc28gdGhlIHBhcmFtIHJvdXRlIGRvZXNuJ3Qgc3dhbGxvdyBpdC5cbnJvdXRlci5nZXQoXG4gIFwiL215LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldE15Qm9va2luZ3MsXG4pO1xuXG4vLyBBZ2VudCBib29raW5ncyBcdTIwMTQgc2NvcGVkIHRvIHBhY2thZ2VzIHRoZSBhZ2VudCBvd25zXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZ2VudC1ib29raW5nc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWdlbnRCb29raW5ncyxcbik7XG5cbi8vIEJvb2tpbmcgZGV0YWlsIFx1MjAxNCBvd25lciAvIHBhY2thZ2UgYWdlbnQgLyBhZG1pblxucm91dGVyLmdldChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0Qm9va2luZ0RldGFpbCxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBhbGwgYm9va2luZ3NcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWxsQm9va2luZ3MsXG4pO1xuXG4vLyBTdGF0dXMgdHJhbnNpdGlvbiBcdTIwMTQgdmFsaWRhdGVkIGFnYWluc3QgdGhlIHN0YXRlIG1hY2hpbmUgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBib29raW5nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIudXBkYXRlQm9va2luZ1N0YXR1cyxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYm9va2luZ1NlcnZpY2UgfSBmcm9tIFwiLi9ib29raW5nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG5jb25zdCBjcmVhdGVCb29raW5nID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5jcmVhdGVCb29raW5nKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRNeUJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldE15Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRBZ2VudEJvb2tpbmdzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEJvb2tpbmdEZXRhaWwgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRCb29raW5nRGV0YWlsKGlkLCByZXEudXNlciEpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFsbEJvb2tpbmdzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCB1cGRhdGVCb29raW5nU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UudXBkYXRlQm9va2luZ1N0YXR1cyhcbiAgICAgIGlkLFxuICAgICAgcmVxLmJvZHksXG4gICAgICByZXEudXNlciEsXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYm9va2luZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIGdldEFsbEJvb2tpbmdzLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzLCBQYXltZW50U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHtcbiAgSUJvb2tpbmdRdWVyeSxcbiAgSUJvb2tpbmdTZWFyY2hRdWVyeSxcbiAgSUNyZWF0ZUJvb2tpbmcsXG4gIElVcGRhdGVCb29raW5nU3RhdHVzLFxufSBmcm9tIFwiLi9ib29raW5nLmludGVyZmFjZVwiO1xuXG4vLyBBIFBFTkRJTkcgYm9va2luZyBvbGRlciB0aGFuIHRoaXMgaXMgdHJlYXRlZCBhcyBhbiBhYmFuZG9uZWQgY2hlY2tvdXQ6XG4vLyBpdCdzIGF1dG8tY2FuY2VsbGVkIHNvIHRoZSB1c2VyIGNhbiByZWJvb2sgdGhlIHNhbWUgcGFja2FnZStkYXRlLlxuY29uc3QgU1RBTEVfQk9PS0lOR19IT1VSUyA9IDI0O1xuXG5jb25zdCB0b1VUQ01pZG5pZ2h0ID0gKGRhdGU6IERhdGUpID0+XG4gIG5ldyBEYXRlKFxuICAgIERhdGUuVVRDKGRhdGUuZ2V0VVRDRnVsbFllYXIoKSwgZGF0ZS5nZXRVVENNb250aCgpLCBkYXRlLmdldFVUQ0RhdGUoKSksXG4gICk7XG5cbi8vIFx1MjUwMFx1MjUwMCBBY3RvciArIG93bmVyc2hpcCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbnR5cGUgQm9va2luZ0FjdG9yID0geyBpZDogc3RyaW5nOyByb2xlOiBSb2xlIH07XG5cbi8vIFN0cnVjdHVyYWwgc3Vic2V0IFx1MjAxNCBvbmx5IHdoYXQgdGhlIG93bmVyc2hpcCBjaGVja3MgbmVlZC5cbnR5cGUgQm9va2luZ093bmVySW5mbyA9IHtcbiAgdXNlcklkOiBzdHJpbmc7XG4gIHBhY2thZ2U6IHsgYWdlbnRJZDogc3RyaW5nIH07XG59O1xuXG4vLyBCb29raW5nIG93bmVyLCB0aGUgQUdFTlQgd2hvIG93bnMgdGhlIHBhY2thZ2UsIG9yIEFETUlOIFx1MjAxNCBmdWxsIG1hbmFnZSBzY29wZS5cbmNvbnN0IGNhbk1hbmFnZSA9IChib29raW5nOiBCb29raW5nT3duZXJJbmZvLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PlxuICBib29raW5nLnVzZXJJZCA9PT0gYWN0b3IuaWQgfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKSB8fFxuICBhY3Rvci5yb2xlID09PSBSb2xlLkFETUlOO1xuXG4vLyBPbmx5IHRoZSBwYWNrYWdlLW93bmluZyBBR0VOVCBvciBBRE1JTiBjYW4gbW92ZSBhIGJvb2tpbmcncyBtb25leSBzdGF0dXNcbi8vIChQRU5ESU5HXHUyMTkyQ09ORklSTUVELCBDT05GSVJNRURcdTIxOTJDT01QTEVURUQsIENPTkZJUk1FRFx1MjE5MlBFTkRJTkcpLlxuY29uc3QgaXNBZ2VudE93bmVyT3JBZG1pbiA9IChib29raW5nOiBCb29raW5nT3duZXJJbmZvLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PlxuICBhY3Rvci5yb2xlID09PSBSb2xlLkFETUlOIHx8XG4gIChhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZCk7XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0ZSBtYWNoaW5lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBUcmFuc2l0aW9uUnVsZSA9IHtcbiAgYWxsb3dlZDogKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IGJvb2xlYW47XG4gIHJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZD86IGJvb2xlYW47XG4gIGJlZm9yZVRyYXZlbERhdGU/OiBib29sZWFuO1xufTtcblxuY29uc3QgVFJBTlNJVElPTlM6IFBhcnRpYWw8XG4gIFJlY29yZDxCb29raW5nU3RhdHVzLCBQYXJ0aWFsPFJlY29yZDxCb29raW5nU3RhdHVzLCBUcmFuc2l0aW9uUnVsZT4+PlxuPiA9IHtcbiAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7IGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4gfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICB9LFxuICBbQm9va2luZ1N0YXR1cy5QQUlEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHtcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkOiB0cnVlLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgICAgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbixcbiAgICAgIGJlZm9yZVRyYXZlbERhdGU6IHRydWUsXG4gICAgfSxcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZXNwb25zZSBtYXBwaW5nIChEZWNpbWFsIFx1MjE5MiBOdW1iZXIpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgYm9va2luZ1BhY2thZ2VTZWxlY3QgPSB7XG4gIHNlbGVjdDoge1xuICAgIGlkOiB0cnVlLFxuICAgIHRpdGxlOiB0cnVlLFxuICAgIHNsdWc6IHRydWUsXG4gICAgbG9jYXRpb246IHRydWUsXG4gICAgaW1hZ2VzOiB0cnVlLFxuICAgIHByaWNlOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuLy8gRGV0YWlsIHZpZXcgYWRkcyBhZ2VudElkIChuZWVkZWQgYnkgb3duZXJzaGlwIGNoZWNrcyBpbiB0aGUgc2VydmljZSkuXG5jb25zdCBib29raW5nUGFja2FnZURldGFpbFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gICAgYWdlbnRJZDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IGJvb2tpbmdVc2VyU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBQYXltZW50IGxlZGdlciBzaG93biBvbiB0aGUgYm9va2luZyBkZXRhaWwgcGFnZSAoYW1vdW50cyBzdGF5IERlY2ltYWwgaW4gREIpLlxuY29uc3QgYm9va2luZ1BheW1lbnRTZWxlY3QgPSB7XG4gIHNlbGVjdDoge1xuICAgIGlkOiB0cnVlLFxuICAgIHRyYW5JZDogdHJ1ZSxcbiAgICBhbW91bnQ6IHRydWUsXG4gICAgY3VycmVuY3k6IHRydWUsXG4gICAgc3RhdHVzOiB0cnVlLFxuICAgIGNhcmRUeXBlOiB0cnVlLFxuICAgIGJhbmtUcmFuSWQ6IHRydWUsXG4gICAgdmFsSWQ6IHRydWUsXG4gICAgcGFpZEF0OiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxudHlwZSBCb29raW5nV2l0UGFja2FnZSA9IFByaXNtYS5Cb29raW5nR2V0UGF5bG9hZDx7XG4gIGluY2x1ZGU6IHsgcGFja2FnZTogdHlwZW9mIGJvb2tpbmdQYWNrYWdlU2VsZWN0IH07XG59PjtcblxuLy8gUGF5bWVudHMgc2hvdyBvbiBsaXN0IHJvd3MgdG9vIChEb0Q6IFwibGlzdC9kZXRhaWwgbm93IGluY2x1ZGVzIHBheW1lbnRzXCIpLFxuLy8gbWFwcGVkIHRvIE51bWJlciBhdCB0aGUgYm91bmRhcnkgbGlrZSB0aGUgcmVzdCBvZiB0aGUgbW9uZXkgZmllbGRzLlxudHlwZSBCb29raW5nUGF5bWVudEl0ZW0gPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYW5JZDogc3RyaW5nO1xuICBhbW91bnQ6IHVua25vd247XG4gIGN1cnJlbmN5OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjYXJkVHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgYmFua1RyYW5JZDogc3RyaW5nIHwgbnVsbDtcbiAgdmFsSWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhaWRBdDogRGF0ZSB8IG51bGw7XG59O1xuXG5jb25zdCBtYXBCb29raW5nTGlzdCA9IChib29raW5nOiBCb29raW5nV2l0UGFja2FnZSAmIHsgcGF5bWVudHM/OiBCb29raW5nUGF5bWVudEl0ZW1bXSB9KSA9PiAoe1xuICAuLi5ib29raW5nLFxuICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgcGFja2FnZTogeyAuLi5ib29raW5nLnBhY2thZ2UsIHByaWNlOiBOdW1iZXIoYm9va2luZy5wYWNrYWdlLnByaWNlKSB9LFxuICBwYXltZW50czogYm9va2luZy5wYXltZW50cz8ubWFwKChwKSA9PiAoeyAuLi5wLCBhbW91bnQ6IE51bWJlcihwLmFtb3VudCkgfSkpLFxufSk7XG5cbi8vIFx1MjUwMFx1MjUwMCBDcmVhdGUgYm9va2luZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVCb29raW5nKSA9PiB7XG4gIGNvbnN0IHsgcGFja2FnZUlkLCB0cmF2ZWxlcnMgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHRyYXZlbERhdGUgPSB0b1VUQ01pZG5pZ2h0KHBheWxvYWQudHJhdmVsRGF0ZSk7XG5cbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcbiAgaWYgKFxuICAgICF0b3VyUGFja2FnZSB8fFxuICAgIHRvdXJQYWNrYWdlLmlzRGVsZXRlZCB8fFxuICAgIHRvdXJQYWNrYWdlLnN0YXR1cyAhPT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlBhY2thZ2UgaXMgbm90IGF2YWlsYWJsZSBmb3IgYm9va2luZy5cIik7XG4gIH1cblxuICAvLyB0b3RhbFByaWNlIGlzIGNvbXB1dGVkIHNlcnZlci1zaWRlIGZyb20gdGhlIHBhY2thZ2UncyBjdXJyZW50IHByaWNlIFx1MjAxNFxuICAvLyBhbnl0aGluZyB0aGUgY2xpZW50IHNlbmRzIGlzIGlnbm9yZWQuXG4gIGNvbnN0IHRvdGFsUHJpY2UgPSBOdW1iZXIodG91clBhY2thZ2UucHJpY2UpICogdHJhdmVsZXJzO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQsXG4gICAgICAgIHRyYXZlbERhdGUsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBjb25zdCBpc1JlY2VudCA9XG4gICAgICAgIGV4aXN0aW5nLmNyZWF0ZWRBdC5nZXRUaW1lKCkgPj1cbiAgICAgICAgRGF0ZS5ub3coKSAtIFNUQUxFX0JPT0tJTkdfSE9VUlMgKiA2MCAqIDYwICogMTAwMDtcblxuICAgICAgaWYgKGlzUmVjZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICA0MDksXG4gICAgICAgICAgXCJZb3UgYWxyZWFkeSBoYXZlIGEgcGVuZGluZyBib29raW5nIGZvciB0aGlzIHBhY2thZ2Ugb24gdGhpcyBkYXRlLlwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBhYmFuZG9uZWQgY2hlY2tvdXQgXHUyMDE0IGNhbmNlbCBpdCBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbiBhbmQgcmVib29rXG4gICAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBleGlzdGluZy5pZCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7IHVzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlLCB0cmF2ZWxlcnMsIHRvdGFsUHJpY2UgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgXHUyMDE0IG5ldmVyIGZhaWxzIHRoZSByZXF1ZXN0XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0sXG4gIH0pO1xuICBpZiAodXNlcikge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IHRvdXJQYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2UsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmNyZWF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKGNyZWF0ZWQudG90YWxQcmljZSksXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTGlzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcGFnaW5hdGVCb29raW5nID0gYXN5bmMgKFxuICB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0LFxuICBpbmNsdWRlOiBQcmlzbWEuQm9va2luZ0luY2x1ZGUsXG4gIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIE15IGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElCb29raW5nUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHsgdXNlcklkIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50U2VsZWN0IH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFnZW50IGJvb2tpbmdzIChzY29wZWQgdG8gb3duIHBhY2thZ2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBhc3luYyAoXG4gIGFnZW50SWQ6IHN0cmluZyxcbiAgcXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnksXG4pID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHtcbiAgICBwYWNrYWdlOiB7IGFnZW50SWQgfSxcbiAgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHtcbiAgICAgIGFnZW50SWQsXG4gICAgICB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudFNlbGVjdCB9LFxuICAgIHF1ZXJ5LFxuICApO1xuICByZXR1cm4geyAuLi5yZXN1bHQsIGRhdGE6IHJlc3VsdC5kYXRhLm1hcChtYXBCb29raW5nTGlzdCkgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogYWxsIGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWxsQm9va2luZ3MgPSBhc3luYyAocXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHt9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0geyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRTZWxlY3QsXG4gICAgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBkZXRhaWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gYXN5bmMgKGlkOiBzdHJpbmcsIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IHtcbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudFNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gdmlldyB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgcmV0dXJuIG1hcEJvb2tpbmdMaXN0KGJvb2tpbmcpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGFzeW5jIChcbiAgaWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4gIGFjdG9yOiBCb29raW5nQWN0b3IsXG4pID0+IHtcbiAgY29uc3QgeyBzdGF0dXM6IHRvIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlLCB0aXRsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgcnVsZSA9IFRSQU5TSVRJT05TW2Jvb2tpbmcuc3RhdHVzXT8uW3RvXTtcbiAgaWYgKCFydWxlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgYENhbm5vdCB0cmFuc2l0aW9uIGJvb2tpbmcgZnJvbSAke2Jvb2tpbmcuc3RhdHVzfSB0byAke3RvfS5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFydWxlLmFsbG93ZWQoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF5ID0gdG9VVENNaWRuaWdodChib29raW5nLnRyYXZlbERhdGUpLmdldFRpbWUoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKHJ1bGUucmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkICYmIHRyYXZlbERheSA+IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSBjb21wbGV0ZWQgYWZ0ZXIgdGhlIHRyYXZlbCBkYXRlIGhhcyBwYXNzZWQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocnVsZS5iZWZvcmVUcmF2ZWxEYXRlICYmIHRyYXZlbERheSA8PSBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgcmV2ZXJ0ZWQgYmVmb3JlIHRoZSB0cmF2ZWwgZGF0ZS5cIixcbiAgICApO1xuICB9XG5cbiAgLy8gY29tcGFyZS1hbmQtc2V0OiB0aGUgdHJhbnNpdGlvbiBhcHBsaWVzIG9ubHkgaWYgdGhlIHJlY29yZGVkIHN0YXR1cyBzdGlsbFxuICAvLyBtYXRjaGVzIFx1MjAxNCBhIGNvbmN1cnJlbnQgY2hhbmdlIG1ha2VzIGNvdW50IDAgYW5kIHRoZSByZXF1ZXN0IGZhaWxzIHNhZmVseS5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkLCBzdGF0dXM6IGJvb2tpbmcuc3RhdHVzIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogdG8gfSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwOSxcbiAgICAgICAgXCJCb29raW5nIHN0YXR1cyBjaGFuZ2VkIGNvbmN1cnJlbnRseS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsbGluZyBhIHBhaWQgYm9va2luZyBtYXJrcyBpdHMgbW9uZXkgYXMgcmV0dXJuZWQgKFJFRlVOREVEIGZsYWcgXHUyMDE0XG4gICAgLy8gdGhlIGFjdHVhbCB0cmFuc2ZlciBpcyBvdXQgb2Ygc2NvcGUpLiBBYmFuZG9uZWQgc2Vzc2lvbnMgYXJlIGNhbmNlbGxlZC5cbiAgICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCB9LFxuICAgICAgfSk7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIH0pO1xuXG4gIGlmICghdXBkYXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgZm9yIG1vbmV5LXN0YXR1cyBjaGFuZ2VzXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQgfHwgdG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnM6IGJvb2tpbmcudHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgICAgICAgc3RhdHVzOiB0byxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4udXBkYXRlZCwgdG90YWxQcmljZTogTnVtYmVyKHVwZGF0ZWQudG90YWxQcmljZSkgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBib29raW5nU2VydmljZSA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG4gIHRyYXZlbERhdGU6IHouY29lcmNlLmRhdGUoe1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbCBkYXRlIGlzIHJlcXVpcmVkXCIsXG4gICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlRyYXZlbCBkYXRlIG11c3QgYmUgYSB2YWxpZCBkYXRlXCIsXG4gIH0pLnJlZmluZShcbiAgICAoZGF0ZSkgPT4ge1xuICAgICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgdHJhdmVsRGF5ID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgdG9kYXlVVEMgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gdHJhdmVsRGF5LmdldFRpbWUoKSA+PSB0b2RheVVUQy5nZXRUaW1lKCk7XG4gICAgfSxcbiAgICB7IG1lc3NhZ2U6IFwiVHJhdmVsIGRhdGUgY2Fubm90IGJlIGluIHRoZSBwYXN0LlwiIH0sXG4gICksXG4gIHRyYXZlbGVyczogelxuICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWxlcnMgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5pbnQoXCJUcmF2ZWxlcnMgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgIC5taW4oMSwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgLm1heCgyMCwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBtb3N0IDIwXCIpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgYm9va2luZ1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IGJvb2tpbmdRdWVyeVNjaGVtYS5leHRlbmQoe1xuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVENyZWF0ZUJvb2tpbmdTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjcmVhdGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVcGRhdGVTdGF0dXNTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVTdGF0dXNTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gIGJvb2tpbmdRdWVyeVNjaGVtYSxcbiAgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcmV2aWV3Q29udHJvbGxlciB9IGZyb20gXCIuL3Jldmlldy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyByZXZpZXdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3Jldmlldy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy5jcmVhdGVSZXZpZXdTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuY3JlYXRlUmV2aWV3LFxuKTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYylcbnJvdXRlci5nZXQoXG4gIFwiL3BhY2thZ2UvOnBhY2thZ2VJZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdRdWVyeVNjaGVtYSxcbiAgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZ2V0UGFja2FnZVJldmlld3MsXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Um91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyByZXZpZXdTZXJ2aWNlIH0gZnJvbSBcIi4vcmV2aWV3LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiBvbmx5KVxuY29uc3QgY3JlYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5jcmVhdGVSZXZpZXcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgc3VibWl0dGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgcGFja2FnZSByZXZpZXdzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldFBhY2thZ2VSZXZpZXdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmxpc3RQYWNrYWdlUmV2aWV3cyhwYWNrYWdlSWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdDb250cm9sbGVyID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGdldFBhY2thZ2VSZXZpZXdzLFxufTtcbiIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgSUNyZWF0ZVJldmlld1BheWxvYWQsIElSZXZpZXdRdWVyeSB9IGZyb20gXCIuL3Jldmlldy5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpIFx1MjAxNCBnYXRlZCwgdW5pcXVlIHBlciB1c2VyK3BhY2thZ2UsIGFuZFxuLy8gICAgcmVjYWxjdWxhdGVzIHRoZSBwYWNrYWdlIHJhdGluZyBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IGNyZWF0ZVJldmlldyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZVJldmlld1BheWxvYWQpID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgLy8gUGFja2FnZSBtdXN0IGV4aXN0LCBiZSBhcHByb3ZlZCwgYW5kIG5vdCBiZSBkZWxldGVkIFx1MjAxNCBhIHJldmlldyBvZiBhXG4gICAgLy8gcGVuZGluZy9yZWplY3RlZC9kZWxldGVkIHBhY2thZ2UgaXMgbm9uc2Vuc2UuXG4gICAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICAvLyBObyBzZWxmLXJldmlldyBcdTIwMTQgYW4gYWdlbnQgcmF0aW5nIHRoZWlyIG93biBwYWNrYWdlIGlzIGEgY29uZmxpY3Qgb2YgaW50ZXJlc3QuXG4gICAgaWYgKHRvdXJQYWNrYWdlLmFnZW50SWQgPT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2Fubm90IHJldmlldyB5b3VyIG93biBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGN1c3RvbWVycyB3aXRoIGEgY29tcGxldGVkIGJvb2tpbmcgbWF5IHJldmlldy5cbiAgICBjb25zdCBjb21wbGV0ZWRCb29raW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVELFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb21wbGV0ZWRCb29raW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgY2FuIG9ubHkgcmV2aWV3IGEgcGFja2FnZSBhZnRlciBjb21wbGV0aW5nIGEgYm9va2luZy5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRnJpZW5kbHkgZHVwbGljYXRlIGNoZWNrIFx1MjAxNCBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKSBiYWNrc3RvcHMgYW55XG4gICAgLy8gcmFjZSB2aWEgUDIwMDIgKG1hcHBlZCB0byA0MDkgYnkgdGhlIGdsb2JhbCBoYW5kbGVyKS5cbiAgICBjb25zdCBleGlzdGluZ1JldmlldyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1Jldmlldykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJZb3UgaGF2ZSBhbHJlYWR5IHJldmlld2VkIHRoaXMgcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlZFJldmlldyA9IGF3YWl0IHR4LnJldmlldy5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHJhdGluZzogcGF5bG9hZC5yYXRpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSZWNvbXB1dGUgdGhlIHBhY2thZ2UgcmF0aW5nIGZyb20gYWxsIG9mIGl0cyByZXZpZXdzLCByb3VuZGVkIHRvIG9uZVxuICAgIC8vIGRlY2ltYWwsIGluc2lkZSB0aGUgc2FtZSB0cmFuc2FjdGlvbiBzbyBhIHN0YWxlIGF2ZXJhZ2UgaXMgbmV2ZXIgd3JpdHRlbi5cbiAgICBjb25zdCB7IF9hdmcgfSA9IGF3YWl0IHR4LnJldmlldy5hZ2dyZWdhdGUoe1xuICAgICAgd2hlcmU6IHsgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhdGluZyA9IE1hdGgucm91bmQoKF9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTA7XG5cbiAgICBhd2FpdCB0eC50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBkYXRhOiB7IHJhdGluZyB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiBjcmVhdGVkUmV2aWV3LCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKSBcdTIwMTQgcGFnaW5hdGVkOyB0aGUgcGFja2FnZSBtdXN0IGJlXG4vLyAgICBhcHByb3ZlZCBhbmQgbm90IGRlbGV0ZWQgc28gdW5wdWJsaXNoZWQgcGFja2FnZSByZXZpZXdzIG5ldmVyIGxlYWsuXG5jb25zdCBsaXN0UGFja2FnZVJldmlld3MgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBxdWVyeTogSVJldmlld1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEucmV2aWV3LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IHBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICByYXRpbmc6IHRydWUsXG4gICAgICAgIGNvbW1lbnQ6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5yZXZpZXcuY291bnQoeyB3aGVyZTogeyBwYWNrYWdlSWQgfSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcmV2aWV3U2VydmljZSA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBsaXN0UGFja2FnZVJldmlld3MsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJSYXRpbmcgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCByZXZpZXdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCByZXZpZXdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3UGFyYW1zU2NoZW1hLFxuICByZXZpZXdRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNhdGVnb3J5Q29udHJvbGxlciB9IGZyb20gXCIuL2NhdGVnb3J5LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNhdGVnb3J5VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jYXRlZ29yeS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBMaXN0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIuZ2V0KFwiL1wiLCBjYXRlZ29yeUNvbnRyb2xsZXIuZ2V0QWxsQ2F0ZWdvcmllcyk7XG5cbi8vIDIuIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5jcmVhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLnVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLnVwZGF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gNC4gRGVsZXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5kZWxldGVDYXRlZ29yeSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNhdGVnb3J5U2VydmljZSB9IGZyb20gXCIuL2NhdGVnb3J5LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZUNhdGVnb3J5KHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZ2V0QWxsQ2F0ZWdvcmllcygpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBjYXRlZ29yaWVzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcmllcyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS51cGRhdGVDYXRlZ29yeShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmRlbGV0ZUNhdGVnb3J5KGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlDb250cm9sbGVyID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiLy8gQmFuZ2xhIChCZW5nYWxpKSBcdTIxOTIgTGF0aW4gY29uc29uYW50L3Zvd2VsIG1hcCwgYXBwbGllZCBiZWZvcmUga2ViYWItY2FzaW5nIHNvXG4vLyBCYW5nbGEtaGVhdnkgdGl0bGVzIHN0aWxsIHByb2R1Y2UgcmVhZGFibGUgc2x1Z3MgaW5zdGVhZCBvZiBiZWluZyBzdHJpcHBlZCB0b1xuLy8gYW4gZW1wdHkgc3RyaW5nLlxuY29uc3QgQkFOR0xBX1RPX0xBVElOOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcdTA5ODU6IFwib1wiLFxuICBcdTA5ODY6IFwiYVwiLFxuICBcdTA5ODc6IFwiaVwiLFxuICBcdTA5ODg6IFwiaVwiLFxuICBcdTA5ODk6IFwidVwiLFxuICBcdTA5OEE6IFwidVwiLFxuICBcdTA5OEI6IFwicmlcIixcbiAgXHUwOThGOiBcImVcIixcbiAgXHUwOTkwOiBcIm9pXCIsXG4gIFx1MDk5MzogXCJvXCIsXG4gIFx1MDk5NDogXCJvdVwiLFxuICBcdTA5OTU6IFwia2FcIixcbiAgXHUwOTk2OiBcImtoYVwiLFxuICBcdTA5OTc6IFwiZ2FcIixcbiAgXHUwOTk4OiBcImdoYVwiLFxuICBcdTA5OTk6IFwibmdhXCIsXG4gIFx1MDk5QTogXCJjaGFcIixcbiAgXHUwOTlCOiBcImNoaGFcIixcbiAgXHUwOTlDOiBcImphXCIsXG4gIFx1MDk5RDogXCJqaGFcIixcbiAgXHUwOTlFOiBcIm55YVwiLFxuICBcdTA5OUY6IFwidGFcIixcbiAgXHUwOUEwOiBcInRoYVwiLFxuICBcdTA5QTE6IFwiZGFcIixcbiAgXHUwOUEyOiBcImRoYVwiLFxuICBcdTA5QTM6IFwibmFcIixcbiAgXHUwOUE0OiBcInRhXCIsXG4gIFx1MDlBNTogXCJ0aGFcIixcbiAgXHUwOUE2OiBcImRhXCIsXG4gIFx1MDlBNzogXCJkaGFcIixcbiAgXHUwOUE4OiBcIm5hXCIsXG4gIFx1MDlBQTogXCJwYVwiLFxuICBcdTA5QUI6IFwicGhhXCIsXG4gIFx1MDlBQzogXCJiYVwiLFxuICBcdTA5QUQ6IFwiYmhhXCIsXG4gIFx1MDlBRTogXCJtYVwiLFxuICBcdTA5QUY6IFwieWFcIixcbiAgXHUwOUIwOiBcInJhXCIsXG4gIFx1MDlCMjogXCJsYVwiLFxuICBcdTA5QjY6IFwic2hhXCIsXG4gIFx1MDlCNzogXCJzaGFcIixcbiAgXHUwOUI4OiBcInNhXCIsXG4gIFx1MDlCOTogXCJoYVwiLFxuICBcdTA5QTFcdTA5QkM6IFwicmFcIixcbiAgXHUwOUEyXHUwOUJDOiBcInJoYVwiLFxuICBcdTA5QUZcdTA5QkM6IFwieWFcIixcbiAgXCJcdTA5ODJcIjogXCJuZ1wiLFxuICBcIlx1MDk4M1wiOiBcImhcIixcbiAgXCJcdTA5ODFcIjogXCJcIixcbiAgXCJcdTA5Q0RcIjogXCJcIixcbiAgXCJcdTA5QzdcIjogXCJlXCIsXG4gIFwiXHUwOUM4XCI6IFwib2lcIixcbiAgXCJcdTA5Q0JcIjogXCJvXCIsXG4gIFwiXHUwOUNDXCI6IFwib3VcIixcbiAgXCJcdTA5QkVcIjogXCJhXCIsXG4gIFwiXHUwOUJGXCI6IFwiaVwiLFxuICBcIlx1MDlDMFwiOiBcImlcIixcbiAgXCJcdTA5QzFcIjogXCJ1XCIsXG4gIFwiXHUwOUMyXCI6IFwidVwiLFxuICBcIlx1MDlDM1wiOiBcInJpXCIsXG59O1xuXG5jb25zdCB0cmFuc2xpdGVyYXRlID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuICBbLi4udGV4dF0ubWFwKChjaGFyKSA9PiBCQU5HTEFfVE9fTEFUSU5bY2hhcl0gPz8gY2hhcikuam9pbihcIlwiKTtcblxuLy8gU2hhcmVkIGtlYmFiLWNhc2Ugc2x1Z2lmaWVyIHVzZWQgYnkgQ2F0ZWdvcnkgYW5kIFRvdXJQYWNrYWdlIHNsdWdzLiBOb24tTGF0aW5cbi8vIHNjcmlwdHMgKGUuZy4gQmFuZ2xhKSBhcmUgdHJhbnNsaXRlcmF0ZWQgZmlyc3Q7IGlmIHRoZSByZXN1bHQgaXMgc3RpbGwgZW1wdHlcbi8vIHRoZSBjYWxsZXIgbWF5IHN1cHBseSBhIGBmYWxsYmFja2AgKGUuZy4gXCJwYWNrYWdlLTxzaG9ydElkPlwiKS5cbmV4cG9ydCBjb25zdCBzbHVnaWZ5ID0gKHRleHQ6IHN0cmluZywgZmFsbGJhY2s/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBzbHVnID0gdHJhbnNsaXRlcmF0ZSh0ZXh0KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bXlxcd1xccy1dL2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1tcXHNfLV0rL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gIHJldHVybiBzbHVnIHx8IGZhbGxiYWNrIHx8IFwiXCI7XG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ2F0ZWdvcnksIElVcGRhdGVDYXRlZ29yeSB9IGZyb20gXCIuL2NhdGVnb3J5LmludGVyZmFjZVwiO1xuXG4vLyBGcmllbmRseSA0MDkgZm9yIEB1bmlxdWUgY29uZmxpY3RzIChuYW1lIG9yIHNsdWcpIGluc3RlYWQgb2YgYSByYXcgUDIwMDIuXG4vLyBleGNsdWRlSWQgbGV0cyB1cGRhdGVzIHNraXAgdGhlIHZlcnkgcm93IGJlaW5nIGVkaXRlZCBzbyBhIG5vLW9wIHJlbmFtZVxuLy8gZG9lc24ndCBmYWxzZS00MDkgYWdhaW5zdCBpdHNlbGYuXG5jb25zdCBhc3NlcnROYW1lQXZhaWxhYmxlID0gYXN5bmMgKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgZXhjbHVkZUlkPzogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBuYW1lIH0sIHsgc2x1ZyB9XSxcbiAgICAgIC4uLihleGNsdWRlSWQgPyB7IE5PVDogeyBpZDogZXhjbHVkZUlkIH0gfSA6IHt9KSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoZXhpc3RpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkEgY2F0ZWdvcnkgd2l0aCB0aGlzIG5hbWUgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cbn07XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuY3JlYXRlKHtcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYykgd2l0aCBjb3VudHMgb2YgYXBwcm92ZWQsIG5vbi1kZWxldGVkIHBhY2thZ2VzXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICBvcmRlckJ5OiB7IG5hbWU6IFwiYXNjXCIgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBfY291bnQ6IHtcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgcGFja2FnZXM6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59O1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgbmFtZSAocmVnZW5lcmF0ZXMgc2x1ZykgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcsIGNhdGVnb3J5SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pIFx1MjAxNCA0MDkgd2hlbiBhbnkgcGFja2FnZSByZWZlcmVuY2VzIGl0XG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcblxuICBjb25zdCBwYWNrYWdlQ291bnQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY291bnQoe1xuICAgIHdoZXJlOiB7IGNhdGVnb3J5SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBhY2thZ2VDb3VudCA+IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIkNhbm5vdCBkZWxldGUgY2F0ZWdvcnkgd2l0aCBhc3NvY2lhdGVkIHBhY2thZ2VzLiBSZW5hbWUgaXQgaW5zdGVhZC5cIixcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmRlbGV0ZSh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlTZXJ2aWNlID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgbmFtZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IG5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjcmVhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNhdGVnb3J5UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIHVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICBjYXRlZ29yeVBhcmFtc1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYWNrYWdlQ29udHJvbGxlciB9IGZyb20gXCIuL3BhY2thZ2UuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGFja2FnZVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGFja2FnZS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBNeSBwYWNrYWdlcyAoYWdlbnQpIFx1MjAxNCBzZWxmLXByZXZpZXcgb2YgUEVORElORy9SRUpFQ1RFRCBiZWZvcmUgYXBwcm92YWxcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL215LXBhY2thZ2VzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldE15UGFja2FnZXMsXG4pO1xuXG4vLyAyLiBBbGwgcGFja2FnZXMgKGFkbWluIG1vZGVyYXRpb24gVUkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0QWxsUGFja2FnZXMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFBhY2thZ2VCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcGFja2FnZSAoYWdlbnQgY3JlYXRlcyBvd247IGFkbWluIGNhbiBjcmVhdGUgZm9yIGFueSBhZ2VudClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLmNyZWF0ZVBhY2thZ2VTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNyZWF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA1LiBBcHByb3ZlL3JlamVjdCBwYWNrYWdlIChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNoYW5nZVBhY2thZ2VTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVQYWNrYWdlU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIudXBkYXRlUGFja2FnZSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5zb2Z0RGVsZXRlUGFja2FnZSxcbik7XG5cbi8vIDguIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBrZXB0IGxhc3Qgc28gbm9uZSBvZiB0aGUgYWJvdmUgcm91dGVzIGFyZSBzaGFkb3dlZFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQdWJsaWNQYWNrYWdlcyxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcGFja2FnZVNlcnZpY2UgfSBmcm9tIFwiLi9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jcmVhdGVQYWNrYWdlKHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIGFkbWluIGFwcHJvdmFsLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoZmlsdGVycyArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFB1YmxpY1BhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQYWNrYWdlQnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRBbGxQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIE15IHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldE15UGFja2FnZXModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIllvdXIgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UudXBkYXRlUGFja2FnZShyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIENoYW5nZSBwYWNrYWdlIHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBhcHByb3ZlL3JlamVjdClcbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jaGFuZ2VQYWNrYWdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgcGFja2FnZVNlcnZpY2Uuc29mdERlbGV0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSUludGVybmFsUGFja2FnZVF1ZXJ5LFxuICBJUGFja2FnZVF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL3BhY2thZ2UuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVByaWNlID0gPFQgZXh0ZW5kcyB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9Pihyb3c6IFQpOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcHJpY2U6IE51bWJlcihyb3cucHJpY2UpLFxufSk7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYWdlbnQncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwuXG5jb25zdCBwdWJsaWNQYWNrYWdlSW5jbHVkZSA9IHtcbiAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgdmFsaWRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFjYXRlZ29yeSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjYXRlZ29yeUlkXCIpO1xuICB9XG59O1xuXG4vLyBQYWNrYWdlcyBtdXN0IGJlIG93bmVkIGJ5IGEgbGl2ZSBBR0VOVCBcdTIwMTQgb3RoZXJ3aXNlIHRoZSBib29raW5nIHN0YXRlXG4vLyBtYWNoaW5lJ3MgXCJBR0VOVCAob3ducyBwYWNrYWdlKVwiIGJyYW5jaCBhbmQgYWdlbnQtYm9va2luZ3Mgc2NvcGluZyBicmVhay5cbmNvbnN0IHZhbGlkYXRlQWdlbnQgPSBhc3luYyAoYWdlbnRJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGFnZW50ID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGFnZW50SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHJvbGU6IHRydWUsIGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWFnZW50IHx8IGFnZW50LnJvbGUgIT09IFJvbGUuQUdFTlQgfHwgYWdlbnQuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGFnZW50SWRcIik7XG4gIH1cbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYHBhY2thZ2UtPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYHBhY2thZ2UtJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwYWNrYWdlIChBR0VOVC9BRE1JTikuIE5ldyBwYWNrYWdlcyBzdGFydCBQRU5ESU5HIGFuZCBuZXZlciBsZWFrXG4vLyAgICBpbnRvIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIGFwcHJvdmVzIHRoZW0uXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBhY2thZ2VQYXlsb2FkKSA9PiB7XG4gIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcblxuICAvLyBBRE1JTiBtYXkgY3JlYXRlIG9uIGJlaGFsZiBvZiBhbiBhZ2VudCAob3B0aW9uYWwgYWdlbnRJZCk7IEFHRU5UIGFsd2F5c1xuICAvLyBvd25zIHdoYXQgdGhleSBjcmVhdGUgYW5kIG1heSBub3QgaW1wZXJzb25hdGUgYW5vdGhlciB1c2VyLlxuICBsZXQgYWdlbnRJZDogc3RyaW5nO1xuICBpZiAodXNlci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgYXdhaXQgdmFsaWRhdGVBZ2VudChwYXlsb2FkLmFnZW50SWQpO1xuICAgICAgYWdlbnRJZCA9IHBheWxvYWQuYWdlbnRJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiYWdlbnRJZCBjYW4gb25seSBiZSBzZXQgYnkgYW4gYWRtaW5cIik7XG4gICAgfVxuICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICB9XG5cbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbixcbiAgICAgIGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uLFxuICAgICAgcHJpY2U6IHBheWxvYWQucHJpY2UsXG4gICAgICBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbixcbiAgICAgIGNhdGVnb3J5SWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCxcbiAgICAgIGltYWdlczogcGF5bG9hZC5pbWFnZXMsXG4gICAgICBhZ2VudElkLFxuICAgICAgc2x1ZyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UoY3JlYXRlZCk7XG59O1xuXG4vLyAyLiBQdWJsaWMgZXhwbG9yZWQgbGlzdGluZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBmaWx0ZXJzICsgc29ydGluZy5cbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgZmlsdGVyczogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dFtdID0gW107XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBPUjogW1xuICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgZGVzY3JpcHRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubG9jYXRpb24pIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LmxvY2F0aW9uLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCB8fCBxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIHByaWNlOiB7XG4gICAgICAgIC4uLihxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkID8geyBndGU6IHF1ZXJ5Lm1pblByaWNlIH0gOiB7fSksXG4gICAgICAgIC4uLihxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkID8geyBsdGU6IHF1ZXJ5Lm1heFByaWNlIH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5SYXRpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IHJhdGluZzogeyBndGU6IHF1ZXJ5Lm1pblJhdGluZyB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5tYXhEdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgZHVyYXRpb246IHsgbHRlOiBxdWVyeS5tYXhEdXJhdGlvbiB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5jYXRlZ29yeSkge1xuICAgIGZpbHRlcnMucHVzaCh7IGNhdGVnb3J5OiB7IHNsdWc6IHF1ZXJ5LmNhdGVnb3J5IH0gfSk7XG4gIH1cblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICBBTkQ6IGZpbHRlcnMubGVuZ3RoID4gMCA/IGZpbHRlcnMgOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwibmV3ZXN0XCIgPyBcImRlc2NcIiA6IFwiYXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5Ub3VyUGFja2FnZU9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogc29ydE9yZGVyIH0sXG4gICAgcHJpY2U6IHsgcHJpY2U6IHNvcnRPcmRlciB9LFxuICAgIHJhdGluZzogeyByYXRpbmc6IHNvcnRPcmRlciB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHRvdXJQYWNrYWdlKTtcbn07XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcnMpLlxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgICAuLi4ocXVlcnkuYWdlbnRJZCA/IHsgYWdlbnRJZDogcXVlcnkuYWdlbnRJZCB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNS4gQW4gYWdlbnQncyBvd24gcGFja2FnZXMgKGFueSBzdGF0dXMpIFx1MjAxNCBzZWxmLXByZXZpZXcgYmVmb3JlIGFwcHJvdmFsLlxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwYWNrYWdlcy5cbmNvbnN0IGZpbmRPd25lZFBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgdG91clBhY2thZ2UuYWdlbnRJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwYWNrYWdlcy5cIik7XG4gIH1cblxuICByZXR1cm4gdG91clBhY2thZ2U7XG59O1xuXG4vLyA2LiBVcGRhdGUgYSBwYWNrYWdlLiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gUEVORElORzsgQURNSU4gZWRpdHMgcHJlc2VydmUgaXQuXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgaWYgKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmxvY2F0aW9uICE9PSB1bmRlZmluZWQgPyB7IGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQucHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgcHJpY2U6IHBheWxvYWQucHJpY2UgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmltYWdlcyAhPT0gdW5kZWZpbmVkID8geyBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY2F0ZWdvcnk6IHsgY29ubmVjdDogeyBpZDogcGF5bG9hZC5jYXRlZ29yeUlkIH0gfSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuUEVORElORyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gNy4gQXBwcm92ZS9yZWplY3QgYSBwYWNrYWdlIChhZG1pbikuXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKHRvdXJQYWNrYWdlLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwYWNrYWdlLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDguIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICByZXR1cm4gcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VTZXJ2aWNlID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZGVzY3JpcHRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJEZXNjcmlwdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAwMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgbG9jYXRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJMb2NhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgcHJpY2VTY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJQcmljZSBpcyByZXF1aXJlZFwiIH0pXG4gIC5wb3NpdGl2ZShcIlByaWNlIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIilcbiAgLnJlZmluZSgodmFsKSA9PiBNYXRoLnJvdW5kKHZhbCAqIDEwMCkgLyAxMDAgPT09IHZhbCwge1xuICAgIG1lc3NhZ2U6IFwiUHJpY2UgbXVzdCBoYXZlIGF0IG1vc3QgMiBkZWNpbWFsIHBsYWNlc1wiLFxuICB9KTtcblxuY29uc3QgZHVyYXRpb25TY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJEdXJhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC5pbnQoXCJEdXJhdGlvbiBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyIG9mIGRheXNcIilcbiAgLm1pbigxLCBcIkR1cmF0aW9uIG11c3QgYmUgYXQgbGVhc3QgMSBkYXlcIik7XG5cbmNvbnN0IGNhdGVnb3J5SWRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gIC5taW4oMSwgXCJDYXRlZ29yeSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKTtcblxuY29uc3QgaW1hZ2VzU2NoZW1hID0gelxuICAuYXJyYXkoei5zdHJpbmcoKS51cmwoXCJFYWNoIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIikpXG4gIC5taW4oMSwgXCJBdCBsZWFzdCBvbmUgaW1hZ2UgaXMgcmVxdWlyZWRcIilcbiAgLm1heCg2LCBcIkF0IG1vc3QgNiBpbWFnZXMgYXJlIGFsbG93ZWRcIik7XG5cbmNvbnN0IGNyZWF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEsXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEsXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYSxcbiAgICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwYWNrYWdlUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5OiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbWluUHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtYXhQcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1pblJhdGluZzogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm1heCg1KS5vcHRpb25hbCgpLFxuICAgIG1heER1cmF0aW9uOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHpcbiAgICAgIC5lbnVtKFtcIm5ld2VzdFwiLCBcInByaWNlXCIsIFwicmF0aW5nXCIsIFwidGl0bGVcIl0pXG4gICAgICAuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKChkYXRhKSA9PiB7XG4gICAgaWYgKGRhdGEubWluUHJpY2UgIT09IHVuZGVmaW5lZCAmJiBkYXRhLm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBkYXRhLm1pblByaWNlIDw9IGRhdGEubWF4UHJpY2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LCB7XG4gICAgbWVzc2FnZTogXCJtaW5QcmljZSBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBtYXhQcmljZVwiLFxuICAgIHBhdGg6IFtcIm1pblByaWNlXCJdLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogelxuICAgIC5lbnVtKFtcIlBFTkRJTkdcIiwgXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiUEVORElOR1wiIHwgXCJBUFBST1ZFRFwiIHwgXCJSRUpFQ1RFRFwiKVxuICAgIC5vcHRpb25hbCgpLFxuICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIEFQUFJPVkVEIG9yIFJFSkVDVEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUGFja2FnZVNjaGVtYSxcbiAgdXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgcGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgcGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBibG9nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2cuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYmxvZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBBbGwgcG9zdHMgKGFkbWluIG1vZGVyYXRpb24gVUkpIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldEFsbFBvc3RzLFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLnB1YmxpY1F1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQdWJsaWNQb3N0cyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UG9zdEJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwb3N0IChhZ2VudC9hZG1pbiBhdXRob3JzIG93biBwb3N0czsgbmV3IHBvc3RzIHN0YXJ0IERSQUZUKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBibG9nVmFsaWRhdGlvbnMuY3JlYXRlUG9zdFNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY3JlYXRlUG9zdCxcbik7XG5cbi8vIDUuIFB1Ymxpc2gvdW5wdWJsaXNoIHBvc3QgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY2hhbmdlUG9zdFN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpIFx1MjAxNCBhZ2VudCBlZGl0cyByZXNldCB0byBEUkFGVFxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVQb3N0U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIudXBkYXRlUG9zdCxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5zb2Z0RGVsZXRlUG9zdCxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nUm91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nU2VydmljZSB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNyZWF0ZVBvc3QocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgcHVibGlzaGluZy5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKHNlYXJjaCArIHNvcnQgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQdWJsaWNQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UG9zdEJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcG9zdHMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0QWxsUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBVcGRhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UudXBkYXRlUG9zdChyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIENoYW5nZSBwb3N0IHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBwdWJsaXNoL3VucHVibGlzaClcbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jaGFuZ2VQb3N0U3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgYmxvZ1NlcnZpY2Uuc29mdERlbGV0ZVBvc3QocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBvc3RQYXlsb2FkLFxuICBJSW50ZXJuYWxQb3N0UXVlcnksXG4gIElQb3N0UXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBvc3RQYXlsb2FkLFxuICBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL2Jsb2cuaW50ZXJmYWNlXCI7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYXV0aG9yJ3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsL3JvbGUuXG5jb25zdCBwdWJsaWNBdXRob3JTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0sXG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBibG9nLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBibG9nLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcG9zdCAoQUdFTlQvQURNSU4pLiBOZXcgcG9zdHMgc3RhcnQgRFJBRlQgYW5kIG5ldmVyIGxlYWsgaW50b1xuLy8gICAgcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBjcmVhdGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBvc3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZXhjZXJwdDogcGF5bG9hZC5leGNlcnB0LFxuICAgICAgY29udGVudDogcGF5bG9hZC5jb250ZW50LFxuICAgICAgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlLFxuICAgICAgc2x1ZyxcbiAgICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDIuIFB1YmxpYyBibG9nIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHksIHNlYXJjaCArIHNvcnQuXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGFzeW5jIChxdWVyeTogSVBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc2VhcmNoXG4gICAgICA/IHtcbiAgICAgICAgICBPUjogW1xuICAgICAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgICAgeyBleGNlcnB0OiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfVxuICAgICAgOiB7fSksXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwib2xkZXN0XCIgPyBcImFzY1wiIDogXCJkZXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5CbG9nUG9zdE9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICBvbGRlc3Q6IHsgY3JlYXRlZEF0OiBcImFzY1wiIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHRpdGxlOiB0cnVlLFxuICAgICAgICBzbHVnOiB0cnVlLFxuICAgICAgICBleGNlcnB0OiB0cnVlLFxuICAgICAgICBjb3ZlckltYWdlOiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QsXG4gICAgICB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdDtcbn07XG5cbi8vIDQuIEFsbCBwb3N0cyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcikuXG5jb25zdCBnZXRBbGxQb3N0cyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwb3N0cy5cbmNvbnN0IGZpbmRPd25lZFBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHBvc3QuYXV0aG9ySWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcG9zdHMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA1LiBVcGRhdGUgYSBwb3N0LiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gRFJBRlQgKHJlLXB1Ymxpc2ggdmlhIC86aWQvc3RhdHVzKTtcbi8vICAgIEFETUlOIGVkaXRzIHByZXNlcnZlIHN0YXR1cy5cbmNvbnN0IHVwZGF0ZVBvc3QgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0UGF5bG9hZCxcbikgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLkJsb2dQb3N0VXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5leGNlcnB0ICE9PSB1bmRlZmluZWQgPyB7IGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvbnRlbnQgIT09IHVuZGVmaW5lZCA/IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY292ZXJJbWFnZSAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlIH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUG9zdFN0YXR1cy5EUkFGVCB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNi4gUHVibGlzaC91bnB1Ymxpc2ggYSBwb3N0IChhZG1pbikuXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gYXN5bmMgKFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBvc3QuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBvc3QuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNy4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGV4Y2VycHRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFeGNlcnB0IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiRXhjZXJwdCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDUwMCwgXCJFeGNlcnB0IG11c3QgYmUgYXQgbW9zdCA1MDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY29udGVudFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoMTAwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY292ZXJJbWFnZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvdmVyIGltYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnVybChcIkNvdmVyIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIik7XG5cbmNvbnN0IGNyZWF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEsXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY29udGVudDogY29udGVudFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcG9zdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwb3N0U2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIERSQUZUIG9yIFBVQkxJU0hFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHB1YmxpY1F1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHouZW51bShbXCJuZXdlc3RcIiwgXCJvbGRlc3RcIiwgXCJ0aXRsZVwiXSkuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHN0YXR1czogelxuICAgICAgLmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0pXG4gICAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIkRSQUZUXCIgfCBcIlBVQkxJU0hFRFwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQb3N0U2NoZW1hLFxuICB1cGRhdGVQb3N0U2NoZW1hLFxuICBwb3N0UGFyYW1zU2NoZW1hLFxuICBwb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxuICBwdWJsaWNRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGRhc2hib2FyZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9kYXNoYm9hcmQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9kYXNoYm9hcmQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGFuYWx5dGljc1xucm91dGVyLmdldChcbiAgXCIvYWRtaW5cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFkbWluRGFzaGJvYXJkLFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBvd24gcGFja2FnZXMvYm9va2luZ3MvcmV2ZW51ZS9wZXJmb3JtYW5jZVxucm91dGVyLmdldChcbiAgXCIvYWdlbnRcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFnZW50RGFzaGJvYXJkLFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IG93biBib29raW5ncy91cGNvbWluZy9zcGVuZFxucm91dGVyLmdldChcIi91c2VyXCIsIGF1dGgoUm9sZS5VU0VSKSwgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRVc2VyRGFzaGJvYXJkKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGRhc2hib2FyZFNlcnZpY2UgfSBmcm9tIFwiLi9kYXNoYm9hcmQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBjb250cm9sbGVyIChBRE1JTilcbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZG1pbkRhc2hib2FyZChcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZ2VudERhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRVc2VyRGFzaGJvYXJkKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkQ29udHJvbGxlciA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBJQWdlbnREYXNoYm9hcmQsXG4gIElBZG1pbkRhc2hib2FyZCxcbiAgSUJvb2tpbmdzQnlTdGF0dXMsXG4gIElSZXZlbnVlUG9pbnQsXG4gIElVc2VyRGFzaGJvYXJkLFxufSBmcm9tIFwiLi9kYXNoYm9hcmQuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHRvTnVtYmVyID0gKHZhbHVlOiB1bmtub3duKTogbnVtYmVyID0+IE51bWJlcih2YWx1ZSA/PyAwKTtcblxuLy8gQm9va2luZy1zdGF0dXMgYnJlYWtkb3duIHZpYSBncm91cEJ5ICsgX2NvdW50LiBPcHRpb25hbCBwYWNrYWdlLWlkIHNjb3BlXG4vLyAoYGFnZW50SWRgKSBsaW1pdHMgaXQgdG8gYW4gYWdlbnQncyBvd24sIG5vbi1kZWxldGVkIHBhY2thZ2VzLlxuY29uc3QgZ2V0Qm9va2luZ3NCeVN0YXR1cyA9IGFzeW5jIChcbiAgYWdlbnRJZD86IHN0cmluZyxcbik6IFByb21pc2U8SUJvb2tpbmdzQnlTdGF0dXNbXT4gPT4ge1xuICBjb25zdCBncm91cGVkID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZ3JvdXBCeSh7XG4gICAgYnk6IFtcInN0YXR1c1wiXSxcbiAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgIHdoZXJlOiBhZ2VudElkXG4gICAgICA/IHsgcGFja2FnZTogeyBhZ2VudElkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0gfVxuICAgICAgOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHJldHVybiBncm91cGVkXG4gICAgLm1hcCgoZykgPT4gKHsgc3RhdHVzOiBnLnN0YXR1cywgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn07XG5cbi8vIFJldmVudWUgdHJlbmQ6IG9uZSByb3cgcGVyIGRheSBmb3IgdGhlIGxhc3QgYGRheXNgIGRheXMsIGJ1Y2tldGluZyBDT01QTEVURURcbi8vIGJvb2tpbmdzIGJ5IHRoZWlyIGB1cGRhdGVkQXRgIFx1MjAxNCB0aGUgdGltZXN0YW1wIG9mIHRoZSB0cmFuc2l0aW9uIGludG9cbi8vIENPTVBMRVRFRCAoYSB0ZXJtaW5hbCBzdGF0ZSwgc28gaXQgaXMgdGhlIGxhc3Qgd3JpdGUpLiBgY3JlYXRlZEF0YCBpcyB3aGVuXG4vLyB0aGUgYm9va2luZyB3YXMgbWFkZSAoUEVORElORykgYW5kIG5ldmVyIG1vdmVzLCB3aGljaCB3b3VsZCBtaXMtZGF0ZSByZXZlbnVlXG4vLyB3ZWVrcyBsYXRlci4gUG9zdGdyZXMgZ2VuZXJhdGVfc2VyaWVzIGd1YXJhbnRlZXMgYSBkZW5zZSBzZXJpZXMgKHplcm8tZmlsbGVkXG4vLyBkYXlzKSBcdTIwMTQgYmV0dGVyIGFuZCBmYXN0ZXIgdGhhbiBhIHBlci1kYXkgSlMgbG9vcC5cbmNvbnN0IGdldFJldmVudWVPdmVyVGltZSA9IGFzeW5jIChcbiAgZGF5czogbnVtYmVyLFxuICBhZ2VudElkPzogc3RyaW5nLFxuKTogUHJvbWlzZTxJUmV2ZW51ZVBvaW50W10+ID0+IHtcbiAgY29uc3Qgc2NvcGUgPSBhZ2VudElkXG4gICAgPyBgQU5EIGIuXCJwYWNrYWdlSWRcIiBJTiAoXG4gICAgICAgICBTRUxFQ1QgcC5cImlkXCJcbiAgICAgICAgIEZST00gXCJ0b3VyX3BhY2thZ2VzXCIgcFxuICAgICAgICAgV0hFUkUgcC5cImFnZW50SWRcIiA9ICQyXG4gICAgICAgICAgIEFORCBwLlwiaXNEZWxldGVkXCIgPSBmYWxzZVxuICAgICAgIClgXG4gICAgOiBcIlwiO1xuXG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlPFxuICAgIHsgZGF0ZTogc3RyaW5nOyByZXZlbnVlOiBudW1iZXIgfVtdXG4gID4oXG4gICAgYFxuICAgIFNFTEVDVCB0b19jaGFyKGRheXMuZCwgJ1lZWVktTU0tREQnKSBBUyBkYXRlLFxuICAgICAgICAgICBDT0FMRVNDRShTVU0oYi5cInRvdGFsUHJpY2VcIiksIDApOjpmbG9hdDggQVMgcmV2ZW51ZVxuICAgIEZST00gZ2VuZXJhdGVfc2VyaWVzKFxuICAgICAgQ1VSUkVOVF9EQVRFIC0gbWFrZV9pbnRlcnZhbChkYXlzID0+ICQxOjppbnQgLSAxKSxcbiAgICAgIENVUlJFTlRfREFURSxcbiAgICAgICcxIGRheSc6OmludGVydmFsXG4gICAgKSBBUyBkYXlzKGQpXG4gICAgTEVGVCBKT0lOIFwiYm9va2luZ3NcIiBiXG4gICAgICBPTiBkYXRlX3RydW5jKCdkYXknLCBiLlwidXBkYXRlZEF0XCIpOjpkYXRlID0gZGF5cy5kXG4gICAgICBBTkQgYi5cInN0YXR1c1wiID0gJ0NPTVBMRVRFRCdcbiAgICAgICR7c2NvcGV9XG4gICAgR1JPVVAgQlkgZGF5cy5kXG4gICAgT1JERVIgQlkgZGF5cy5kIEFTQ1xuICAgIGAsXG4gICAgZGF5cyxcbiAgICAuLi4oYWdlbnRJZCA/IFthZ2VudElkXSA6IFtdKSxcbiAgKTtcblxuICByZXR1cm4gcm93cztcbn07XG5cbi8vIFBhY2thZ2UtaWQgc2NvcGUgZm9yIGJvb2tpbmcgcXVlcmllcy4gQ2FsbGVycyBzaG9ydC1jaXJjdWl0IHRoZSBlbXB0eSBjYXNlXG4vLyAoYW4gYWdlbnQgd2l0aCBubyBwYWNrYWdlcyksIGJ1dCBhbiBgaW46IFtdYCBmYWxsYmFjayBrZWVwcyB0aGUgdHlwZVxuLy8gbm9uLW51bGxhYmxlIHdoaWxlIHN0aWxsIG1hdGNoaW5nIG5vdGhpbmcgaWYgaXQgZXZlciBzbGlwcyB0aHJvdWdoLlxuY29uc3QgdG9QYWNrYWdlSWRTY29wZSA9IChcbiAgcGFja2FnZUlkczogc3RyaW5nW10sXG4pOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPT5cbiAgcGFja2FnZUlkcy5sZW5ndGhcbiAgICA/IHsgcGFja2FnZUlkOiB7IGluOiBwYWNrYWdlSWRzIH0gfVxuICAgIDogeyBwYWNrYWdlSWQ6IHsgaW46IFtdIH0gfTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGNvdW50cywgYnJlYWtkb3ducyBhbmQgcmV2ZW51ZSB0cmVuZC5cbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gYXN5bmMgKGRheXM6IG51bWJlcik6IFByb21pc2U8SUFkbWluRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWUsXG4gICAgdXNlcnNCeVJvbGUsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICBdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCgpLFxuICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5ncm91cEJ5KHtcbiAgICAgIGJ5OiBbXCJyb2xlXCJdLFxuICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKCksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlXG4gICAgICAuZ3JvdXBCeSh7XG4gICAgICAgIGJ5OiBbXCJjYXRlZ29yeUlkXCJdLFxuICAgICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICB9KVxuICAgICAgLnRoZW4oYXN5bmMgKGdyb3VwZWQpID0+IHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnlJZHMgPSBncm91cGVkLm1hcCgoZykgPT4gZy5jYXRlZ29yeUlkKTtcbiAgICAgICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHsgaWQ6IHsgaW46IGNhdGVnb3J5SWRzIH0gfSxcbiAgICAgICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG5hbWVNYXAgPSBuZXcgTWFwKGNhdGVnb3JpZXMubWFwKChjKSA9PiBbYy5pZCwgYy5uYW1lXSkpO1xuXG4gICAgICAgIHJldHVybiBncm91cGVkXG4gICAgICAgICAgLm1hcCgoZykgPT4gKHtcbiAgICAgICAgICAgIGNhdGVnb3J5OiBuYW1lTWFwLmdldChnLmNhdGVnb3J5SWQpID8/IFwiVW5rbm93blwiLFxuICAgICAgICAgICAgY291bnQ6IGcuX2NvdW50Ll9hbGwsXG4gICAgICAgICAgfSkpXG4gICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbiAgICAgIH0pLFxuICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVzZXJzQnlSb2xlOiB1c2Vyc0J5Um9sZVxuICAgICAgLm1hcCgoZykgPT4gKHsgcm9sZTogZy5yb2xlLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBzY29wZWQgdG8gdGhlIGFnZW50J3Mgb3duIHBhY2thZ2VzLiBGZXRjaGVzIG93bmVkXG4vLyAgICBwYWNrYWdlIGlkcyBvbmNlLCB0aGVuIGV2ZXJ5IGFnZ3JlZ2F0ZSByZXVzZXMgdGhhdCBzY29wZSBzbyB0aGUgd2hvbGVcbi8vICAgIGJ1bmRsZSBpcyBvbmUgUHJvbWlzZS5hbGwgKG5vIHBlci1pdGVtIHF1ZXJpZXMpLlxuY29uc3QgZ2V0QWdlbnREYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzOiBudW1iZXIsXG4pOiBQcm9taXNlPElBZ2VudERhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbb3duZWRQYWNrYWdlcywgYm9va2luZ3NCeVN0YXR1cywgYXZlcmFnZVJhdGluZ10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IGFnZW50SWQ6IHVzZXJJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh1c2VySWQpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5hZ2dyZWdhdGUoe1xuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcGFja2FnZUlkcyA9IG93bmVkUGFja2FnZXMubWFwKChwKSA9PiBwLmlkKTtcblxuICAvLyBBbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzIG11c3Qgc2VlIHplcm9zIFx1MjAxNCBzY29wZSBpcyB1bmRlZmluZWQgZm9yIGFuIGVtcHR5XG4gIC8vIGxpc3QsIGFuZCBhIGJhcmUgYHdoZXJlOiB1bmRlZmluZWRgIC8gYEFORDogW3t9XWAgd291bGQgb3RoZXJ3aXNlIG1hdGNoIHRoZVxuICAvLyB3aG9sZSBwbGF0Zm9ybSAoY3Jvc3MtYWdlbnQgZGF0YSBsZWFrKS4gU2hvcnQtY2lyY3VpdCBoZXJlIGluc3RlYWQuXG4gIGlmIChwYWNrYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFBhY2thZ2VzOiAwLFxuICAgICAgdG90YWxCb29raW5nczogMCxcbiAgICAgIHRvdGFsUmV2ZW51ZTogMCxcbiAgICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgICByZXZlbnVlT3ZlclRpbWU6IGF3YWl0IGdldFJldmVudWVPdmVyVGltZShkYXlzLCB1c2VySWQpLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzY29wZSA9IHRvUGFja2FnZUlkU2NvcGUocGFja2FnZUlkcyk7XG5cbiAgY29uc3QgW3RvdGFsUGFja2FnZXMsIHRvdGFsQm9va2luZ3MsIHRvdGFsUmV2ZW51ZSwgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcGFja2FnZUlkcy5sZW5ndGgsXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiBzY29wZSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIEFORDogW3Njb3BlLCB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfV0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB1c2VySWQpLFxuICAgIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IHRoZSB1c2VyJ3MgYm9va2luZ3MsIHNwZW5kLCBhbmQgdXBjb21pbmcgdHJpcHMuXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxJVXNlckRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbdG90YWxCb29raW5ncywgdG90YWxTcGVuZCwgdXBjb21pbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmU6IHsgdXNlcklkIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgdXNlcklkLCBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICBpbjogW0Jvb2tpbmdTdGF0dXMuUEVORElORywgQm9va2luZ1N0YXR1cy5QQUlELCBCb29raW5nU3RhdHVzLkNPTkZJUk1FRF0sXG4gICAgICAgIH0sXG4gICAgICAgIHRyYXZlbERhdGU6IHsgZ3Q6IG5ldyBEYXRlKCkgfSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHRyYXZlbERhdGU6IHRydWUsXG4gICAgICAgIHRyYXZlbGVyczogdHJ1ZSxcbiAgICAgICAgdG90YWxQcmljZTogdHJ1ZSxcbiAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgdHJhdmVsRGF0ZTogXCJhc2NcIiB9LFxuICAgICAgdGFrZTogNSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsU3BlbmQ6IHRvTnVtYmVyKHRvdGFsU3BlbmQuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1cGNvbWluZ0NvdW50OiB1cGNvbWluZy5sZW5ndGgsXG4gICAgdXBjb21pbmc6IHVwY29taW5nLm1hcCgoYikgPT4gKHtcbiAgICAgIC4uLmIsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYi50b3RhbFByaWNlKSxcbiAgICB9KSksXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkU2VydmljZSA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgZGFzaGJvYXJkUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGRheXM6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoMzY1KS5kZWZhdWx0KDMwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkVmFsaWRhdGlvbnMgPSB7XG4gIGRhc2hib2FyZFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBheW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vcGF5bWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYXltZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYXltZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE9wZW4gYSBnYXRld2F5IHNlc3Npb24gZm9yIHRoZSB1c2VyJ3MgcGVuZGluZyBib29raW5nIChVU0VSIG9ubHkpLlxucm91dGVyLnBvc3QoXG4gIFwiL2NyZWF0ZVwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNyZWF0ZVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgdGhlIG91dGNvbWUgaGVyZSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIHdlXG4vLyByZWRpcmVjdCB0aGUgYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5yb3V0ZXIucG9zdChcbiAgXCIvY29uZmlybVwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNvbmZpcm1QYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IGluc3RhbnQgcGF5bWVudCBub3RpZmljYXRpb247IHNhbWUgaWRlbXBvdGVudCBzZXR0bGUuXG5yb3V0ZXIucG9zdChcbiAgXCIvaXBuXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuaXBuLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuaW1wb3J0IHsgcGF5bWVudFNlcnZpY2UgfSBmcm9tIFwiLi9wYXltZW50LnNlcnZpY2VcIjtcblxuY29uc3QgY3JlYXRlUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgcGF5bWVudFNlcnZpY2UuY3JlYXRlUGF5bWVudFNlc3Npb24odXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYXltZW50IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBzZXNzaW9uLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUHVibGljIGNhbGxiYWNrIHRhcmdldCBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyBoZXJlIChzZXJ2ZXItdG8tc2VydmVyKSBhZnRlciB0aGVcbi8vIHNob3BwZXIgZmluaXNoZXMgYXQgdGhlIGdhdGV3YXkuIFdlIHNldHRsZSB0aGUgcGF5bWVudCwgdGhlbiBib3VuY2UgdGhlXG4vLyBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbmNvbnN0IGNvbmZpcm1QYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcbiAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN0YXR1cyA/PyBcImZhaWxcIik7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICBjb25zdCByZWRpcmVjdEJhc2UgPVxuICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2O1xuICAgIGNvbnN0IHBhZ2UgPSBbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXS5pbmNsdWRlcyhzdGF0dXMpID8gc3RhdHVzIDogXCJmYWlsXCI7XG5cbiAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtyZWRpcmVjdEJhc2V9L3BheW1lbnQvJHtwYWdlfT9ib29raW5nSWQ9JHtib29raW5nSWR9YCk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgSVBOIHRhcmdldCBcdTIwMTQgdGhlIGdhdGV3YXkgbm90aWZpZXMgdXMgaGVyZSBpbmRlcGVuZGVudGx5IG9mIHRoZVxuLy8gcmVkaXJlY3QuIFNhbWUgaWRlbXBvdGVudCBzZXR0bGU7IGFsd2F5cyBhbnN3ZXJzIDIwMCBzbyB0aGUgZ2F0ZXdheSBzdG9wcyByZXRyeWluZy5cbmNvbnN0IGlwbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICByZXMuc3RhdHVzKDIwMCkudHlwZShcInRleHQvcGxhaW5cIikuc2VuZChcIk9LXCIpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYXltZW50LFxuICBjb25maXJtUGF5bWVudCxcbiAgaXBuLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWcvaW5kZXhcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFBheW1lbnQgaXMgYW4gb3B0aW9uYWwgZmVhdHVyZTogdGhlIEFQSSBtdXN0IGJvb3QgYW5kIHNlcnZlIGV2ZXJ5dGhpbmcgZWxzZVxuLy8gZXZlbiB3aGVuIHRoZSBTU0xDb21tZXJ6IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0LiBUaGVzZSB0aHJvdyBhIGNsZWFuIDQwMFxuLy8gb24gdGhlIHBheW1lbnQtb25seSBwYXRocyByYXRoZXIgdGhhbiBjcmFzaCB0aGUgd2hvbGUgZGVwbG95bWVudCBhdCBib290LlxuY29uc3QgcmVxdWlyZUNvbmZpZyA9ICgpID0+IHtcbiAgaWYgKCFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQgfHwgIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IFNTTF9DT01NRVJaX1NUT1JFX0lEIGFuZCBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRC5cIixcbiAgICApO1xuICB9XG4gIGlmICghY29uZmlnLmJhY2tlbmRfcHVibGljX3VybCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IEJBQ0tFTkRfUFVCTElDX1VSTCB0byB0aGUgcHVibGljbHkgcmVhY2hhYmxlIGJhY2tlbmQgVVJMLlwiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBzdG9yZUlkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQsXG4gICAgc3RvcmVQYXNzd29yZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkLFxuICB9O1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6SW5pdFJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBmYWlsZWRyZWFzb24/OiBzdHJpbmc7XG4gIHNlc3Npb25rZXk/OiBzdHJpbmc7XG4gIEdhdGV3YXlQYWdlVVJMPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIHZhbF9pZD86IHN0cmluZztcbiAgYW1vdW50Pzogc3RyaW5nO1xuICBjdXJyZW5jeT86IHN0cmluZztcbiAgYmFua190cmFuX2lkPzogc3RyaW5nO1xuICBjYXJkX3R5cGU/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuLy8gU1NMQ29tbWVyeiB0cnVuY2F0ZXMgdHJhbl9pZCB0byAzMCBjaGFycyBcdTIwMTQgZGF0ZSArIHRpbWUgKyByYW5kb20gc2FsdCBzdGF5cyBzYWZlbHkgdW5kZXIuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUcmFuSWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBUUk5YX0lELSR7RGF0ZS5ub3coKX0tJHtyYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKS5zbGljZSgwLCA4KX1gO1xufVxuXG4vLyBJbml0aWF0ZXMgYSBnYXRld2F5IHNlc3Npb24uIFNlcnZlci10by1zZXJ2ZXIgUE9TVCwgZm9ybS1lbmNvZGVkLiBUaGUgZ2F0ZXdheVxuLy8gcmVzcG9uZHMgd2l0aCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCAoR2F0ZXdheVBhZ2VVUkwpIHRoZSBjdXN0b21lciBpcyBzZW50IHRvLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpJbml0KG9wdGlvbnM6IHtcbiAgdG90YWxfYW1vdW50OiBudW1iZXI7XG4gIHRyYW5faWQ6IHN0cmluZztcbiAgc3VjY2Vzc191cmw6IHN0cmluZztcbiAgZmFpbF91cmw6IHN0cmluZztcbiAgY2FuY2VsX3VybDogc3RyaW5nO1xuICBpcG5fdXJsOiBzdHJpbmc7XG4gIGN1c19uYW1lOiBzdHJpbmc7XG4gIGN1c19lbWFpbDogc3RyaW5nO1xuICBjdXNfcGhvbmU6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpJbml0UmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBib2R5ID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHRvdGFsX2Ftb3VudDogb3B0aW9ucy50b3RhbF9hbW91bnQudG9GaXhlZCgyKSxcbiAgICBjdXJyZW5jeTogXCJCRFRcIixcbiAgICB0cmFuX2lkOiBvcHRpb25zLnRyYW5faWQsXG4gICAgc3VjY2Vzc191cmw6IG9wdGlvbnMuc3VjY2Vzc191cmwsXG4gICAgZmFpbF91cmw6IG9wdGlvbnMuZmFpbF91cmwsXG4gICAgY2FuY2VsX3VybDogb3B0aW9ucy5jYW5jZWxfdXJsLFxuICAgIGlwbl91cmw6IG9wdGlvbnMuaXBuX3VybCxcbiAgICBjdXNfbmFtZTogb3B0aW9ucy5jdXNfbmFtZSxcbiAgICBjdXNfZW1haWw6IG9wdGlvbnMuY3VzX2VtYWlsLFxuICAgIGN1c19hZGQxOiBcIk4vQVwiLFxuICAgIGN1c19hZGQyOiBcIk4vQVwiLFxuICAgIGN1c19jaXR5OiBcIk4vQVwiLFxuICAgIGN1c19zdGF0ZTogXCJOL0FcIixcbiAgICBjdXNfcG9zdGNvZGU6IFwiMTAwMFwiLFxuICAgIGN1c19jb3VudHJ5OiBcIkJhbmdsYWRlc2hcIixcbiAgICBjdXNfcGhvbmU6IG9wdGlvbnMuY3VzX3Bob25lLFxuICAgIHByb2R1Y3RfbmFtZTogXCJUcmlwVmVyc2UgVG91ciBCb29raW5nXCIsXG4gICAgc2hpcHBpbmdfbWV0aG9kOiBcIk5PXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICBib2R5OiBib2R5LnRvU3RyaW5nKCksXG4gIH0pO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogaW5pdCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogaW5pdCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgaWYgKGRhdGEuc3RhdHVzICE9PSBcInN1Y2Nlc3NcIiB8fCAhZGF0YS5HYXRld2F5UGFnZVVSTCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7ZGF0YS5mYWlsZWRyZWFzb24gPz8gZGF0YS5zdGF0dXN9YCk7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIFNlcnZlci1zaWRlIHZlcmlmaWNhdGlvbiBvZiBhIGNvbXBsZXRlZCB0cmFuc2FjdGlvbi4gc3RhdHVzOiBWQUxJRCAvIFZBTElEQVRFRCAvXG4vLyBJTlZBTElEX1RSQU5TQUNUSU9OIC8gRkFJTEVELiBWQUxJREFURUQgbWVhbnMgdGhlIHRyYW5zYWN0aW9uIHdhcyB2ZXJpZmllZCBiZWZvcmVcbi8vIChpZGVtcG90ZW50KSwgSU5WQUxJRF9UUkFOU0FDVElPTiBtZWFucyB0aGUgYW1vdW50L3RyYW5zYWN0aW9uIG1pc21hdGNoZXMuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3NsY29tbWVyelZhbGlkYXRlKG9wdGlvbnM6IHtcbiAgdmFsX2lkOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgdmFsX2lkOiBvcHRpb25zLnZhbF9pZCxcbiAgICBzdG9yZV9pZDogc3RvcmVJZCxcbiAgICBzdG9yZV9wYXNzd2Q6IHN0b3JlUGFzc3dvcmQsXG4gICAgZm9ybWF0OiBcImpzb25cIixcbiAgfSk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7Y29uZmlnLnNzbGNvbW1lcnpfdmFsaWRhdGVfdXJsfT8ke3BhcmFtcy50b1N0cmluZygpfWAsIHtcbiAgICBtZXRob2Q6IFwiR0VUXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogdmFsaWRhdGlvbiBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogdmFsaWRhdGlvbiByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG4gIHJldHVybiBkYXRhO1xufSIsICJpbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYXltZW50U3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IFNzbGNvbW1lcnpJbml0UmVzdWx0LCBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCwgZ2VuZXJhdGVUcmFuSWQsIHNzbGNvbW1lcnpJbml0LCBzc2xjb21tZXJ6VmFsaWRhdGUgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCwgSVBheW1lbnRDcmVhdGVSZXF1ZXN0LCBJUGF5bWVudEdhdGV3YXlPdXRjb21lIH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcblxuLy8gVGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2UgVVJMcyBzZXJ2ZXItdG8tc2VydmVyLCBzbyB0aGUgaG9zdCBtdXN0IGJlXG4vLyBwdWJsaWNseSByZWFjaGFibGUgXHUyMDE0IGNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwsIG5ldmVyIGxvY2FsaG9zdCBpbiBzYW5kYm94LlxuY29uc3QgYnVpbGRDYWxsYmFja1VybCA9IChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICBraW5kOiBcInN1Y2Nlc3NcIiB8IFwiZmFpbFwiIHwgXCJjYW5jZWxcIiB8IFwiaXBuXCIsXG4pID0+XG4gIGAke2NvbmZpZy5iYWNrZW5kX3B1YmxpY191cmx9L2FwaS9wYXltZW50cy8ke2tpbmQgPT09IFwiaXBuXCIgPyBcImlwblwiIDogXCJjb25maXJtXCJ9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH0mdHJhbklkPSR7dHJhbklkfSR7XG4gICAga2luZCA9PT0gXCJpcG5cIiA/IFwiXCIgOiBgJnN0YXR1cz0ke2tpbmR9YFxuICB9YDtcblxuLy8gT3BlbnMgYW4gU1NMQ29tbWVyeiBzZXNzaW9uIGZvciBhIHBlbmRpbmcgYm9va2luZyB0aGUgdXNlciBvd25zLiBUaGUgYm9va2luZ1xuLy8gYW1vdW50IGlzIGZyb3plbiBhdCBpbml0aWF0aW9uOyBpdCBuZXZlciByZS1yZWFkcyB0aGUgcGFja2FnZSBwcmljZS5cbmNvbnN0IGNyZWF0ZVBheW1lbnRTZXNzaW9uID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVBheW1lbnRDcmVhdGVSZXF1ZXN0LFxuKTogUHJvbWlzZTx7IHBheW1lbnRJZDogc3RyaW5nOyB0cmFuSWQ6IHN0cmluZzsgcGF5bWVudFVybDogc3RyaW5nIHwgbnVsbCB9PiA9PiB7XG4gIGNvbnN0IHsgYm9va2luZ0lkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0sXG4gICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBheSBmb3IgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgPT09IEJvb2tpbmdTdGF0dXMuUEFJRCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVGhpcyBib29raW5nIGlzIGFscmVhZHkgcGFpZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzICE9PSBCb29raW5nU3RhdHVzLlBFTkRJTkcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBgQ2Fubm90IHBheSBmb3IgYSBib29raW5nIGluICR7Ym9va2luZy5zdGF0dXMudG9Mb3dlckNhc2UoKX0gc3RhdHVzLmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlLCBwaG9uZTogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKTtcbiAgY29uc3QgdHJhbklkID0gZ2VuZXJhdGVUcmFuSWQoKTtcblxuICAvLyBPbmUgbGl2ZSBzZXNzaW9uIHBlciBib29raW5nOiB0aGUgbGVkZ2VyIHJvdyBpcyBjcmVhdGVkIGF0b21pY2FsbHkgd2hpbGVcbiAgLy8gc3VwZXJzZWRpbmcgYW55IGFiYW5kb25lZCBzZXNzaW9uLCB0aGVuIHRoZSBnYXRld2F5IGlzIGFza2VkLiBUaGUgcm93XG4gIC8vIHN1cnZpdmVzIHJlZ2FyZGxlc3Mgb2YgdGhlIGdhdGV3YXkgcmVzcG9uc2UgXHUyMDE0IGluaXQgZmFpbHVyZSBmbGlwcyBpdCB0b1xuICAvLyBGQUlMRUQgYmVsb3cgc28gYSB0cnV0aGZ1bCBlbnRyeSBhbHdheXMgZXhpc3RzLlxuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB0eC5wYXltZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGJvb2tpbmdJZCxcbiAgICAgICAgdHJhbklkLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICBsZXQgaW5pdDogU3NsY29tbWVyekluaXRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgaW5pdCA9IGF3YWl0IHNzbGNvbW1lcnpJbml0KHtcbiAgICAgIHRvdGFsX2Ftb3VudDogYW1vdW50LFxuICAgICAgdHJhbl9pZDogdHJhbklkLFxuICAgICAgc3VjY2Vzc191cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwic3VjY2Vzc1wiKSxcbiAgICAgIGZhaWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImZhaWxcIiksXG4gICAgICBjYW5jZWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImNhbmNlbFwiKSxcbiAgICAgIGlwbl91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiaXBuXCIpLFxuICAgICAgY3VzX25hbWU6IHVzZXIubmFtZSxcbiAgICAgIGN1c19lbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIGN1c19waG9uZTogdXNlci5waG9uZSA/PyBcIjAxNzExMTExMTExXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8ga2VlcCB0aGUgbGVkZ2VyIHRydXRoZnVsIFx1MjAxNCB0aGUgc2Vzc2lvbiBuZXZlciByZWFjaGVkIHRoZSBnYXRld2F5LiBUaGVcbiAgICAvLyBzdGF0dXMgZ3VhcmQgbWFrZXMgYSBjb25jdXJyZW50IC9jcmVhdGUgdGhhdCBhbHJlYWR5IGNhbmNlbGxlZCB0aGlzIHJvd1xuICAgIC8vIHdpbiB0aGUgcmFjZSAodGhhdCByb3cgc3RheXMgY2FuY2VsbGVkLCB0aGlzIG9uZSBmYWlscyBvbmx5IGlmIGxpdmUpLlxuICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgLy8gc3RvcmUgdGhlIGdhdGV3YXkgVVJMcyBvbmx5IGlmIHRoZSByb3cgaXMgc3RpbGwgdGhlIGxpdmUgc2Vzc2lvbi5cbiAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICBkYXRhOiB7IGdhdGV3YXlQYWdlVXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMLCBzc2xTZXNzaW9uS2V5OiBpbml0LnNlc3Npb25rZXkgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50SWQ6IHBheW1lbnQuaWQsXG4gICAgdHJhbklkOiBwYXltZW50LnRyYW5JZCxcbiAgICBwYXltZW50VXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMID8/IG51bGwsXG4gIH07XG59O1xuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb246IHRoZSB2YWxpZGF0b3IgcmV0dXJuc1xuLy8gVkFMSUQgKGZpcnN0IGNoZWNrKSBvciBWQUxJREFURUQgKGFscmVhZHkgdmVyaWZpZWQgYmVmb3JlKSB3aXRoIHRoZSBhbW91bnQuXG4vLyBBbnl0aGluZyBlbHNlIFx1MjAxNCBvciBhIG1pc21hdGNoZWQgYW1vdW50IFx1MjAxNCBmYWlscyB0aGUgcGF5bWVudC5cbmNvbnN0IHZlcmlmeVN1Y2Nlc3MgPSBhc3luYyAoXG4gIHZhbElkOiBzdHJpbmcsXG4gIGV4cGVjdGVkQW1vdW50OiBudW1iZXIsXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbDsgbWF0Y2hlc0Ftb3VudDogYm9vbGVhbiB9PiA9PiB7XG4gIGxldCB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2ZXJpZmllZCA9IGF3YWl0IHNzbGNvbW1lcnpWYWxpZGF0ZSh7IHZhbF9pZDogdmFsSWQgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIHZhbGlkYXRvciB1bnJlYWNoYWJsZSBcdTIwMTQgZmFpbCB0aGUgcGF5bWVudCByYXRoZXIgdGhhbiBjcmFzaCB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4geyB2ZXJpZmllZDogbnVsbCwgbWF0Y2hlc0Ftb3VudDogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHZhbGlkU3RhdHVzID1cbiAgICB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURcIiB8fCB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURBVEVEXCI7XG4gIGNvbnN0IG1hdGNoZXNBbW91bnQgPVxuICAgIHZlcmlmaWVkLmFtb3VudCAhPT0gdW5kZWZpbmVkICYmIE51bWJlcih2ZXJpZmllZC5hbW91bnQpID09PSBleHBlY3RlZEFtb3VudDtcblxuICByZXR1cm4geyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudDogdmFsaWRTdGF0dXMgJiYgbWF0Y2hlc0Ftb3VudCB9O1xufTtcblxuLy8gU2hhcmVkIGJ5IHRoZSBjb25maXJtIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgSVBOIGVuZHBvaW50cy4gSWRlbXBvdGVudDogYVxuLy8gc2V0dGxlZCBwYXltZW50IHNob3J0LWNpcmN1aXRzLCBzbyB0aGUgZG91YmxlLWZpcmluZyBJUE4gbmV2ZXIgZG91YmxlLWNoYXJnZXMuXG5jb25zdCBwcm9jZXNzR2F0ZXdheVJlc3VsdCA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICByZXN1bHQ6IElHYXRld2F5UmVzdWx0LFxuKTogUHJvbWlzZTxJUGF5bWVudEdhdGV3YXlPdXRjb21lPiA9PiB7XG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyB0cmFuSWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBib29raW5nOiB7XG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5ib29raW5nSWQgIT09IGJvb2tpbmdJZCkge1xuICAgIC8vIEEgY2FsbGJhY2sgZm9yIGEgc2Vzc2lvbiB3ZSBuZXZlciBjcmVhdGVkIFx1MjAxNCBub3RoaW5nIHRvIHNldHRsZS5cbiAgICByZXR1cm4geyBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCwgYm9va2luZ1N0YXR1czogbnVsbCwgY2hhbmdlZDogZmFsc2UgfTtcbiAgfVxuXG4gIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5TVUNDRVNTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQ2FuY2VsIGNhbGxiYWNrIFx1MjAxNCB0aGUgc2hvcHBlciBhYmFuZG9uZWQgY2hlY2tvdXQsIG5vIGNoYXJnZSB3YXMgbWFkZS5cbiAgaWYgKHJlc3VsdC5mYWlsX3N0YXR1cyA9PT0gXCJDQU5DRUxMRURcIiB8fCByZXN1bHQuc3RhdHVzID09PSBcIkNBTkNFTExFRFwiKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTm8gdmFsX2lkIG1lYW5zIHRoZSBnYXRld2F5IHJlcG9ydGVkIGEgZmFpbHVyZSAoZmFpbF91cmwpIFx1MjAxNCBub3RoaW5nIHRvIHZlcmlmeS5cbiAgaWYgKCFyZXN1bHQudmFsX2lkKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3VjY2VzcyBwYXRoOiB2ZXJpZnkgc2VydmVyLXNpZGUgYW5kIG9ubHkgdGhlbiBtYXJrIHRoZSBib29raW5nIGFzIHBhaWQuXG4gIGNvbnN0IHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQgfSA9IGF3YWl0IHZlcmlmeVN1Y2Nlc3MoXG4gICAgcmVzdWx0LnZhbF9pZCxcbiAgICBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICApO1xuXG4gIGlmICghbWF0Y2hlc0Ftb3VudCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICAgIHZhbElkOiByZXN1bHQudmFsX2lkLFxuICAgICAgICBjYXJkVHlwZTogcmVzdWx0LmNhcmRfdHlwZSA/PyB2ZXJpZmllZD8uY2FyZF90eXBlLFxuICAgICAgICBiYW5rVHJhbklkOiByZXN1bHQuYmFua190cmFuX2lkID8/IHZlcmlmaWVkPy5iYW5rX3RyYW5faWQsXG4gICAgICAgIHBhaWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb21wYXJlLWFuZC1zZXQ6IG9ubHkgYSBzdGlsbC1QRU5ESU5HIGJvb2tpbmcgYmVjb21lcyBQQUlEOyBhIGJvb2tpbmcgdGhhdFxuICAgIC8vIHdhcyBjb25jdXJyZW50bHkgY29uZmlybWVkIG9yIGNhbmNlbGxlZCBrZWVwcyBpdHMgc3RhdGUsIHRoZSBtb25leSBzdGF5cyBvbi5cbiAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB1cGRhdGVkO1xuICB9KTtcblxuICBjb25zdCBib29raW5nQWZ0ZXIgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9IH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IFwicGF5bWVudCByZWNlaXZlZFwiIGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgY2FsbGJhY2tcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgZW1haWw6IHBheW1lbnQuYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogcGF5bWVudC5ib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogcGF5bWVudC5ib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBwYXltZW50LmJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgIHRyYXZlbGVyczogcGF5bWVudC5ib29raW5nLnRyYXZlbGVycyxcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50U3RhdHVzOiBzZXR0bGVkLnN0YXR1cyxcbiAgICBib29raW5nU3RhdHVzOiBib29raW5nQWZ0ZXI/LnN0YXR1cyA/PyBudWxsLFxuICAgIGNoYW5nZWQ6IHRydWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBheW1lbnRTZXNzaW9uLFxuICBwcm9jZXNzR2F0ZXdheVJlc3VsdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbn0pO1xuXG5jb25zdCBjYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHouc3RyaW5nKCkudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG4gIHRyYW5JZDogei5zdHJpbmcoKS5taW4oMSksXG4gIHN0YXR1czogei5lbnVtKFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdKS5vcHRpb25hbCgpLFxufSk7XG5cbi8vIEJvZHkgb2YgdGhlIGdhdGV3YXkgUE9TVCBcdTIwMTQgb25seSBmaWVsZHMgd2UgY29uc3VtZSwgYWxsIG9wdGlvbmFsIGJlY2F1c2UgdGhlXG4vLyBzaGFwZSBkaWZmZXJzIGJldHdlZW4gc3VjY2VzcyAvIGZhaWwgLyBjYW5jZWwgLyBJUE4gY2FsbGJhY2tzLlxuY29uc3QgZ2F0ZXdheVJlc3VsdFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgdmFsX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBmYWlsX3N0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjYXJkX3R5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYmFua190cmFuX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGN1cnJlbmN5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGFtb3VudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVQYXltZW50U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRDYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY2FsbGJhY2tRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUR2F0ZXdheVJlc3VsdFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdhdGV3YXlSZXN1bHRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gIGdhdGV3YXlSZXN1bHRTY2hlbWEsXG59OyIsICIvLyBWZXJjZWwgc2VydmVybGVzcyBlbnRyeXBvaW50IFx1MjAxNCByZS1leHBvcnRzIHRoZSBzYW1lIEV4cHJlc3MgYXBwIHRoZSBsb2NhbFxuLy8gYnVpbGQgdXNlcy4gVmVyY2VsJ3MgQHZlcmNlbC9ub2RlIHJ1bnRpbWUgY29tcGlsZXMgYW5kIHdyYXBzIGl0OyB0aGUgYXBwIGlzXG4vLyBzcGxpdCBmcm9tIHNlcnZlci50cyAod2hpY2ggb25seSBzdGFydHMgdGhlIGxpc3RlbmVyKSBzbyB0aGUgdHdvIGhvc3RzIHNoYXJlXG4vLyBvbmUgcm91dGUgcmVnaXN0cnkuXG5pbXBvcnQgYXBwIGZyb20gXCIuLi9zcmMvYXBwXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGFwcDsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7O0FBQUEsT0FBTyxhQUErRDtBQUN0RSxPQUFPLFVBQVU7QUFDakIsT0FBTyxrQkFBa0I7QUFDekIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sWUFBWTtBQUNuQixPQUFPLGVBQWU7OztBQ0x0QixPQUFPLFlBQVk7QUFDbkIs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SCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxjQUFJO0FBQUEsRUFDSixjQUFJO0FBQUEsRUFDSixjQUFJO0FBQUEsRUFDSixVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQ1A7QUFFQSxJQUFNLGdCQUFnQixDQUFDLFNBQ3JCLENBQUMsR0FBRyxJQUFJLEVBQUUs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QUEsTUFDVCxJQUFJO0FBQUEsTUFDSixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDcEMsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDO0FBR0QsSUFBSSxJQUFJLGFBQWEsVUFBVTtBQUMvQixJQUFJLElBQUksY0FBYyxVQUFVO0FBQ2hDLElBQUksSUFBSSxnQkFBZ0IsWUFBWTtBQUNwQyxJQUFJLElBQUksZ0JBQWdCLGFBQWE7QUFDckMsSUFBSSxJQUFJLG1CQUFtQixjQUFjO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksZ0JBQWdCLFlBQVk7QUFDcEMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxhQUFhLFVBQVU7QUFDL0IsSUFBSSxJQUFJLGtCQUFrQixlQUFlO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUV0QyxJQUFJLElBQUksZ0JBQWU7QUFDdkIsSUFBSSxJQUFJLDBCQUFrQjtBQUUxQixJQUFPLGNBQVE7OztBK0RuSGYsSUFBTyxnQkFBUTsiLAogICJuYW1lcyI6IFsicGF0aCIsICJjb25maWciLCAiQnVmZmVyIiwgIkFueU51bGwiLCAiRGJOdWxsIiwgIkRlY2ltYWwiLCAiSnNvbk51bGwiLCAiTnVsbFR5cGVzIiwgIlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IiLCAiUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IiLCAiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IiLCAiU3FsIiwgImVtcHR5IiwgImpvaW4iLCAicmF3IiwgInJ1bnRpbWUiLCAiaHR0cFN0YXR1cyIsICJyZWZyZXNoVG9rZW4iLCAicmVmcmVzaFRva2VuIiwgInJlZ2lzdGVyVXNlciIsICJodHRwU3RhdHVzIiwgImxvZ2luVXNlciIsICJnb29nbGVMb2dpbiIsICJkZW1vTG9naW4iLCAieiIsICJ6IiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImJjcnlwdCIsICJiY3J5cHQiLCAidXBkYXRlUHJvZmlsZSIsICJodHRwU3RhdHVzIiwgImdldFVzZXJzIiwgImNoYW5nZVJvbGUiLCAiY2hhbmdlU3RhdHVzIiwgImRlbGV0ZVVzZXIiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgIm11bHRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAibXVsdGVyIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlTWVzc2FnZSIsICJodHRwU3RhdHVzIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVCb29raW5nIiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlCb29raW5ncyIsICJnZXRBZ2VudEJvb2tpbmdzIiwgImdldEJvb2tpbmdEZXRhaWwiLCAiZ2V0QWxsQm9va2luZ3MiLCAidXBkYXRlQm9va2luZ1N0YXR1cyIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVSZXZpZXciLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ2F0ZWdvcnkiLCAiaHR0cFN0YXR1cyIsICJnZXRBbGxDYXRlZ29yaWVzIiwgInVwZGF0ZUNhdGVnb3J5IiwgImRlbGV0ZUNhdGVnb3J5IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVQYWNrYWdlIiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUGFja2FnZXMiLCAiZ2V0UGFja2FnZUJ5U2x1ZyIsICJnZXRBbGxQYWNrYWdlcyIsICJnZXRNeVBhY2thZ2VzIiwgInVwZGF0ZVBhY2thZ2UiLCAiY2hhbmdlUGFja2FnZVN0YXR1cyIsICJzb2Z0RGVsZXRlUGFja2FnZSIsICJ6IiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAiZ2VuZXJhdGVVbmlxdWVTbHVnIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUG9zdCIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1Bvc3RzIiwgImdldFBvc3RCeVNsdWciLCAiZ2V0QWxsUG9zdHMiLCAidXBkYXRlUG9zdCIsICJjaGFuZ2VQb3N0U3RhdHVzIiwgInNvZnREZWxldGVQb3N0IiwgInoiLCAidGl0bGVTY2hlbWEiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWRtaW5EYXNoYm9hcmQiLCAiaHR0cFN0YXR1cyIsICJnZXRBZ2VudERhc2hib2FyZCIsICJnZXRVc2VyRGFzaGJvYXJkIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgInJhbmRvbVVVSUQiLCAiaHR0cFN0YXR1cyIsICJ6IiwgImNyZWF0ZVNjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIl0KfQo=
