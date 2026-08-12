import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { packageService } from "./package.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Create package controller (AGENT/ADMIN)
const createPackage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await packageService.createPackage(req.user!, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Package created successfully. It will be visible after admin approval.",
      data: result,
    });
  },
);

// 2. Public listing controller (filters + pagination)
const getPublicPackages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await packageService.getPublicPackages(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Packages retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 3. Public package detail by slug
const getPackageBySlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slug = String(req.params.slug);
    const result = await packageService.getPackageBySlug(slug);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Package retrieved successfully.",
      data: result,
    });
  },
);

// 4. All packages controller (ADMIN moderation)
const getAllPackages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await packageService.getAllPackages(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All packages retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 5. My packages controller (AGENT)
const getMyPackages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await packageService.getMyPackages(userId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Your packages retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 6. Update package controller (AGENT own / ADMIN any)
const updatePackage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const result = await packageService.updatePackage(req.user!, id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Package updated successfully.",
      data: result,
    });
  },
);

// 7. Change package status controller (ADMIN approve/reject)
const changePackageStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const result = await packageService.changePackageStatus(id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Package status updated successfully.",
      data: result,
    });
  },
);

// 8. Soft delete package controller (AGENT own / ADMIN any)
const softDeletePackage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    await packageService.softDeletePackage(req.user!, id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Package deleted successfully.",
      data: null,
    });
  },
);

export const packageController = {
  createPackage,
  getPublicPackages,
  getPackageBySlug,
  getAllPackages,
  getMyPackages,
  updatePackage,
  changePackageStatus,
  softDeletePackage,
};