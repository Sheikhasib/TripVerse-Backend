import { Router } from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { notificationController } from "./notification.controller";
import { notificationValidations } from "./notification.validation";

const router = Router();

// NOTE: PATCH /read-all MUST stay registered before PATCH /:id/read —
// Express matches top-down, and `/read-all` would otherwise be swallowed by
// the `:id` param route.

// 1. My notifications (any authenticated user) — paginated, optional ?unread=true
router.get(
  "/",
  auth(),
  validateRequest({ query: notificationValidations.notificationQuerySchema }),
  notificationController.getMyNotifications,
);

// 2. Unread count for the bell badge
router.get(
  "/unread-count",
  auth(),
  notificationController.getUnreadCount,
);

// 3. Mark all my notifications read
router.patch(
  "/read-all",
  auth(),
  notificationController.markAllAsRead,
);

// 4. Mark one notification read (owner only)
router.patch(
  "/:id/read",
  auth(),
  validateRequest({ params: notificationValidations.notificationParamsSchema }),
  notificationController.markAsRead,
);

export const notificationRoutes = router;