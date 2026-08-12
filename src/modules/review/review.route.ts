import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { reviewController } from "./review.controller";
import { reviewValidations } from "./review.validation";

const router = Router();

// 1. Create a review (USER only)
router.post(
  "/",
  auth(Role.USER),
  validateRequest({ body: reviewValidations.createReviewSchema }),
  reviewController.createReview,
);

// 2. List reviews for a package (public)
router.get(
  "/package/:packageId",
  validateRequest({
    params: reviewValidations.reviewParamsSchema,
    query: reviewValidations.reviewQuerySchema,
  }),
  reviewController.getPackageReviews,
);

export const reviewRoutes = router;
