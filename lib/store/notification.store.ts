import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Notification } from "@/types/notification.types";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    type: "warning",
    title: "Low Inventory Alert",
    message:
      "Mozzarella cheese stock is running low. Only 5 units remaining in Store #12.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    read: false,
    priority: "high",
  },
  {
    id: "notif-2",
    type: "success",
    title: "Order Completed",
    message: "Order #4582 has been successfully delivered to the customer.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: false,
    priority: "medium",
  },
  {
    id: "notif-3",
    type: "info",
    title: "New Employee Onboarded",
    message:
      "John Smith has been added to Store #8 as a delivery driver.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: true,
    priority: "low",
  },
  {
    id: "notif-4",
    type: "error",
    title: "Oven Malfunction",
    message:
      "Oven #3 at Store #5 reported a temperature error. Maintenance requested.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    read: false,
    priority: "high",
  },
  {
    id: "notif-5",
    type: "announcement",
    title: "System Maintenance",
    message:
      "Scheduled maintenance on April 5th from 2:00 AM to 4:00 AM.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    priority: "medium",
  },
  {
    id: "notif-6",
    type: "info",
    title: "Weekly Report Ready",
    message:
      "Your weekly performance report for Store #12 is now available.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
    priority: "low",
  },
];

interface NotificationStoreState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => Notification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

let notifCounter = 100;

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set) => ({
      notifications: MOCK_NOTIFICATIONS,
      unreadCount: MOCK_NOTIFICATIONS.filter((n) => !n.read).length,

      addNotification: (partial) => {
        const notification: Notification = {
          ...partial,
          id: `notif-${crypto.randomUUID()}`,
          timestamp: new Date().toISOString(),
          read: false,
        };
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
        return notification;
      },

      markAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        }),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            read: true,
          })),
          unreadCount: 0,
        })),

      removeNotification: (id) =>
        set((state) => {
          const notifications = state.notifications.filter(
            (n) => n.id !== id
          );
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        }),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: "notification-storage",
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
