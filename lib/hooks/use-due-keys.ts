"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { DueKeysError, dueKeysService } from "@/lib/api/services/due-keys.service";
import type { DueKeysResponse, DueKeyValuePayload, DueKeyValue } from "@/types/due-key.types";

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

interface UseDueKeysReturn {
  data: DueKeysResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useDueKeys(
  storeId: string | null,
  date: string | null,
  tags?: number[]
): UseDueKeysReturn {
  const [data, setData] = useState<DueKeysResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchDueKeys = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (!storeId || !date) {
        setData(null);
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
        const response = await dueKeysService.getDueKeys(storeId, date, signal, tags && tags.length > 0 ? tags : undefined);
        if (signal?.aborted) return;
        setData(response);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof DueKeysError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load due keys.");
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId, date, tags]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDueKeys(controller.signal);
    return () => controller.abort();
  }, [fetchDueKeys]);

  const refetch = useCallback(() => {
    fetchDueKeys(undefined, true);
  }, [fetchDueKeys]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch,
    clearError,
  };
}

interface UseSetDueKeyValueReturn {
  setDueKeyValue: (
    storeId: string,
    date: string,
    payload: DueKeyValuePayload
  ) => Promise<DueKeyValue | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useSetDueKeyValue(): UseSetDueKeyValueReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const setDueKeyValue = useCallback(
    async (
      storeId: string,
      date: string,
      payload: DueKeyValuePayload
    ): Promise<DueKeyValue | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const value = await dueKeysService.setDueKeyValue(storeId, date, payload);
        return value;
      } catch (err) {
        if (isCanceledError(err)) return null;
        if (err instanceof DueKeysError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to update due key value."
          );
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    setDueKeyValue,
    isSubmitting,
    error,
    clearError,
  };
}

interface UseSetDueKeysBulkReturn {
  setDueKeysBulk: (
    storeId: string,
    date: string,
    items: Array<{
      key_id: number;
      value_text: string | null;
      value_number: number | null;
      value_boolean: boolean | null;
      value_json: unknown;
      note?: string | null;
      attachments?: File[] | null;
    }>
  ) => Promise<DueKeyValue[] | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useSetDueKeysBulk(): UseSetDueKeysBulkReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const setDueKeysBulk = useCallback(
    async (
      storeId: string,
      date: string,
      items: Array<{
        key_id: number;
        value_text: string | null;
        value_number: number | null;
        value_boolean: boolean | null;
        value_json: unknown;
        note?: string | null;
        attachments?: File[] | null;
      }>
    ): Promise<DueKeyValue[] | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        return await dueKeysService.setDueKeysBulk(storeId, date, items as any);
      } catch (err) {
        if (isCanceledError(err)) return null;
        if (err instanceof DueKeysError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "Failed to update due keys.");
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    setDueKeysBulk,
    isSubmitting,
    error,
    clearError,
  };
}

interface UseDueKeyValueHistoryReturn {
  history: DueKeyValue[] | null;
  isLoading: boolean;
  error: string | null;
  fetchHistory: (storeId: string, keyId: number, date: string) => Promise<void>;
  reset: () => void;
}

export function useDueKeyValueHistory(): UseDueKeyValueHistoryReturn {
  const [history, setHistory] = useState<DueKeyValue[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (storeId: string, keyId: number, date: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await dueKeysService.getValueHistory(storeId, keyId, date);
        setHistory(result);
      } catch (err) {
        if (isCanceledError(err)) return;
        if (err instanceof DueKeysError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load value history.");
        }
        setHistory(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setHistory(null);
    setError(null);
  }, []);

  return { history, isLoading, error, fetchHistory, reset };
}
