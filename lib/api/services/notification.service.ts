import axios from "axios";
import type { Notification, NotificationPaginatedResponse } from "@/types/notification.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper — reads the Zustand-persisted token from localStorage       */
/* ────────────────────────────────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const notificationService = {
  /**
   * Fetch all notifications (paginated).
   * Proxied through /api/notifications → notifications API
   */
  async getNotifications(page = 1, signal?: AbortSignal): Promise<NotificationPaginatedResponse> {
    const { data } = await axios.get<NotificationPaginatedResponse>(
      "/api/notifications",
      { headers: buildHeaders(), timeout: 15_000, signal, params: { page } },
    );
    return data;
  },

  /**
   * Fetch unread notifications only.
   * Proxied through /api/notifications/unread → notifications API
   */
  async getUnreadNotifications(signal?: AbortSignal): Promise<Notification[]> {
    const { data } = await axios.get<Notification[]>(
      "/api/notifications/unread",
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Mark a single notification as read.
   * Proxied through POST /api/notifications/:id/read → notifications API
   */
  async markAsRead(id: number): Promise<void> {
    await axios.post(
      `/api/notifications/${id}/read`,
      {},
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Mark all notifications as read.
   * Proxied through POST /api/notifications/read-all → notifications API
   */
  async markAllAsRead(): Promise<void> {
    await axios.post(
      "/api/notifications/read-all",
      {},
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },
};
