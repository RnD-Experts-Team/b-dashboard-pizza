"use client";

import { useCallback, useEffect, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import { ACTIVE_RUN_STATUSES, type ReportRun, type RunFormat } from "@/types/report-builder.types";

/** How often a queued or running run is asked for again. */
const RUN_POLL_MS = 3_000;
/** The longest a failed poll waits before trying again, whatever Retry-After says. */
const MAX_RETRY_MS = 30_000;
const MS_PER_SECOND = 1_000;
/** Answers that will not change by asking again: signed out, no access, gone. */
const STOP_POLLING_STATUSES = [401, 403, 404, 410];

export const isActiveRun = (run: Pick<ReportRun, "status"> | null | undefined): boolean =>
  Boolean(run && ACTIVE_RUN_STATUSES.includes(run.status));

/**
 * Loads with `fetcher`, then — while `keepPolling(value)` — loads again every
 * 3 s. A failed poll keeps the last good value and shows the error, then tries
 * again (after the server's Retry-After when it sent one, at most 30 s) unless
 * the answer is final (401/403/404/410). Stops on unmount or when the key changes.
 */
function usePolled<T>(
  enabled: boolean,
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  keepPolling: (value: T) => boolean,
): { value: T | null; isLoading: boolean; error: ReportError | null; reload: () => void } {
  const [value, setValue] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: T | null = null;
    const tick = async (first: boolean) => {
      if (first) setIsLoading(true);
      try {
        const next = await fetcher(controller.signal);
        if (controller.signal.aborted) return;
        last = next;
        setValue(next);
        setError(null);
        if (keepPolling(next)) timer = setTimeout(() => void tick(false), RUN_POLL_MS);
      } catch (err) {
        if (isCancelled(err) || controller.signal.aborted) return;
        const failure = readReportError(err);
        setError(failure);
        const final = failure.status !== null && STOP_POLLING_STATUSES.includes(failure.status);
        if (last !== null && !final && keepPolling(last)) {
          const wait = failure.retryAfter !== null ? Math.min(failure.retryAfter * MS_PER_SECOND, MAX_RETRY_MS) : 0;
          timer = setTimeout(() => void tick(false), Math.max(RUN_POLL_MS, wait));
        }
      } finally {
        if (first && !controller.signal.aborted) setIsLoading(false);
      }
    };
    void tick(true);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    // `fetcher` / `keepPolling` are recreated each render; `key` names what they load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { value, isLoading, error, reload };
}

interface UseReportRunsResult {
  runs: ReportRun[];
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
}

/** The caller's runs, polled every 3 s while any of them is queued or running. */
export function useReportRuns(enabled = true): UseReportRunsResult {
  const { value, isLoading, error, reload } = usePolled<ReportRun[]>(
    enabled,
    "runs",
    (signal) => reportBuilderService.listRuns(signal),
    (runs) => runs.some(isActiveRun),
  );
  return { runs: value ?? [], isLoading, error, reload };
}

interface UseReportRunResult {
  run: ReportRun | null;
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
}

/** One run, polled every 3 s while queued or running. */
export function useReportRun(runId: string | null): UseReportRunResult {
  const { value, isLoading, error, reload } = usePolled<ReportRun>(
    runId !== null,
    runId ?? "",
    (signal) => reportBuilderService.getRun(runId ?? "", signal),
    isActiveRun,
  );
  return { run: value, isLoading, error, reload };
}

interface UseStartRunResult {
  isStarting: boolean;
  /** Queues a run of a saved template and resolves with it (status "queued"). */
  start: (templateId: string | number, format?: RunFormat) => Promise<ReportRun>;
}

/** Every run writes a CSV; the default asks for the XLSX too so both downloads exist. */
export function useStartRun(): UseStartRunResult {
  const [isStarting, setIsStarting] = useState(false);
  const start = useCallback(async (templateId: string | number, format: RunFormat = "xlsx") => {
    setIsStarting(true);
    try {
      return await reportBuilderService.run(templateId, format);
    } finally {
      setIsStarting(false);
    }
  }, []);
  return { isStarting, start };
}
