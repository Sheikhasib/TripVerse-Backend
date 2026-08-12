import { BookingStatus } from "../../../generated/prisma/enums";

export interface ICreateBooking {
  packageId: string;
  travelDate: Date;
  travelers: number;
}

export interface IBookingQuery {
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

export interface IBookingSearchQuery extends IBookingQuery {
  search?: string;
}

export interface IUpdateBookingStatus {
  status: BookingStatus;
}