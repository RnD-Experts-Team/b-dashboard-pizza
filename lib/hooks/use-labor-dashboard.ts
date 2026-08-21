"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { laborService } from "@/lib/api/services/labor.service";
import type { LaborDashboardResponse } from "@/types/labor.types";

export interface UseLaborDashboardResult {
  data: LaborDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the whole Labor Dashboard for one store + business week.
 *
 * `storeId` is the store_number, `date` any day inside the target week, and
 * `trendWeeks` how many trailing weeks feed the trend section — changing any
 * of the three refetches.
 */
export function useLaborDashboard(
  storeId: string | null,
  date: string | null,
  trendWeeks: number,
): UseLaborDashboardResult {
  const [data, setData] = useState<LaborDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!storeId || !date) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await laborService.getLaborDashboard(
        storeId,
        date,
        trendWeeks,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setData(response);
      }
    } catch (err) {
      if (controller.signal.aborted || axios.isCancel(err)) return;
      const message =
        axios.isAxiosError(err) && err.response?.status === 404
          ? "No labor report available for this store and week."
          : err instanceof Error
            ? err.message
            : "Failed to load labor data.";
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [storeId, date, trendWeeks]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
