import { NotificationType } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";

// Best-effort in-app notification — mirrors the email helpers. A failure is
// logged and swallowed, never thrown, so a notification insert can't fail the
// business write that caused it. Call sites fire it as
// `runInBackground([notify(...)])`.
export const notify = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
): Promise<void> => {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch (error) {
    console.error(
      `[notification] failed to create ${type} for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};