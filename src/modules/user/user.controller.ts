import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { userService } from "./user.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// Update profile controller
const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const user = await userService.updateProfile(userId, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Profile updated successfully.",
      data: user,
    });
  },
);

// Get all users (admin)
const getUsers = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await userService.getUsers(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Users fetched successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// Update user role (admin)
const changeRole = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    // an admin must not downgrade/change their own role
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus.FORBIDDEN,
        message: "You cannot change your own role.",
        data: null,
      });
    }

    const user = await userService.changeRole(id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User role updated successfully.",
      data: user,
    });
  },
);

// Update user status (admin)
const changeStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    // an admin must not suspend/activate their own account
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus.FORBIDDEN,
        message: "You cannot change your own status.",
        data: null,
      });
    }

    const user = await userService.changeStatus(id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User status updated successfully.",
      data: user,
    });
  },
);

// Soft delete user (admin)
const deleteUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    // an admin must not delete their own account
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus.FORBIDDEN,
        message: "You cannot delete your own account.",
        data: null,
      });
    }

    const user = await userService.deleteUser(id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User deleted successfully.",
      data: user,
    });
  },
);

export const userController = {
  updateProfile,
  getUsers,
  changeRole,
  changeStatus,
  deleteUser,
};