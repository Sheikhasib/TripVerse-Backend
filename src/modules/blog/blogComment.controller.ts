import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { blogCommentService } from "./blogComment.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Public comments for a post controller
const getPostComments = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slug = String(req.params.slug);
    const result = await blogCommentService.getPostComments(slug, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Comments retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 2. Create a comment controller (any authenticated user)
const createComment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const slug = String(req.params.slug);
    const result = await blogCommentService.createComment(userId, slug, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Comment posted successfully.",
      data: result,
    });
  },
);

// 3. Soft delete comment controller (owner or ADMIN)
const deleteComment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.user?.id);
    const role = req.user!.role;
    const id = String(req.params.id);
    await blogCommentService.deleteComment(userId, role, id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Comment deleted successfully.",
      data: null,
    });
  },
);

export const blogCommentController = {
  getPostComments,
  createComment,
  deleteComment,
};