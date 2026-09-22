import { NotificationListResponse } from "@wlr/shared-types";
import { AppError } from "../errors/AppError";
import { countUnread, listForUser, markAllRead, markRead } from "../repositories/notificationRepository";
import { AuthenticatedUser } from "./candidateService";

export async function listNotifications(user: AuthenticatedUser): Promise<NotificationListResponse> {
  const [notifications, unreadCount] = await Promise.all([listForUser(user), countUnread(user)]);
  return { notifications, unreadCount };
}

export async function markNotificationRead(user: AuthenticatedUser, notificationId: string): Promise<void> {
  if (!notificationId) {
    throw AppError.badRequest("A notification id is required");
  }
  await markRead(user, notificationId);
}

export async function markAllNotificationsRead(user: AuthenticatedUser): Promise<void> {
  await markAllRead(user);
}
