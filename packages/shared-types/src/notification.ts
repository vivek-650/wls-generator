export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}
