import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { dashboardController } from "./dashboard.controller";
import { dashboardValidations } from "./dashboard.validation";

const router = Router();

// 1. Admin dashboard — platform-wide analytics
router.get(
  "/admin",
  auth(Role.ADMIN),
  validateRequest({ query: dashboardValidations.dashboardQuerySchema }),
  dashboardController.getAdminDashboard,
);

// 2. Agent dashboard — own packages/bookings/revenue/performance
router.get(
  "/agent",
  auth(Role.AGENT),
  validateRequest({ query: dashboardValidations.dashboardQuerySchema }),
  dashboardController.getAgentDashboard,
);

// 3. User dashboard — own bookings/upcoming/spend
router.get("/user", auth(Role.USER), dashboardController.getUserDashboard);

export const dashboardRoutes = router;