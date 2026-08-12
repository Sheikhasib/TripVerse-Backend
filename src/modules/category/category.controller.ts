import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { categoryService } from "./category.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// Create category controller (admin)
const createCategory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const category = await categoryService.createCategory(req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Category created successfully.",
      data: category,
    });
  },
);

// Get all categories controller (public)
const getAllCategories = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const categories = await categoryService.getAllCategories();

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All categories fetched successfully.",
      data: categories,
    });
  },
);

// Update category controller (admin)
const updateCategory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    const category = await categoryService.updateCategory(id, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Category updated successfully.",
      data: category,
    });
  },
);

// Delete category controller (admin)
const deleteCategory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    await categoryService.deleteCategory(id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Category deleted successfully.",
      data: null,
    });
  },
);

export const categoryController = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};