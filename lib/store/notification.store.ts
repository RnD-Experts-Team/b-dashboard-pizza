import { create } from "zustand";
import axios from "axios";
import type { Notification } from "@/types/notification.types";
import { notificationService } from "@/lib/api/services/notification.service";

interface NotificationStoreState {
  notifications: Notification[];
  unreadCount: number;
  /**
   * Full unread notification objects, kept in sync independently of
   * `notifications` (which only populates once the panel fetches page 1).
   * Powers sidebar-dot mapping via getNotificationPageSegment.
   */
  unreadNotifications: Notification[];
  isLoading: boolean;
  error: string | null;
}

interface NotificationStoreActions {
  fetchNotifications: (signal?: AbortSignal) => Promise<void>;
  fetchUnreadNotifications: (signal?: AbortSignal) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Prepend a notification received from the WebSocket channel */
  addNotification: (notification: Notification) => void;
}

type NotificationStore = NotificationStoreState & NotificationStoreActions;

export const useNotificationStore = create<NotificationStore>()((set) => ({
  notifications: [],
  unreadCount: 0,
  unreadNotifications: [],
  isLoading: false,
  error: null,

  fetchNotifications: async (signal?: AbortSignal) => {
    set({ isLoading: true, error: null });
    try {
      const response = await notificationService.getNotifications(1, signal);
      set({
        notifications: response.data,
        unreadCount: response.data.filter((n) => n.read_at === null).length,
        isLoading: false,
      });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({
        error: err instanceof Error ? err.message : "Failed to load notifications",
        isLoading: false,
      });
    }
  },

  fetchUnreadNotifications: async (signal?: AbortSignal) => {
    try {
      const data = await notificationService.getUnreadNotifications(signal);
      set({ unreadCount: data.length, unreadNotifications: data });
    } catch (err) {
      if (axios.isCancel(err)) return;
    }
  },

  markAsRead: async (id: number) => {
    // Optimistically update the UI
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => n.read_at === null).length,
        unreadNotifications: state.unreadNotifications.filter((n) => n.id !== id),
      };
    });
    try {
      await notificationService.markAsRead(id);
    } catch {
      // Revert on failure — refetch
      const ctrl = new AbortController();
      const response = await notificationService.getNotifications(1, ctrl.signal);
      set({
        notifications: response.data,
        unreadCount: response.data.filter((n) => n.read_at === null).length,
      });
    }
  },

  markAllAsRead: async () => {
    // Optimistically update the UI
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
      unreadCount: 0,
      unreadNotifications: [],
    }));
    try {
      await notificationService.markAllAsRead();
    } catch {
      // Revert on failure — refetch
      const ctrl = new AbortController();
      const response = await notificationService.getNotifications(1, ctrl.signal);
      set({
        notifications: response.data,
        unreadCount: response.data.filter((n) => n.read_at === null).length,
      });
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => {
      // Avoid duplicates (same id already in the list)
      if (state.notifications.some((n) => n.id === notification.id)) {
        return state;
      }
      const notifications = [notification, ...state.notifications];
      const unreadNotifications = state.unreadNotifications.some((n) => n.id === notification.id)
        ? state.unreadNotifications
        : [notification, ...state.unreadNotifications];
      return {
        notifications,
        unreadCount: notifications.filter((n) => n.read_at === null).length,
        unreadNotifications,
      };
    });
  },
}));
