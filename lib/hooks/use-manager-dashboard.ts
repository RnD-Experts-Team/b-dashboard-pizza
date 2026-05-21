"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { employeeService } from "@/lib/api/services/employee.service";
import type { ManagerDashboardStoreData } from "@/types/employee.types";

export interface UseManagerDashboardResult {
  data: ManagerDashboardStoreData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches GET /v1/stores/{storeId}/manager-dashboard/{date} once and provides
 * the parsed store data to all three employee cards (employees, birthdays, top metric).
 */
export function useManagerDashboard(
  storeId: string | null,
  date: string | null,
): UseManagerDashboardResult {
  const [data, setData] = useState<ManagerDashboardStoreData | null>(null);
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
      const response = await employeeService.getManagerDashboard(
        storeId,
        date,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        // API returns the store object directly
        setData(response);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error ? err.message : "Failed to load employee data.",
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
