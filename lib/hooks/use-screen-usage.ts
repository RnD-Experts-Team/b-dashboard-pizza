"use client";

import { useCallback, useEffect, useState } from "react";
import { screenUsageService } from "@/lib/api/services/screen-usage.service";
import type { UsageSegmentsResponse } from "@/lib/screen-usage/types";

interface Result {
  key: string;
  data: UsageSegmentsResponse | null;
  error: string | null;
}

/** Raw usage segments for a store and [from, to) — the report aggregates them itself. */
export function useScreenUsage(storeId: string | undefined, from: Date, to: Date) {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<Result>({ key: "", data: null, error: null });

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const key = storeId ? `${storeId}|${fromMs}|${toMs}|${reloadKey}` : "";

  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController();
    screenUsageService
      .getSegments(storeId, new Date(fromMs), new Date(toMs), controller.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Keep the last data on screen; only the error changes.
        setResult((prev) => ({ key, data: prev.data, error: err instanceof Error ? err.message : String(err) }));
      });
    return () => controller.abort();
  }, [storeId, fromMs, toMs, key]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    data: result.data,
    // Loading = the latest finished request isn't for the current store/range yet.
    isLoading: !!storeId && result.key !== key,
    error: result.key === key ? result.error : null,
    refetch,
  };
}
