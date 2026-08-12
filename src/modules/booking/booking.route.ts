import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { bookingController } from "./booking.controller";
import { bookingValidations } from "./booking.validation";

const router = Router();

// Create booking (customer only — agents sell, admins manage)
router.post(
  "/",
  auth(Role.USER),
  validateRequest({ body: bookingValidations.createSchema }),
  bookingController.createBooking,
);

// My bookings — own bookings with filters + pagination (owner is always USER)
// NOTE: registered before "/:id" so the param route doesn't swallow it.
router.get(
  "/my-bookings",
  auth(Role.USER),
  validateRequest({ query: bookingValidations.bookingQuerySchema }),
  bookingController.getMyBookings,
);

// Agent bookings — scoped to packages the agent owns
router.get(
  "/agent-bookings",
  auth(Role.AGENT),
  validateRequest({ query: bookingValidations.bookingSearchQuerySchema }),
  bookingController.getAgentBookings,
);

// Booking detail — owner / package agent / admin
router.get(
  "/:id",
  auth(),
  validateRequest({ params: bookingValidations.bookingParamsSchema }),
  bookingController.getBookingDetail,
);

// Admin — all bookings
router.get(
  "/",
  auth(Role.ADMIN),
  validateRequest({ query: bookingValidations.bookingSearchQuerySchema }),
  bookingController.getAllBookings,
);

// Status transition — validated against the state machine in the service
router.patch(
  "/:id/status",
  auth(),
  validateRequest({
    params: bookingValidations.bookingParamsSchema,
    body: bookingValidations.updateStatusSchema,
  }),
  bookingController.updateBookingStatus,
);

export const bookingRoutes = router;