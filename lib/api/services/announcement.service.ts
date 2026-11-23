import axios from "axios";
import type {
  Announcement,
  CreateAnnouncementPayload,
  LikeResult,
  PageResult,
  UpdateAnnouncementPayload,
} from "@/types/announcement.types";
import {
  normalizeAnnouncement,
  normalizeAnnouncementList,
  normalizeLike,
  normalizePage,
} from "@/lib/announcements/normalize";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper — reads the Zustand-persisted token from localStorage       */
/*                                                                          */
/*  Bare axios on purpose, never `axiosClient`: its 401 interceptor logs    */
/*  the user out, and a 401 here can just mean "not synced into the         */
/*  Notifications service yet".                                             */
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

const REQUEST_TIMEOUT_MS = 15_000;
const ADMIN_PAGE_SIZE = 15;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/*                                                                          */
/*  Every method throws the raw axios error; callers turn it into an        */
/*  `AnnouncementError` with `parseAnnouncementError`.                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const announcementService = {
  /**
   * Visible announcements for the current user (active, inside their window),
   * with `seen` / `liked_by_me` / `likes_count`.
   * GET /api/announcements/visible
   */
  async getVisibleAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await axios.get<unknown>("/api/announcements/visible", {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeAnnouncementList(data);
  },

  /**
   * Announcements this user has not marked seen, oldest first.
   * GET /api/announcements/unseen
   */
  async getUnseenAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await axios.get<unknown>("/api/announcements/unseen", {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeAnnouncementList(data);
  },

  /**
   * One page of the admin list (always everything, newest settings included).
   * GET /api/announcements?page=&per_page=
   */
  async listAdmin(
    { page = 1, perPage = ADMIN_PAGE_SIZE }: { page?: number; perPage?: number } = {},
    signal?: AbortSignal,
  ): Promise<PageResult<Announcement>> {
    const { data } = await axios.get<unknown>("/api/announcements", {
      headers: buildHeaders(),
      params: { page, per_page: perPage },
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizePage(data, normalizeAnnouncement, { page, perPage });
  },

  /**
   * One announcement.
   * GET /api/announcements/:id
   */
  async getAnnouncement(id: number, signal?: AbortSignal): Promise<Announcement> {
    const { data } = await axios.get<unknown>(`/api/announcements/${id}`, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeAnnouncement(data);
  },

  /**
   * Create an announcement (admin).
   * POST /api/announcements
   */
  async createAnnouncement(
    payload: CreateAnnouncementPayload,
    signal?: AbortSignal,
  ): Promise<Announcement> {
    const { data } = await axios.post<unknown>("/api/announcements", payload, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeAnnouncement(data);
  },

  /**
   * Partial update (admin): send only the changed keys.
   * PUT /api/announcements/:id
   */
  async updateAnnouncement(
    id: number,
    payload: UpdateAnnouncementPayload,
    signal?: AbortSignal,
  ): Promise<Announcement> {
    const { data } = await axios.put<unknown>(`/api/announcements/${id}`, payload, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeAnnouncement(data);
  },

  /**
   * Delete an announcement (admin). The backend also deletes its own uploaded
   * media file, never a picked GIF.
   * DELETE /api/announcements/:id
   */
  async deleteAnnouncement(id: number, signal?: AbortSignal): Promise<void> {
    await axios.delete(`/api/announcements/${id}`, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
  },

  /**
   * Mark announcements as seen.
   * POST /api/announcements/mark-seen
   */
  async markAnnouncementsSeen(ids: number[], signal?: AbortSignal): Promise<void> {
    await axios.post(
      "/api/announcements/mark-seen",
      { announcement_ids: ids },
      { headers: buildHeaders(), timeout: REQUEST_TIMEOUT_MS, signal },
    );
  },

  /**
   * Like or unlike (a toggle). The answer is the resulting state.
   * POST /api/announcements/:id/like
   */
  async toggleLike(id: number, signal?: AbortSignal): Promise<LikeResult> {
    const { data } = await axios.post<unknown>(`/api/announcements/${id}/like`, undefined, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeLike(data);
  },
};
