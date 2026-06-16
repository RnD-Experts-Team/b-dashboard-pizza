"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { hooksService } from "@/lib/api/services/hooks.service";
import type { WbrHooksResponse } from "@/types/hooks.types";

export interface UseHooksWbrResult {
  data: WbrHooksResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches GET /api/hooks/reports/wbr/{storeId}/{date} once and provides
 * complaints, feedbacks, and money_owed for the week.
 */
export function useHooksWbr(
  storeId: string | null,
  date: string | null,
): UseHooksWbrResult {
  const [data, setData] = useState<WbrHooksResponse | null>(null);
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
      const response = await hooksService.getWbrReport(
        storeId,
        date,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setData(response);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error ? err.message : "Failed to load hooks WBR data.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [storeId, date]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
