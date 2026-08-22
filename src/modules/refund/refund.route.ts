import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { refundController } from "./refund.controller";
import { refundValidations } from "./refund.validation";

const router = Router();

// Apply for a refund (customer only, on a paid booking)
router.post(
  "/",
  auth(Role.USER),
  validateRequest({ body: refundValidations.createSchema }),
  refundController.createRefundRequest,
);

// My applications — own requests with filters + pagination
// NOTE: registered before "/:id" so the param route doesn't swallow it.
router.get(
  "/mine",
  auth(Role.USER),
  validateRequest({ query: refundValidations.refundQuerySchema }),
  refundController.getMyRefundRequests,
);

// Admin — all applications
router.get(
  "/",
  auth(Role.ADMIN),
  validateRequest({ query: refundValidations.refundQuerySchema }),
  refundController.getAllRefundRequests,
);

// Detail — owner or admin
router.get(
  "/:id",
  auth(),
  validateRequest({ params: refundValidations.refundParamsSchema }),
  refundController.getRefundRequestDetail,
);

// Admin decision — approve (booking cancels + payout) or reject
router.patch(
  "/:id/decision",
  auth(Role.ADMIN),
  validateRequest({
    params: refundValidations.refundParamsSchema,
    body: refundValidations.decisionSchema,
  }),
  refundController.decideRefundRequest,
);

export const refundRoutes = router;
