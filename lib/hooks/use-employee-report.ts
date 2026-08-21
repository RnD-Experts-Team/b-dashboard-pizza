"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { employeeReportService } from "@/lib/api/services/employee-report.service";
import type { EmployeeReportResponse } from "@/types/employee-report.types";

export interface UseEmployeeReportResult {
  data: EmployeeReportResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the Employee Report (roster + debrief counts) for one store +
 * business week — a separate upstream from the Labor Dashboard's hours/pay
 * report, so it's fetched and can fail independently.
 */
export function useEmployeeReport(
  store: string | null,
  date: string | null,
  trendWeeks: number,
): UseEmployeeReportResult {
  const [data, setData] = useState<EmployeeReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!store || !date) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await employeeReportService.getEmployeeReport(
        store,
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
          ? "No employee report available for this store and week."
          : err instanceof Error
            ? err.message
            : "Failed to load employee report.";
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [store, date, trendWeeks]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
