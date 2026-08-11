import { Role, UserStatus } from "../../../generated/prisma/enums";

export interface IUpdateProfile {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface IUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
}

export interface IChangeRole {
  role: Role;
}

export interface IChangeStatus {
  status: UserStatus;
}