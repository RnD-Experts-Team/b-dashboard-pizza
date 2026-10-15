"use client";

import { useCallback, useEffect, useState } from "react";
import { screenUsageService } from "@/lib/api/services/screen-usage.service";
import type { UsageReport, UsageReportParams, UsageTimelineSegment } from "@/lib/screen-usage/types";

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Loads one keyed request at a time: a new key aborts the previous one; the
 * last data stays on screen while the next loads (the page dims it).
 */
function useKeyedLoad<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Loaded<T>>({ key: "", data: null, error: null });
  const fullKey = key === null ? "" : `${key}#${reload}`;

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setResult({ key: fullKey, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({ key: fullKey, data: prev.data, error: err instanceof Error ? err.message : String(err) }));
      });
    return () => controller.abort();
    // `load` is rebuilt every render; the key says when the request changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const refetch = useCallback(() => setReload((n) => n + 1), []);
  return {
    data: result.data,
    isLoading: key !== null && result.key !== fullKey,
    error: result.key === fullKey ? result.error : null,
    refetch,
  };
}

/** The monitoring report across stores; null params = nothing to load yet. */
export function useScreenUsageReport(params: UsageReportParams | null) {
  return useKeyedLoad<UsageReport>(params ? JSON.stringify(params) : null, (signal) =>
    screenUsageService.getReport(params!, signal),
  );
}

/** One manager's segments over one day. */
export function useScreenUsageTimeline(params: { stores: string[]; userId: number; from: string; to: string } | null) {
  return useKeyedLoad<UsageTimelineSegment[]>(params ? JSON.stringify(params) : null, (signal) =>
    screenUsageService.getTimeline(params!, signal),
  );
}
