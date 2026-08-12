import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { bookingService } from "./booking.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const createBooking = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const booking = await bookingService.createBooking(userId, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Booking created successfully.",
      data: booking,
    });
  },
);

const getMyBookings = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const result = await bookingService.getMyBookings(userId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getAgentBookings = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const result = await bookingService.getAgentBookings(userId, req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getBookingDetail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    const booking = await bookingService.getBookingDetail(id, req.user!);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Booking retrieved successfully.",
      data: booking,
    });
  },
);

const getAllBookings = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await bookingService.getAllBookings(req.query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

const updateBookingStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    const booking = await bookingService.updateBookingStatus(
      id,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Booking status updated successfully.",
      data: booking,
    });
  },
);

export const bookingController = {
  createBooking,
  getMyBookings,
  getAgentBookings,
  getBookingDetail,
  getAllBookings,
  updateBookingStatus,
};