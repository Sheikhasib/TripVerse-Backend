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

// 3. Update a review (USER, author only) — registered after /package/:packageId
//    so the literal `/package` segment is never swallowed by `/:id`.
router.patch(
  "/:id",
  auth(Role.USER),
  validateRequest({
    params: reviewValidations.reviewIdParamsSchema,
    body: reviewValidations.updateReviewSchema,
  }),
  reviewController.updateReview,
);

// 4. Delete a review (author or ADMIN)
router.delete(
  "/:id",
  auth(),
  validateRequest({ params: reviewValidations.reviewIdParamsSchema }),
  reviewController.deleteReview,
);

export const reviewRoutes = router;
