import bcrypt from "bcryptjs";
import { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import {
  IChangeRole,
  IChangeStatus,
  IUpdateProfile,
  IUserQuery,
} from "./user.interface";

const validateActiveUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "User is suspended. Please contact support service.");
  }

  return user;
};

// ── Update profile ──────────────────────────────────────────────────────
const updateProfile = async (userId: string, payload: IUpdateProfile) => {
  const { name, phone, avatarUrl, currentPassword, newPassword } = payload;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.authProvider === "GOOGLE") {
    throw new AppError(
      403,
      "Google accounts cannot change password. Use Google sign-in to manage your profile.",
    );
  }

  const data: Prisma.UserUpdateInput = {};

  if (name) data.name = name;
  if (phone) data.phone = phone;
  if (avatarUrl) data.avatarUrl = avatarUrl;

  // Password change requires currentPassword + newPassword
  if (newPassword) {
    if (!currentPassword) {
      throw new AppError(400, "Current password is required");
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, "New password must be different");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password || "");
    if (!isMatch) {
      throw new AppError(400, "Invalid current password");
    }

    data.password = await bcrypt.hash(
      newPassword,
      Number(config.bcrypt_salt_rounds),
    );
    data.tokenVersion = { increment: 1 };
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
    omit: { password: true },
  });

  return updatedUser;
};

// ── Admin: list users ───────────────────────────────────────────────────
const getUsers = async (query: IUserQuery) => {
  const page = query.page || 1;
  const limit = query.limit || 10;

  const where: Prisma.UserWhereInput = {
    isDeleted: false,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      omit: { password: true },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── Admin: update role ──────────────────────────────────────────────────
const changeRole = async (id: string, payload: IChangeRole) => {
  const { role } = payload;

  await validateActiveUser(id);

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    omit: { password: true },
  });

  return updatedUser;
};

// ── Admin: update status ────────────────────────────────────────────────
const changeStatus = async (id: string, payload: IChangeStatus) => {
  const { status } = payload;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      status,
      // reactivating preserves the account while suspending revokes all sessions
      ...(status === UserStatus.SUSPENDED && { tokenVersion: { increment: 1 } }),
    },
    omit: { password: true },
  });

  return updatedUser;
};

// ── Admin: soft delete ──────────────────────────────────────────────────
const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  const deletedUser = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, tokenVersion: { increment: 1 } },
    omit: { password: true },
  });

  return deletedUser;
};

export const userService = {
  updateProfile,
  getUsers,
  changeRole,
  changeStatus,
  deleteUser,
};