"use client";

import { useState, useCallback } from "react";
import { screenProjectMediaService } from "@/lib/api/services/screen-project-media.service";
import type {
  StationMedia,
  MediaUploadJob,
  FinalizeUploadItem,
} from "@/types/screen-project-media.types";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

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
    video.src = url;
  });
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

      // ── Step 1: init all uploads, build jobs ───────────────────────
      const initResults: Array<{
        file: File;
        uploadId: string;
        totalChunks: number;
      }> = [];

      for (const file of files) {
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        try {
          const { upload_id } = await screenProjectMediaService.initUpload(
            storeId,
            stationNumber,
            totalChunks,
          );
          initResults.push({ file, uploadId: upload_id, totalChunks });
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

      const validInits = initResults.filter(Boolean);
      if (validInits.length === 0) return;

      // ── Step 2: upload all chunks for all files in parallel ────────
      await Promise.all(
        validInits.map(async ({ file, uploadId, totalChunks }) => {
          const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
          await Promise.all(
            chunkIndices.map(async (i) => {
              const start = i * CHUNK_SIZE;
              const chunk = file.slice(start, start + CHUNK_SIZE);
              try {
                await screenProjectMediaService.uploadChunk(
                  storeId,
                  stationNumber,
                  uploadId,
                  i,
                  chunk,
                );
                setUploadJobs((prev) =>
                  prev.map((j) =>
                    j.uploadId === uploadId
                      ? { ...j, uploadedChunks: j.uploadedChunks + 1 }
                      : j,
                  ),
                );
              } catch {
                setUploadJobs((prev) =>
                  prev.map((j) =>
                    j.uploadId === uploadId
                      ? { ...j, status: "error", error: `Chunk ${i} failed` }
                      : j,
                  ),
                );
                throw new Error(`Chunk ${i} of "${file.name}" failed`);
              }
            }),
          );
        }),
      );

      // ── Step 3: extract dimensions/duration client-side ───────────
      const finalizeItems: FinalizeUploadItem[] = await Promise.all(
        validInits.map(async ({ file, uploadId, totalChunks }) => {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");

          let width: number | null = null;
          let height: number | null = null;
          let duration_seconds: number | null = null;

          if (isImage) {
            const dims = await getImageDimensions(file);
            width = dims?.width ?? null;
            height = dims?.height ?? null;
          } else if (isVideo) {
            duration_seconds = await getVideoDuration(file);
          }

          return {
            upload_id: uploadId,
            file_name: file.name,
            total_chunks: totalChunks,
            total_size: file.size,
            type: isImage ? ("image" as const) : ("video" as const),
            mime_type: file.type || null,
            width,
            height,
            duration_seconds,
          };
        }),
      );

      // ── Step 4: mark all jobs as finalizing ───────────────────────
      setUploadJobs((prev) =>
        prev.map((j) =>
          validInits.some((v) => v.uploadId === j.uploadId)
            ? { ...j, status: "finalizing" as const }
            : j,
        ),
      );

      // ── Step 5: bulk finalize ─────────────────────────────────────
      try {
        const response = await screenProjectMediaService.finalizeUploadsBulk(
          storeId,
          stationNumber,
          finalizeItems,
        );

        // Mark jobs done or errored based on per-item results
        setUploadJobs((prev) =>
          prev.map((j) => {
            const result = response.results.find(
              (r) => r.upload_id === j.uploadId,
            );
            if (!result) return j;
            return result.success
              ? { ...j, status: "done" as const }
              : { ...j, status: "error" as const, error: result.error };
          }),
        );

        // Refresh media list
        await fetchMedia();

        // Clear done jobs after 2 s
        setTimeout(() => {
          setUploadJobs((prev) =>
            prev.filter((j) => j.status !== "done"),
          );
        }, 2000);
      } catch {
        setUploadJobs((prev) =>
          prev.map((j) =>
            validInits.some((v) => v.uploadId === j.uploadId)
              ? { ...j, status: "error" as const, error: "Finalize failed" }
              : j,
          ),
        );
      }
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
