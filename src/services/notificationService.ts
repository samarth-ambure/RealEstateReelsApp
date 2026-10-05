import { apiClient } from './api';

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  isRead?: boolean;
  created_at: string;
  createdAt?: string;
}

export interface NotificationsResponse {
  unread_count: number;
  unreadCount: number;
  notifications: AppNotification[];
}

export interface UnreadCountResponse {
  unread_count: number;
  unreadCount: number;
}

export interface MarkAsReadResponse {
  message: string;
  notification?: AppNotification;
}

export interface MarkAllAsReadResponse {
  message: string;
  updated_count?: number;
}

/**
 * Fetch all notifications for the authenticated user and unread count.
 * Calls GET /api/notifications
 */
export async function getNotifications(): Promise<NotificationsResponse> {
  const data = await apiClient.get<NotificationsResponse>('/api/notifications');
  return {
    unread_count: data?.unread_count ?? data?.unreadCount ?? 0,
    unreadCount: data?.unreadCount ?? data?.unread_count ?? 0,
    notifications: (data?.notifications || []).map((n) => ({
      ...n,
      isRead: n.is_read ?? n.isRead,
      createdAt: n.created_at ?? n.createdAt,
    })),
  };
}

/**
 * Fetch the unread notification count for the authenticated user.
 * Calls GET /api/notifications/unread-count
 */
export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const data = await apiClient.get<UnreadCountResponse>('/api/notifications/unread-count');
  const count = data?.unreadCount ?? data?.unread_count ?? 0;
  return {
    unread_count: count,
    unreadCount: count,
  };
}

/**
 * Mark a single notification as read.
 * Calls PATCH /api/notifications/:id/read
 */
export async function markAsRead(id: string | number): Promise<MarkAsReadResponse> {
  const data = await apiClient.patch<MarkAsReadResponse>(`/api/notifications/${id}/read`);
  return data;
}

/**
 * Mark all notifications as read for the authenticated user.
 * Calls PATCH /api/notifications/read-all
 */
export async function markAllAsRead(): Promise<MarkAllAsReadResponse> {
  const data = await apiClient.patch<MarkAllAsReadResponse>('/api/notifications/read-all');
  return data;
}

export const notificationService = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};

export default notificationService;
