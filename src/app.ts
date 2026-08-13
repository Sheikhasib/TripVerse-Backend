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

const app: Application = express();

// Render/Railway sit behind a reverse proxy — must be set before the
// rate limiter or it will see the proxy's IP for every request and
// effectively rate-limit all users together.
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: [config.frontend_url_dev, config.frontend_url_prod],
    credentials: true,
  }),
);

if (config.node_env !== "production") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Strict limiter — auth endpoints, brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/demo-login", authLimiter);
app.use("/api/auth/google", authLimiter);
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

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
