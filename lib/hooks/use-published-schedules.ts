"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import { adaptPublished } from "@/lib/scheduling/adapters";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { PublishedSchedule } from "@/types/scheduling.types";

/**
 * Publishing a week, and the history of previously published ones.
 *
 * The screenshot travels as real multipart with a `Blob`, not a base64 data URL
 * inside JSON — at scale 2 a 10x7 grid renders to 1-3 MB, and base64 would
 * inflate that by a third for no reason.
 *
 * Re-publishing the same week SUPERSEDES the previous record upstream (its
 * `unpublished_at` is set) rather than creating an ambiguous second one, so the
 * list can show at most one live record per week.
 *
 * There is no unpublish or restore: the backend has the machinery — its batch
 * type enum lists both — but exposes no HTTP route for either.
 */

/** Matches the upstream cap; a bigger PNG is rejected outright. */
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

export interface UsePublishedSchedulesOptions {
  storeId: string | null;
  onSuccess?: (message: string) => void;
}

export interface UsePublishedSchedulesResult {
  schedules: PublishedSchedule[];
  isLoading: boolean;
  isPublishing: boolean;
  error: SchedulingError | null;
  clearError: () => void;
  refetch: () => void;
  publish: (weekStart: string, screenshot?: Blob | null) => Promise<boolean>;
  remove: (publishedId: string) => Promise<boolean>;
}

export function usePublishedSchedules({
  storeId,
  onSuccess,
}: UsePublishedSchedulesOptions): UsePublishedSchedulesResult {
  const [schedules, setSchedules] = useState<PublishedSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPublished = useCallback(async () => {
    if (!storeId) {
      setSchedules([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      // Raw Laravel paginator: rows under `data`, no outer envelope.
      const page = await schedulingService.listPublished(
        storeId,
        { per_page: 24 },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setSchedules((page?.data ?? []).map(adaptPublished));
    } catch (err) {
      if (controller.signal.aborted || axios.isCancel(err)) return;
      const parsed = parseSchedulingError(
        err,
        "Could not load published schedules.",
      );
      if (handleUnauthorized(parsed.status)) return;
      setError(parsed);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchPublished();
    return () => abortRef.current?.abort();
  }, [fetchPublished]);

  const publish = useCallback(
    async (weekStart: string, screenshot?: Blob | null) => {
      if (!storeId) return false;

      // Fail before the upload rather than after several megabytes of transfer.
      if (screenshot && screenshot.size > MAX_SCREENSHOT_BYTES) {
        setError(
          parseSchedulingError(
            new Error(
              "The schedule image is too large to upload. Try again with fewer employees on screen.",
            ),
          ),
        );
        return false;
      }

      setIsPublishing(true);
      setError(null);
      try {
        await schedulingService.publishWeek(
          storeId,
          weekStart,
          screenshot ?? undefined,
        );
        await fetchPublished();
        onSuccess?.("Week published");
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not publish this week.");
        if (handleUnauthorized(parsed.status)) return false;
        setError(parsed);
        return false;
      } finally {
        setIsPublishing(false);
      }
    },
    [storeId, fetchPublished, onSuccess],
  );

  const remove = useCallback(
    async (publishedId: string) => {
      if (!storeId) return false;
      setError(null);
      try {
        await schedulingService.deletePublished(storeId, publishedId);
        setSchedules((prev) => prev.filter((p) => p.id !== publishedId));
        onSuccess?.("Published schedule deleted");
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(
          err,
          "Could not delete this published schedule.",
        );
        if (handleUnauthorized(parsed.status)) return false;
        setError(parsed);
        return false;
      }
    },
    [storeId, onSuccess],
  );

  return {
    schedules,
    isLoading,
    isPublishing,
    error,
    clearError: () => setError(null),
    refetch: fetchPublished,
    publish,
    remove,
  };
}
