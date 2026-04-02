/**
 * Notification System Types
 * Defines all TypeScript interfaces and types for the notification system.
 */

// ============================================================================
// Core Types
// ============================================================================

export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'announcement';

export type NotificationPriority = 'low' | 'medium' | 'high';

// ============================================================================
// Entity Types
// ============================================================================

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: NotificationPriority;
  actionUrl?: string;
}

// ============================================================================
// State Types
// ============================================================================

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Notification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}
