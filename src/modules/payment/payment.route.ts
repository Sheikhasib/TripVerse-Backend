import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { paymentController } from "./payment.controller";
import { paymentValidations } from "./payment.validation";

const router = Router();

// Open a gateway session for the user's pending booking (USER only).
router.post(
  "/create",
  auth(Role.USER),
  validateRequest({ body: paymentValidations.createSchema }),
  paymentController.createPayment,
);

// Public — SSLCommerz POSTs the outcome here (success/fail/cancel) and we
// redirect the browser to the frontend result page.
router.post(
  "/confirm",
  validateRequest({
    query: paymentValidations.callbackQuerySchema,
    body: paymentValidations.gatewayResultSchema,
  }),
  paymentController.confirmPayment,
);

// Public — SSLCommerz instant payment notification; same idempotent settle.
router.post(
  "/ipn",
  validateRequest({
    query: paymentValidations.callbackQuerySchema,
    body: paymentValidations.gatewayResultSchema,
  }),
  paymentController.ipn,
);

export const paymentRoutes = router;