"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { screenProjectMediaService } from "@/lib/api/services/screen-project-media.service";
import type {
  StationMedia,
  MediaUploadJob,
  FinalizeUploadItem,
} from "@/types/screen-project-media.types";

// Small chunks: on a store's slow line a 2 MB chunk still goes through well
// inside the stall window, and a retry re-sends little.
const CHUNK_SIZE = 2 * 1024 * 1024;
// Chunk requests in flight at once, across every file of the batch. Sending
// them all together made each one share the line and time out together.
const PARALLEL_CHUNKS = 3;
// Attempts per request before the file is marked failed.
const MAX_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 20_000;
// A video whose metadata never loads must not hold the upload back.
const VIDEO_METADATA_TIMEOUT_MS = 10_000;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const MS_PER_SECOND = 1_000;
const CLEAR_DONE_JOBS_AFTER_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worth sending again: the network dropped, the request stalled or timed
 * out, the server was busy (429) or failed (5xx). Any other 4xx answer will
 * not change on a retry.
 */
function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status === undefined) return true;
  return (
    status === HTTP_REQUEST_TIMEOUT ||
    status === HTTP_TOO_MANY_REQUESTS ||
    status >= HTTP_SERVER_ERROR
  );
}

/** Retry-After in ms when the server sent one, else exponential backoff. */
function retryDelay(err: unknown, attempt: number): number {
  if (axios.isAxiosError(err)) {
    const seconds = Number(err.response?.headers?.["retry-after"]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * MS_PER_SECOND;
  }
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
}

async function withRetry<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
      await sleep(retryDelay(err, attempt));
    }
  }
}

/** Per-item result of a bulk finalize, as best we can read it. */
interface BulkResultItem {
  upload_id?: string;
  success?: boolean;
  error?: string;
}

/**
 * The complete-bulk endpoint's success shape varies (bare array, `{ results }`,
 * or wrapped in `{ data }`). Find the per-item results array wherever it lives.
 * Returns [] when none is present — the caller then treats a 2xx response as a
 * success for every item (a bug previously marked successful uploads as failed
 * because it assumed `response.results` always existed).
 */
function extractBulkResults(resp: unknown): BulkResultItem[] {
  if (Array.isArray(resp)) return resp as BulkResultItem[];
  if (!resp || typeof resp !== "object") return [];
  const r = resp as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  const candidates = [r.results, data?.results, r.data, r.items];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as BulkResultItem[];
  }
  return [];
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers for client-side dimension / duration extraction                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, VIDEO_METADATA_TIMEOUT_MS);
    video.src = url;
  });
}

