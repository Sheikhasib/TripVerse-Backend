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

export const reviewController = {
  createReview,
  getPackageReviews,
};
