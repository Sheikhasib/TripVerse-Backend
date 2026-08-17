import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { reviewService } from "./review.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Create a review controller (USER only)
const createReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await reviewService.createReview(userId, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Review submitted successfully.",
      data: result,
    });
  },
);

// 2. List package reviews controller (public)
const getPackageReviews = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const packageId = String(req.params.packageId);
    const result = await reviewService.listPackageReviews(packageId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Reviews retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 3. Update a review controller (USER, author only)
const updateReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const id = String(req.params.id);
    const result = await reviewService.updateReview(userId, id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Review updated successfully.",
      data: result,
    });
  },
);

// 4. Delete a review controller (author or ADMIN)
const deleteReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const role = req.user!.role;
    const id = String(req.params.id);
    const result = await reviewService.deleteReview(userId, role, id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Review deleted successfully.",
      data: result,
    });
  },
);

export const reviewController = {
  createReview,
  getPackageReviews,
  updateReview,
  deleteReview,
};
