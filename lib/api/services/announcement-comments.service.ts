import axios from "axios";
import type {
  AnnouncementComment,
  CreateCommentPayload,
  LikeResult,
  PageResult,
} from "@/types/announcement.types";
import {
  normalizeComment,
  normalizeLike,
  normalizePage,
} from "@/lib/announcements/normalize";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper — reads the Zustand-persisted token from localStorage       */
/*  Bare axios, never `axiosClient` (its 401 interceptor logs the user out). */
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
export const COMMENTS_PAGE_SIZE = 10;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/*                                                                          */
/*  Throws raw axios errors; callers use `parseAnnouncementError`.          */
/* ────────────────────────────────────────────────────────────────────────── */

export const announcementCommentsService = {
  /**
   * One page of an announcement's comments, oldest first.
   * GET /api/announcements/:id/comments?page=&per_page=
   */
  async list(
    announcementId: number,
    { page = 1, perPage = COMMENTS_PAGE_SIZE }: { page?: number; perPage?: number } = {},
    signal?: AbortSignal,
  ): Promise<PageResult<AnnouncementComment>> {
    const { data } = await axios.get<unknown>(
      `/api/announcements/${announcementId}/comments`,
      {
        headers: buildHeaders(),
        params: { page, per_page: perPage },
        timeout: REQUEST_TIMEOUT_MS,
        signal,
      },
    );
    return normalizePage(data, normalizeComment, { page, perPage });
  },

  /**
   * Post a comment: text, an image or GIF, or both (at least one).
   * POST /api/announcements/:id/comments
   */
  async create(
    announcementId: number,
    payload: CreateCommentPayload,
    signal?: AbortSignal,
  ): Promise<AnnouncementComment> {
    const { data } = await axios.post<unknown>(
      `/api/announcements/${announcementId}/comments`,
      payload,
      { headers: buildHeaders(), timeout: REQUEST_TIMEOUT_MS, signal },
    );
    return normalizeComment(data);
  },

  /**
   * Delete a comment (the author only; 403 otherwise).
   * DELETE /api/announcements/:id/comments/:commentId
   */
  async remove(
    announcementId: number,
    commentId: number,
    signal?: AbortSignal,
  ): Promise<void> {
    await axios.delete(`/api/announcements/${announcementId}/comments/${commentId}`, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
  },

  /**
   * Like or unlike a comment (a toggle). The answer is the resulting state.
   * POST /api/announcements/:id/comments/:commentId/like
   */
  async toggleLike(
    announcementId: number,
    commentId: number,
    signal?: AbortSignal,
  ): Promise<LikeResult> {
    const { data } = await axios.post<unknown>(
      `/api/announcements/${announcementId}/comments/${commentId}/like`,
      undefined,
      { headers: buildHeaders(), timeout: REQUEST_TIMEOUT_MS, signal },
    );
    return normalizeLike(data);
  },
};
