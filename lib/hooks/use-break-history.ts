"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { breaksService } from "@/lib/api/services/breaks.service";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import type {
  BreakEntry,
  BreakHistoryFilters,
  LaravelPaginator,
} from "@/types/breaks.types";

/** Paginated, filterable history (`GET breaks`, newest first). */
export function useBreakHistory(filters: BreakHistoryFilters) {
  const [page, setPage] = useState<LaravelPaginator<BreakEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BreakError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Stable dependency for an object the caller rebuilds every render.
  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await breaksService.listBreaks(
        JSON.parse(key) as BreakHistoryFilters,
        controller.signal
      );
      if (!controller.signal.aborted) setPage(result);
    } catch (err) {
      const parsed = parseBreakError(err);
      if (parsed.code !== "CANCELLED") setError(parsed);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { page, loading, error, reload: load };
}
