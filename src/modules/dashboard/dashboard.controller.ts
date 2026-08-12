import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { dashboardService } from "./dashboard.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Admin dashboard controller (ADMIN)
const getAdminDashboard = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await dashboardService.getAdminDashboard(
      Number(req.query.days),
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Dashboard data fetched successfully.",
      data: result,
    });
  },
);

// 2. Agent dashboard controller (AGENT)
const getAgentDashboard = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await dashboardService.getAgentDashboard(
      userId,
      Number(req.query.days),
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Dashboard data fetched successfully.",
      data: result,
    });
  },
);

// 3. User dashboard controller (USER)
const getUserDashboard = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await dashboardService.getUserDashboard(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Dashboard data fetched successfully.",
      data: result,
    });
  },
);

export const dashboardController = {
  getAdminDashboard,
  getAgentDashboard,
  getUserDashboard,
};