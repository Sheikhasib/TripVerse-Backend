import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { blogService } from "./blog.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// 1. Create post controller (AGENT/ADMIN)
const createPost = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await blogService.createPost(req.user!, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Post created successfully. It will be visible after publishing.",
      data: result,
    });
  },
);

// 2. Public listing controller (search + sort + pagination)
const getPublicPosts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await blogService.getPublicPosts(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Posts retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 3. Public post detail by slug
const getPostBySlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slug = String(req.params.slug);
    const result = await blogService.getPostBySlug(slug);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Post retrieved successfully.",
      data: result,
    });
  },
);

// 4. All posts controller (ADMIN moderation)
const getAllPosts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await blogService.getAllPosts(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All posts retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

// 5. Update post controller (AGENT own / ADMIN any)
const updatePost = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const result = await blogService.updatePost(req.user!, id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Post updated successfully.",
      data: result,
    });
  },
);

// 6. Change post status controller (ADMIN publish/unpublish)
const changePostStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const result = await blogService.changePostStatus(id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Post status updated successfully.",
      data: result,
    });
  },
);

// 7. Soft delete post controller (AGENT own / ADMIN any)
const softDeletePost = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    await blogService.softDeletePost(req.user!, id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Post deleted successfully.",
      data: null,
    });
  },
);

export const blogController = {
  createPost,
  getPublicPosts,
  getPostBySlug,
  getAllPosts,
  updatePost,
  changePostStatus,
  softDeletePost,
};
