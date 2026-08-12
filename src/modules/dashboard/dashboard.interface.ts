import { BookingStatus, Role } from "../../../generated/prisma/enums";

export interface IDashboardQuery {
  days?: number;
}

export interface IUsersByRole {
  role: Role;
  count: number;
}

export interface IBookingsByStatus {
  status: BookingStatus;
  count: number;
}

export interface IPackagesByCategory {
  category: string;
  count: number;
}

export interface IRevenuePoint {
  date: string;
  revenue: number;
}

export interface IUpcomingBooking {
  id: string;
  travelDate: Date;
  travelers: number;
  totalPrice: number;
  status: BookingStatus;
  package: { id: string; title: string; slug: string };
}

export interface IAdminDashboard {
  totalUsers: number;
  totalPackages: number;
  totalBookings: number;
  totalRevenue: number;
  usersByRole: IUsersByRole[];
  bookingsByStatus: IBookingsByStatus[];
  packagesByCategory: IPackagesByCategory[];
  revenueOverTime: IRevenuePoint[];
}

export interface IAgentDashboard {
  totalPackages: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  bookingsByStatus: IBookingsByStatus[];
  revenueOverTime: IRevenuePoint[];
}

export interface IUserDashboard {
  totalBookings: number;
  totalSpend: number;
  upcomingCount: number;
  upcoming: IUpcomingBooking[];
}