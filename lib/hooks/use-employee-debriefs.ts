"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  EmployeeDebriefError,
  employeeDebriefService,
} from "@/lib/api/services/employee-debriefs.service";
import type { EmployeeDebriefDetail, EmployeeDebriefItem, PaginatedDebriefResult } from "@/types/employee-debrief.types";

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

// ── List hook ─────────────────────────────────────────────────────────

interface UseEmployeeDebriefListReturn {
  items: EmployeeDebriefItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useEmployeeDebriefs(
  storeId: string | null
): UseEmployeeDebriefListReturn {
  const [items, setItems] = useState<EmployeeDebriefItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchList = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (!storeId) {
        setItems([]);
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await employeeDebriefService.list(storeId, signal);
        if (signal?.aborted) return;
        setItems(data);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof EmployeeDebriefError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load employee debriefs."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [storeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const refetch = useCallback(() => {
    fetchList(undefined, true);
  }, [fetchList]);

  return { items, isLoading, isRefreshing, error, refetch, clearError };
}

// ── Detail hook ───────────────────────────────────────────────────────

interface UseEmployeeDebriefDetailReturn {
  detail: EmployeeDebriefDetail | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useEmployeeDebriefDetail(
  storeId: string | null,
  debriefId: string | number | null
): UseEmployeeDebriefDetailReturn {
  const [detail, setDetail] = useState<EmployeeDebriefDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!storeId || debriefId == null) {
      setDetail(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    employeeDebriefService
      .getDetail(storeId, debriefId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setDetail(data);
      })
      .catch((err) => {
        if (isCanceledError(err) || controller.signal.aborted) return;
        if (err instanceof EmployeeDebriefError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load employee debrief details."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [storeId, debriefId]);

  return { detail, isLoading, error, clearError };
}

// ── Paginated history hook (by employee) ──────────────────────────────

interface UseEmployeeDebriefHistoryReturn {
  items: EmployeeDebriefItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  currentPage: number;
  lastPage: number;
  total: number;
  refetch: () => void;
  clearError: () => void;
}

export function useEmployeeDebriefHistory(
  storeId: string | null,
  employeeId: number | null,
  page: number,
  perPage = 50
): UseEmployeeDebriefHistoryReturn {
  const [result, setResult] = useState<PaginatedDebriefResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchPage = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (!storeId || employeeId == null) {
        setResult(null);
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await employeeDebriefService.listByEmployee(
          storeId,
          employeeId,
          { page, perPage },
          signal
        );
        if (signal?.aborted) return;
        setResult(data);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof EmployeeDebriefError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load debrief history."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [storeId, employeeId, page, perPage]
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
    items: result?.items ?? [],
    isLoading,
    isRefreshing,
    error,
    currentPage: result?.currentPage ?? page,
    lastPage: result?.lastPage ?? 1,
    total: result?.total ?? 0,
    refetch,
    clearError,
  };
}

// ── Create hook ──────────────────────────────────────────────────────

export interface CreateDebriefPayload {
  date: string;
  employee_id: number;
  note: string;
  attachments?: File[] | null;
}

interface UseCreateEmployeeDebriefReturn {
  createDebrief: (storeId: string, payload: CreateDebriefPayload) => Promise<EmployeeDebriefItem | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateEmployeeDebrief(): UseCreateEmployeeDebriefReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const createDebrief = useCallback(
    async (storeId: string, payload: CreateDebriefPayload): Promise<EmployeeDebriefItem | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const item = await employeeDebriefService.create(storeId, payload);
        return item;
      } catch (err) {
        if (isCanceledError(err)) return null;
        if (err instanceof EmployeeDebriefError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to create employee debrief."
          );
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { createDebrief, isSubmitting, error, clearError };
}

// ── Delete hook ───────────────────────────────────────────────────────

interface UseDeleteEmployeeDebriefReturn {
  deleteDebrief: (storeId: string, debriefId: string | number) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteEmployeeDebrief(): UseDeleteEmployeeDebriefReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const deleteDebrief = useCallback(
    async (storeId: string, debriefId: string | number): Promise<boolean> => {
      setIsDeleting(true);
      setError(null);
      try {
        await employeeDebriefService.delete(storeId, debriefId);
        return true;
      } catch (err) {
        if (isCanceledError(err)) return false;
        if (err instanceof EmployeeDebriefError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to delete employee debrief."
          );
        }
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    []
  );

  return { deleteDebrief, isDeleting, error, clearError };
}
