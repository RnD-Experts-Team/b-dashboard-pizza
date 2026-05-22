import axios from "axios";
import type { Announcement, AnnouncementPaginatedResponse, CreateAnnouncementPayload, UpdateAnnouncementPayload } from "@/types/announcement.types";

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

export const announcementService = {
  /**
   * Fetch visible announcements for the current user.
   * Proxied through /api/announcements/visible → notifications API
   */
  async getVisibleAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await axios.get<Announcement[]>(
      "/api/announcements/visible",
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch unseen announcements for the current user.
   * Proxied through /api/announcements/unseen → notifications API
   * Response: Announcement[]
   */
  async getUnseenAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await axios.get<Announcement[]>(
      "/api/announcements/unseen",
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch all announcements (admin view).
   * Proxied through /api/announcements → notifications API
   * Response is paginated: { current_page, data: Announcement[], ... }
   */
  async getAllAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await axios.get<AnnouncementPaginatedResponse>(
      "/api/announcements",
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /**
   * Create a new announcement (admin only).
   * Proxied through POST /api/announcements → notifications API
   */
  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
    const { data } = await axios.post<Announcement>(
      "/api/announcements",
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Mark announcements as seen (user only).
   * Proxied through POST /api/announcements/mark-seen → notifications API
   */
  async markAnnouncementsSeen(ids: number[]): Promise<void> {
    await axios.post(
      "/api/announcements/mark-seen",
      { announcement_ids: ids },
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Fetch a single announcement by ID (admin).
   * Proxied through GET /api/announcements/:id → notifications API
   */
  async getAnnouncement(id: number): Promise<Announcement> {
    const { data } = await axios.get<Announcement>(
      `/api/announcements/${id}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Delete an announcement by ID (admin only).
   * Proxied through DELETE /api/announcements/:id → notifications API
   */
  async deleteAnnouncement(id: number): Promise<void> {
    await axios.delete(`/api/announcements/${id}`, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },

  /**
   * Update an existing announcement (admin only).
   * Proxied through PUT /api/announcements/:id → notifications API
   */
  async updateAnnouncement(id: number, payload: UpdateAnnouncementPayload): Promise<Announcement> {
    const { data } = await axios.put<Announcement>(
      `/api/announcements/${id}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },
};
