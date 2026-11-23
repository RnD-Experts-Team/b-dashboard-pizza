import axios, { AxiosError } from "axios";
import type {
  GifResult,
  ImageUploadResult,
  VideoChunkMeta,
  VideoChunkResult,
  VideoInitPayload,
  VideoInitResult,
} from "@/types/announcement.types";
import {
  normalizeChunkResult,
  normalizeGifList,
  normalizeImageUpload,
  normalizeVideoInit,
} from "@/lib/announcements/normalize";
import { anySignal } from "@/lib/announcements/retry";

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
/** The BFF waits up to 120 s for Notifications on an upload; so does the browser. */
const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;
/** A chunk request that makes no progress for this long is aborted (and retried by the caller). */
export const CHUNK_STALL_MS = 45_000;
export const GIF_PAGE_SIZE = 24;

/** Called with raw bytes sent so far and the request's total (when known). */
export type ByteProgress = (loaded: number, total: number | undefined) => void;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/*                                                                          */
/*  Throws raw axios errors; callers use `parseAnnouncementError`.          */
/* ────────────────────────────────────────────────────────────────────────── */

export const announcementMediaService = {
  /**
   * Upload an image or a self-made GIF (jpg / jpeg / png / webp / gif, 10 MB).
   * POST /api/announcements/media/image, multipart field "media".
   * Show `media_url` as the preview; send `media_path` when saving.
   */
  async uploadImage(
    file: File,
    options: { onProgress?: ByteProgress; signal?: AbortSignal } = {},
  ): Promise<ImageUploadResult> {
    const form = new FormData();
    form.append("media", file);

    const { data } = await axios.post<unknown>("/api/announcements/media/image", form, {
      // Content-Type (with its boundary) is set by the browser for FormData.
      headers: buildHeaders(),
      timeout: IMAGE_UPLOAD_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (e) => options.onProgress?.(e.loaded, e.total),
    });
    return normalizeImageUpload(data, file.type === "image/gif" ? "gif" : "image");
  },

  /**
   * Trending GIFs (Giphy, proxied: no API key on the client).
   * GET /api/announcements/media/gifs/trending
   */
  async trendingGifs(
    { limit = GIF_PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<GifResult[]> {
    const { data } = await axios.get<unknown>("/api/announcements/media/gifs/trending", {
      headers: buildHeaders(),
      params: { limit, offset },
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeGifList(data);
  },

  /**
   * Search GIFs. Use `preview_url` for the grid; a pick is saved as
   * `{ media_path: gif.url, media_type: "gif" }` (never downloaded server-side).
   * GET /api/announcements/media/gifs/search
   */
  async searchGifs(
    q: string,
    { limit = GIF_PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<GifResult[]> {
    const { data } = await axios.get<unknown>("/api/announcements/media/gifs/search", {
      headers: buildHeaders(),
      params: { q, limit, offset },
      timeout: REQUEST_TIMEOUT_MS,
      signal,
    });
    return normalizeGifList(data);
  },

  /**
   * Start a chunked video upload. 422 when the size is over the server limit or
   * the extension isn't mp4 / mov / webm: call this BEFORE slicing the file.
   * Never invent your own upload_uuid.
   * POST /api/announcements/media/video/uploads
   */
  async initVideo(
    payload: VideoInitPayload,
    options: { signal?: AbortSignal } = {},
  ): Promise<VideoInitResult> {
    const { data } = await axios.post<unknown>(
      "/api/announcements/media/video/uploads",
      payload,
      { headers: buildHeaders(), timeout: REQUEST_TIMEOUT_MS, signal: options.signal },
    );
    return normalizeVideoInit(data);
  },

  /**
   * Upload one chunk. Chunks may go in any order. `meta` (width / height /
   * duration) is remembered server-side whichever chunk carries it. Only the
   * last chunk to arrive returns `status: "complete"` (with `media_path`).
   * POST /api/announcements/media/video/uploads/:uuid/chunks/:index
   *
   * No fixed total timeout: a store on a slow line may need minutes for a
   * chunk. Instead the request is aborted when it stops moving for `stallMs`
   * (no upload progress, or no answer after the last byte). That abort is
   * reported as an ECONNABORTED error (a timeout, retryable). A `signal` abort
   * stays an axios cancel (the user's, never retried).
   */
  async uploadChunk(
    uploadUuid: string,
    chunkIndex: number,
    chunk: Blob,
    options: {
      meta?: VideoChunkMeta;
      signal?: AbortSignal;
      onProgress?: ByteProgress;
      /** Raise it for the LAST chunk: the answer comes after the server assembles the file. */
      stallMs?: number;
    } = {},
  ): Promise<VideoChunkResult> {
    const { meta, signal, onProgress, stallMs = CHUNK_STALL_MS } = options;

    const form = new FormData();
    form.append("chunk", chunk, `chunk-${chunkIndex}.bin`);
    if (meta?.width != null) form.append("width", String(Math.round(meta.width)));
    if (meta?.height != null) form.append("height", String(Math.round(meta.height)));
    if (meta?.duration_seconds != null) {
      form.append("duration_seconds", String(Math.round(meta.duration_seconds)));
    }

    const stall = new AbortController();
    let stalled = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        stall.abort();
      }, stallMs);
    };

    armStallTimer();
    try {
      const { data } = await axios.post<unknown>(
        `/api/announcements/media/video/uploads/${encodeURIComponent(uploadUuid)}/chunks/${chunkIndex}`,
        form,
        {
          headers: buildHeaders(),
          signal: anySignal([stall.signal, signal]),
          onUploadProgress: (e) => {
            armStallTimer();
            onProgress?.(e.loaded, e.total);
          },
        },
      );
      return normalizeChunkResult(data);
    } catch (err) {
      if (stalled && axios.isCancel(err) && !signal?.aborted) {
        throw new AxiosError(
          "The upload stalled and was stopped.",
          AxiosError.ECONNABORTED,
        );
      }
      throw err;
    } finally {
      clearTimeout(stallTimer);
    }
  },

  /**
   * Cancel a chunked upload. Optional: the server cleans abandoned uploads up
   * after an hour. `keepalive` is for unmount / pagehide, where a normal request
   * would be cancelled by the browser: it uses `fetch` with `keepalive: true`
   * and never throws (best effort).
   * DELETE /api/announcements/media/video/uploads/:uuid
   */
  async cancelVideo(
    uploadUuid: string,
    options: { keepalive?: boolean; signal?: AbortSignal } = {},
  ): Promise<void> {
    const url = `/api/announcements/media/video/uploads/${encodeURIComponent(uploadUuid)}`;

    if (options.keepalive) {
      try {
        await fetch(url, {
          method: "DELETE",
          headers: buildHeaders(),
          keepalive: true,
        });
      } catch {
        /* the page is going away; nothing to report to */
      }
      return;
    }

    await axios.delete(url, {
      headers: buildHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
      signal: options.signal,
    });
  },
};
