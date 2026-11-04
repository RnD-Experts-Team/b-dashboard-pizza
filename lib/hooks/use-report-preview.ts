"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import type { ReportDefinition } from "@/lib/report-builder/definition";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import type { ReportResult } from "@/types/report-builder.types";

/** Wait this long after the last edit before asking Data for a preview. */
const PREVIEW_DEBOUNCE_MS = 800;

interface UseReportPreviewResult {
  result: ReportResult | null;
  isLoading: boolean;
  error: ReportError | null;
  /** Asks again now, ignoring the debounce. */
  refresh: () => void;
}

/**
 * Live preview of an unsaved definition: Data `POST /report-builder/preview`
 * (first 200 rows, 15 s budget). Re-runs, debounced, whenever the definition
 * changes while `ready` (the client-side checks pass); an older request is
 * aborted when a newer one starts.
 */
export function useReportPreview(definition: ReportDefinition, ready: boolean): UseReportPreviewResult {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const immediateRef = useRef(false);
  const key = JSON.stringify(definition);

  useEffect(() => {
    if (!ready) {
      abortRef.current?.abort();
      setIsLoading(false);
      return;
    }
    const body = JSON.parse(key) as ReportDefinition;
    const delay = immediateRef.current ? 0 : PREVIEW_DEBOUNCE_MS;
    immediateRef.current = false;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const next = await reportBuilderService.preview(body, controller.signal);
          setResult(next);
        } catch (err) {
          if (!isCancelled(err)) setError(readReportError(err));
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      };
      void load();
    }, delay);
    return () => clearTimeout(timer);
  }, [key, ready, nonce]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const refresh = useCallback(() => {
    immediateRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  return { result, isLoading, error, refresh };
}
