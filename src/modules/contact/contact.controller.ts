import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { contactService } from "./contact.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Create contact message controller (public)
const createMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const message = await contactService.createMessage(req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Message sent successfully.",
      data: message,
    });
  },
);

// 2. List contact messages controller (admin only)
const getMessages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await contactService.listMessages(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Contact messages retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 3. Mark resolved/unresolved controller (admin only)
const updateResolved = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const { isResolved } = req.body;

    const message = await contactService.resolveMessage(id, isResolved);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Message status updated successfully.",
      data: message,
    });
  },
);

export const contactController = {
  createMessage,
  getMessages,
  updateResolved,
};