"use client";

import { useCallback, useEffect, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import type { ReportResult } from "@/types/report-builder.types";

interface UseReportRunRowsResult {
  result: ReportResult | null;
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
}

interface LoadedPage {
  runId: string;
  page: number;
  per: number;
  result: ReportResult;
}

/**
 * One page of a finished run, read by Data from the run's CSV
 * (`GET /report-builder/runs/{id}/rows?page&per`, 25–200 per page).
 * Only loads while `enabled` (the run is done). `result` is only ever the rows
 * of the page asked for: change the page or page size and it is empty until
 * the new page arrives, so a failed load shows its error, not the old rows.
 */
export function useReportRunRows(runId: string, page: number, per: number, enabled: boolean): UseReportRunRowsResult {
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await reportBuilderService.getRunRows(runId, page, per, controller.signal);
        setLoaded({ runId, page, per, result });
      } catch (err) {
        if (isCancelled(err)) return;
        setLoaded(null);
        setError(readReportError(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [runId, page, per, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const current = loaded && loaded.runId === runId && loaded.page === page && loaded.per === per;
  return { result: current ? loaded.result : null, isLoading, error, reload };
}
