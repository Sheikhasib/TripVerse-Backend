import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { INotificationQuery } from "./notification.interface";

// 1. My notifications (newest first) — optional ?unread=true filter.
const getMyNotifications = async (
  userId: string,
  query: INotificationQuery,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unread ? { isRead: false } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 2. Unread count for the bell badge — single index-backed count.
const getUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { count };
};

// 3. Mark one notification read (owner only — a foreign id is a 404).
const markAsRead = async (userId: string, id: string) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });

  if (result.count === 0) {
    throw new AppError(404, "Notification not found.");
  }

  return { count: result.count };
};

// 4. Mark all my notifications read — idempotent.
const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { count: result.count };
};

export const notificationService = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};