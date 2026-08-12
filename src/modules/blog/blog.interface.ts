import { PostStatus, Role } from "../../../generated/prisma/enums";

export interface ICreatePostPayload {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
}

export type IUpdatePostPayload = Partial<ICreatePostPayload>;

export interface IPostQuery {
  search?: string;
  sortBy?: "newest" | "oldest" | "title";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface IInternalPostQuery {
  status?: PostStatus;
  page?: number;
  limit?: number;
}

export interface IPostParams {
  id: string;
}

export interface IPostSlugParams {
  slug: string;
}

export interface IUpdatePostStatusPayload {
  status: "DRAFT" | "PUBLISHED";
}

// role + id: the request's own identity, used for ownership checks.
export interface IRequestUser {
  id: string;
  role: Role;
}
