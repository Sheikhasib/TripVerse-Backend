import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  sendContactAutoReply,
  sendContactNotification,
} from "../../utils/email";
import { IContactQuery, ICreateContactPayload } from "./contact.interface";

// 1. Create contact message (public)
const createMessage = async (payload: ICreateContactPayload) => {
  const createdMessage = await prisma.contactMessage.create({
    data: {
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
    },
  });

  // Emails are best-effort: a failure here must never fail the submission
  // (the message is already saved to the inbox).
  await Promise.allSettled([
    sendContactNotification({ ...createdMessage, createdAt: createdMessage.createdAt }),
    sendContactAutoReply({ ...createdMessage, createdAt: createdMessage.createdAt }),
  ]);

  return createdMessage;
};

// 2. List contact messages (admin only, paginated, filterable by isResolved)
const listMessages = async (query: IContactQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.ContactMessageWhereInput | undefined =
    query.isResolved === undefined
      ? undefined
      : { isResolved: query.isResolved };

  const [data, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// 3. Mark a contact message resolved/unresolved (admin only)
const resolveMessage = async (id: string, isResolved: boolean) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { isResolved },
  });
};

export const contactService = {
  createMessage,
  listMessages,
  resolveMessage,
};