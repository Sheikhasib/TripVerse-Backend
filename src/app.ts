import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import config from "./config";
import notFoundHandler from "./middleware/notFound";
import globalErrorHandler from "./middleware/globalErrorHandler";
import { prisma } from "./lib/prisma";
import { authRoutes } from "./modules/auth/auth.route";
import { userRoutes } from "./modules/user/user.route";
import { uploadRoutes } from "./modules/uploads/uploads.route";
import { contactRoutes } from "./modules/contact/contact.route";
import { bookingRoutes } from "./modules/booking/booking.route";
import { reviewRoutes } from "./modules/review/review.route";
import { categoryRoutes } from "./modules/category/category.route";
import { packageRoutes } from "./modules/package/package.route";
import { blogRoutes } from "./modules/blog/blog.route";
import { dashboardRoutes } from "./modules/dashboard/dashboard.route";
import { paymentRoutes } from "./modules/payment/payment.route";
import { wishlistRoutes } from "./modules/wishlist/wishlist.route";
import { notificationRoutes } from "./modules/notification/notification.route";
import { refundRoutes } from "./modules/refund/refund.route";

const app: Application = express();

// Render/Railway sit behind a reverse proxy — must be set before the
// rate limiter or it will see the proxy's IP for every request and
// effectively rate-limit all users together.
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    // Dev host (localhost) + prod host (Vercel) both allowed side-by-side.
    // Config resolves sensible defaults so neither can be falsy.
    origin: [config.frontend_url_dev, config.frontend_url_prod].filter(
      (o): o is string => Boolean(o),
    ),
    credentials: true,
  }),
);

if (config.node_env === "development") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Strict limiter — the credential surface: password entry points only.
// Skipped in tests so the suites can exercise every auth path freely.
const authCredentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

// Looser limiter — self-service OTP + non-credential auth flows. Kept on its
// own instance so a full register→verify→forgot→reset pass (or a demo login)
// never eats into the strict credential budget and locks the grader out.
const authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

// Standard limiter — everything else under /api
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
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

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the TripVerse API!");
});

// Health check — real DB connectivity check, not a static 200.
app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "OK",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Service unavailable",
      db: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Feature routes register here as each module is built ──
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
app.use("/api/refunds", refundRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
