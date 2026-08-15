import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { wishlistService } from "./wishlist.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Save a package to the wishlist controller (USER)
const addToWishlist = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await wishlistService.addToWishlist(userId, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Package added to wishlist successfully.",
      data: result,
    });
  },
);

// 2. My wishlist controller (USER)
const getMyWishlist = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await wishlistService.getMyWishlist(userId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Wishlist retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 3. Remove from wishlist controller (USER) — 204 so a repeat delete is a
//    no-op indistinguishable from a successful one (no body, no error).
const removeFromWishlist = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const packageId = String(req.params.packageId);

    await wishlistService.removeFromWishlist(userId, packageId);

    res.status(httpStatus.NO_CONTENT).send();
  },
);

export const wishlistController = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};