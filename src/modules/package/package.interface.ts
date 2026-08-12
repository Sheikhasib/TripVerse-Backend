import { PackageStatus, Role } from "../../../generated/prisma/enums";

export interface ICreatePackagePayload {
  title: string;
  description: string;
  location: string;
  price: number;
  duration: number;
  categoryId: string;
  images: string[];
  agentId?: string;
}

export type IUpdatePackagePayload = Partial<
  Omit<ICreatePackagePayload, "agentId">
>;

export interface IPackageQuery {
  search?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  maxDuration?: number;
  sortBy?: "newest" | "price" | "rating" | "title";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface IInternalPackageQuery {
  status?: PackageStatus;
  agentId?: string;
  page?: number;
  limit?: number;
}

export interface IPackageParams {
  id: string;
}

export interface IPackageSlugParams {
  slug: string;
}

export interface IUpdateStatusPayload {
  status: "APPROVED" | "REJECTED";
}

// role + id: the request's own identity, used for ownership checks.
export interface IRequestUser {
  id: string;
  role: Role;
}