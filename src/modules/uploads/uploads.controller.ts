import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { uploadImageToCloudinary } from "./uploads.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/appError";

// Upload a single image (AGENT/ADMIN) → Cloudinary
const uploadImage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw new AppError(400, "Image file is required");
    }

    const result = await uploadImageToCloudinary(req.file);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Image uploaded successfully.",
      data: result,
    });
  },
);

export const uploadsController = {
  uploadImage,
};