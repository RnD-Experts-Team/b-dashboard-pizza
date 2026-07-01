"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { businessReportsService } from "@/lib/api/services/business-reports.service";
import type {
  BusinessReportsData,
  BusinessReportsErrors,
  BusinessReportsParams,
} from "@/types/business-reports.types";

const EMPTY_DATA: BusinessReportsData = {
  sales: null,
  labor: null,
  feedback: null,
};
const NO_ERRORS: BusinessReportsErrors = {
  sales: null,
  labor: null,
  feedback: null,
};

/** Pull a human-readable message out of an axios/proxy error. */
function toMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return (
      data?.error?.message ??
      data?.message ??
      err.message ??
      fallback
    );
  }
  return err instanceof Error ? err.message : fallback;
}

interface UseBusinessReportsResult {
  data: BusinessReportsData | null;
  errors: BusinessReportsErrors;
  /** First load with no data yet. */
  isLoading: boolean;
  /** A load while data is already on screen. */
  isRefreshing: boolean;
  hasLoaded: boolean;
  loadedParams: BusinessReportsParams | null;
  load: (params: BusinessReportsParams) => void;
}

/**
 * Fetches the three Business Reports domains in parallel. A domain that fails
 * (or times out) blanks only its own section and records a per-domain error —
 * the other two still render (Promise.allSettled, no all-or-nothing).
 *
 * Nothing runs on mount; the page calls `load()` on the Load/Refresh click.
 */
export function useBusinessReports(): UseBusinessReportsResult {
  const [data, setData] = useState<BusinessReportsData | null>(null);
  const [errors, setErrors] = useState<BusinessReportsErrors>(NO_ERRORS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadedParams, setLoadedParams] =
    useState<BusinessReportsParams | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback((params: BusinessReportsParams) => {
    // Supersede any in-flight load.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    if (hasDataRef.current) setIsRefreshing(true);
    else setIsLoading(true);

    Promise.allSettled([
      businessReportsService.getMultiDashboard(params, signal),
      businessReportsService.getV1Reports(params, signal),
      businessReportsService.getWbrBulk(params, signal),
    ]).then(([sales, labor, feedback]) => {
      if (signal.aborted) return; // a newer load took over

      const nextData: BusinessReportsData = {
        sales: sales.status === "fulfilled" ? sales.value : null,
        labor: labor.status === "fulfilled" ? labor.value : null,
        feedback: feedback.status === "fulfilled" ? feedback.value : null,
      };
      const nextErrors: BusinessReportsErrors = {
        sales:
          sales.status === "rejected"
            ? toMessage(sales.reason, "Failed to load sales data.")
            : null,
        labor:
          labor.status === "rejected"
            ? toMessage(labor.reason, "Failed to load labor data.")
            : null,
        feedback:
          feedback.status === "rejected"
            ? toMessage(feedback.reason, "Failed to load feedback data.")
            : null,
      };

      hasDataRef.current = true;
      setData(nextData);
      setErrors(nextErrors);
      setLoadedParams(params);
      setIsLoading(false);
      setIsRefreshing(false);
    });
  }, []);

  // Abort any in-flight request on unmount.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    data,
    errors,
    isLoading,
    isRefreshing,
    hasLoaded: loadedParams !== null,
    loadedParams,
    load,
  };
}

export { EMPTY_DATA };
