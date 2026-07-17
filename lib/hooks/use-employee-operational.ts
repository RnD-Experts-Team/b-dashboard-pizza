"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { hiringService } from "@/lib/api/services/hiring.service";
import type { OperationalEmployee, OperationalEntry } from "@/types/employee-operational.types";

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

function extractServerMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    return (
      data?.message ||
      data?.error?.message ||
      data?.errors?.[0] ||
      err.message ||
      "Failed to load operational history."
    );
  }
  return err instanceof Error ? err.message : "Failed to load operational history.";
}

export interface OperationalOpts {
  dateFrom?: string;
  dateTo?: string;
  sortDir?: "asc" | "desc";
  perPage?: number;
}

interface UseEmployeeOperationalReturn {
  employee: OperationalEmployee | null;
  entries: OperationalEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  currentPage: number;
  lastPage: number;
  total: number;
  refetch: () => void;
  clearError: () => void;
}

export function useEmployeeOperational(
  storeId: string | null,
  employeeId: number | null,
  page: number,
  opts: OperationalOpts = {}
): UseEmployeeOperationalReturn {
  const [employee, setEmployee] = useState<OperationalEmployee | null>(null);
  const [entries, setEntries] = useState<OperationalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const clearError = useCallback(() => setError(null), []);

  const { dateFrom, dateTo, sortDir = "desc", perPage = 25 } = opts;

  const fetchPage = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (!storeId || employeeId == null) {
        setEmployee(null);
        setEntries([]);
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        setCurrentPage(1);
        setLastPage(1);
        setTotal(0);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await hiringService.getEmployeeOperational(
          storeId,
          employeeId,
          { page, perPage, dateFrom, dateTo, sortDir },
          signal
        );
        if (signal?.aborted) return;
        setEmployee(result.employee);
        setEntries(result.entries);
        setCurrentPage(result.currentPage ?? page);
        setLastPage(result.lastPage ?? 1);
        setTotal(result.total ?? 0);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        setError(extractServerMessage(err));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId, employeeId, page, perPage, dateFrom, dateTo, sortDir]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  const refetch = useCallback(() => {
    fetchPage(undefined, true);
  }, [fetchPage]);

  return {
    employee,
    entries,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    lastPage,
    total,
    refetch,
    clearError,
  };
}
