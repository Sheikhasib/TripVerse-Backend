import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { refundService } from "./refund.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const createRefundRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const refundRequest = await refundService.createRefundRequest(
      userId,
      req.body,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Refund application submitted successfully.",
      data: refundRequest,
    });
  },
);

const getMyRefundRequests = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const result = await refundService.getMyRefundRequests(userId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Refund requests retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getRefundRequestDetail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    const refundRequest = await refundService.getRefundRequestDetail(
      id,
      req.user!,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Refund request retrieved successfully.",
      data: refundRequest,
    });
  },
);

const getAllRefundRequests = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await refundService.getAllRefundRequests(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Refund requests retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

const decideRefundRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    const result = await refundService.decideRefundRequest(
      id,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message:
        req.body.action === "APPROVE"
          ? "Refund request approved."
          : "Refund request rejected.",
      data: result,
    });
  },
);

export const refundController = {
  createRefundRequest,
  getMyRefundRequests,
  getRefundRequestDetail,
  getAllRefundRequests,
  decideRefundRequest,
};