/** The finalize payload for one file, with its dimensions or duration read client-side. */
async function describeUpload(
  file: File,
  uploadId: string,
  totalChunks: number,
): Promise<FinalizeUploadItem> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const dims = isImage ? await getImageDimensions(file) : null;
  const duration_seconds = isVideo ? await getVideoDuration(file) : null;

  return {
    upload_id: uploadId,
    file_name: file.name,
    total_chunks: totalChunks,
    total_size: file.size,
    type: isImage ? "image" : "video",
    mime_type: file.type || null,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    duration_seconds,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Hook                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface UseScreenProjectMediaResult {
  mediaItems: StationMedia[];
  uploadJobs: MediaUploadJob[];
  isLoading: boolean;
  isDeleting: boolean;
  hasFetched: boolean;
  primaryMedia: StationMedia | null;
  fetchMedia: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  setPrimary: (mediaId: number) => Promise<void>;
  deleteMedia: (ids: number[]) => Promise<void>;
}

export function useScreenProjectMedia(
  storeId: string | null,
  stationNumber: number | null,
  options?: { isPublic?: boolean; initialMedia?: StationMedia[] },
): UseScreenProjectMediaResult {
  const [mediaItems, setMediaItems] = useState<StationMedia[]>(options?.initialMedia ?? []);
  const [uploadJobs, setUploadJobs] = useState<MediaUploadJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Pre-seeded from the token response → skip the initial fetch
  const [hasFetched, setHasFetched] = useState((options?.initialMedia?.length ?? 0) > 0);

  const primaryMedia = mediaItems.find((m) => m.is_primary) ?? null;

  /* ── Fetch ────────────────────────────────────────────────────────── */
  const fetchMedia = useCallback(async () => {
    if (!storeId || stationNumber === null) return;
    setIsLoading(true);
    try {
      const items = options?.isPublic
        ? await screenProjectMediaService.listMediaPublic(storeId, stationNumber)
        : await screenProjectMediaService.listMedia(storeId, stationNumber);
      setMediaItems(Array.isArray(items) ? items : []);
      setHasFetched(true);
    } catch {
      // non-fatal — grid will stay empty
    } finally {
      setIsLoading(false);
    }
  }, [storeId, stationNumber, options?.isPublic]);
  /* ── Upload ───────────────────────────────────────────────────────── */
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!storeId || stationNumber === null || files.length === 0) return;

      const updateJob = (
        uploadId: string,
        patch: (j: MediaUploadJob) => Partial<MediaUploadJob>,
      ) =>
        setUploadJobs((prev) =>
          prev.map((j) => (j.uploadId === uploadId ? { ...j, ...patch(j) } : j)),
        );

      // ── Step 1: init every upload, build jobs ───────────────────────
      const uploads: Array<{ file: File; uploadId: string; totalChunks: number }> = [];

      for (const file of files) {
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        try {
          const { upload_id } = await withRetry(() =>
            screenProjectMediaService.initUpload(storeId, stationNumber, totalChunks),
          );
          uploads.push({ file, uploadId: upload_id, totalChunks });
          setUploadJobs((prev) => [
            ...prev,
            {
              uploadId: upload_id,
              fileName: file.name,
              totalChunks,
              uploadedChunks: 0,
              status: "uploading",
            },
          ]);
        } catch {
          setUploadJobs((prev) => [
            ...prev,
            {
              uploadId: `failed-${file.name}-${Date.now()}`,
              fileName: file.name,
              totalChunks: 1,
              uploadedChunks: 0,
              status: "error",
              error: "Failed to init upload",
            },
          ]);
        }
      }

      if (uploads.length === 0) return;

      // ── Step 2: finalize one file as soon as all its chunks are in ──
      const finalize = async ({ file, uploadId, totalChunks }: (typeof uploads)[number]) => {
        updateJob(uploadId, () => ({ status: "finalizing" }));
        const item = await describeUpload(file, uploadId, totalChunks);
        try {
          // Single attempt: the server deletes the chunks once it has built
          // the file, so a retry after a lost answer could only fail.
          const response = await screenProjectMediaService.finalizeUploadsBulk(
            storeId,
            stationNumber,
            [item],
          );
          // A failed item comes back as { upload_id, error } inside a 2xx.
          const result = extractBulkResults(response).find((r) => r.upload_id === uploadId);
          const error = result?.error ?? (result?.success === false ? "Upload failed" : null);
          updateJob(uploadId, () => (error ? { status: "error", error } : { status: "done" }));
        } catch {
          updateJob(uploadId, () => ({ status: "error", error: "Finalize failed" }));
        }
      };

      // ── Step 3: send the chunks through a small worker pool ─────────
      // One queue for the whole batch, files in order, so the first file
      // finishes (and is finalized) first. A file whose chunk gives up is
      // skipped from then on; the other files carry on.
      const failed = new Set<string>();
      const remaining = new Map(uploads.map((u) => [u.uploadId, u.totalChunks]));
      const finalizes: Promise<void>[] = [];
      const queue = uploads.flatMap((u) =>
        Array.from({ length: u.totalChunks }, (_, index) => ({ upload: u, index })),
      );

      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { upload, index } = next;
          const { file, uploadId, totalChunks } = upload;
          if (failed.has(uploadId)) continue;
          const start = index * CHUNK_SIZE;
          try {
            await withRetry(() =>
              screenProjectMediaService.uploadChunk(
                storeId,
                stationNumber,
                uploadId,
                index,
                file.slice(start, start + CHUNK_SIZE),
              ),
            );
          } catch {
            failed.add(uploadId);
            updateJob(uploadId, () => ({
              status: "error",
              error: `Chunk ${index + 1} of ${totalChunks} failed`,
            }));
            continue;
          }
          if (failed.has(uploadId)) continue;
          updateJob(uploadId, (j) => ({ uploadedChunks: j.uploadedChunks + 1 }));
          const left = (remaining.get(uploadId) ?? 0) - 1;
          remaining.set(uploadId, left);
          if (left === 0) finalizes.push(finalize(upload));
        }
      };

      await Promise.all(Array.from({ length: PARALLEL_CHUNKS }, worker));
      await Promise.all(finalizes);

      // ── Step 4: refresh the grid, clear the finished jobs ──────────
      await fetchMedia();
      setTimeout(() => {
        setUploadJobs((prev) => prev.filter((j) => j.status !== "done"));
      }, CLEAR_DONE_JOBS_AFTER_MS);
    },
    [storeId, stationNumber, fetchMedia],
  );

  /* ── Set primary ──────────────────────────────────────────────────── */
  const setPrimary = useCallback(
    async (mediaId: number) => {
      if (!storeId || stationNumber === null) return;
      // Optimistic update
      setMediaItems((prev) =>
        prev.map((m) => ({ ...m, is_primary: m.id === mediaId })),
      );
      try {
        await screenProjectMediaService.setPrimaryMedia(
          storeId,
          stationNumber,
          mediaId,
        );
      } catch {
        // Revert to server state on failure
        await fetchMedia();
      }
    },
    [storeId, stationNumber, fetchMedia],
  );

  /* ── Delete ───────────────────────────────────────────────────────── */
  const deleteMedia = useCallback(
    async (ids: number[]) => {
      if (!storeId || stationNumber === null || ids.length === 0) return;
      setIsDeleting(true);
      // Optimistic update
      setMediaItems((prev) => prev.filter((m) => !ids.includes(m.id)));
      try {
        await screenProjectMediaService.bulkDeleteMedia(
          storeId,
          stationNumber,
          ids,
        );
      } catch {
        // Revert on failure
        await fetchMedia();
      } finally {
        setIsDeleting(false);
      }
    },
    [storeId, stationNumber, fetchMedia],
  );

  return {
    mediaItems,
    uploadJobs,
    isLoading,
    isDeleting,
    hasFetched,
    primaryMedia,
    fetchMedia,
    uploadFiles,
    setPrimary,
    deleteMedia,
  };
}
