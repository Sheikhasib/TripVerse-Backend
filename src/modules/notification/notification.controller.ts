import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { notificationService } from "./notification.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. My notifications controller (any authenticated user)
const getMyNotifications = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await notificationService.getMyNotifications(
      userId,
      req.query,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Notifications retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 2. Unread count controller (bell badge)
const getUnreadCount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await notificationService.getUnreadCount(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Unread count retrieved successfully.",
      data: result,
    });
  },
);

// 3. Mark one notification read controller
const markAsRead = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const id = String(req.params.id);
    const result = await notificationService.markAsRead(userId, id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Notification marked as read.",
      data: result,
    });
  },
);

// 4. Mark all notifications read controller
const markAllAsRead = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const result = await notificationService.markAllAsRead(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All notifications marked as read.",
      data: result,
    });
  },
);

export const notificationController = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};