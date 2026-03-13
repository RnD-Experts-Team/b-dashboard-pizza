"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { keysService, KeysError } from "@/lib/api/services/keys.service";
import type {
  KeysListResponse,
  EngineKey,
  CreateKeyPayload,
  UpdateKeyPayload,
} from "@/types/key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cancel / abort helper                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useKeysList — paginated list of engine keys                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseKeysListReturn {
  data: KeysListResponse | null;
  page: number;
  setPage: (page: number) => void;
  tagsFilter: number[];
  setTagsFilter: (tags: number[]) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useKeysList(): UseKeysListReturn {
  const [data, setData] = useState<KeysListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [tagsFilter, setTagsFilterState] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const setTagsFilter = useCallback((tags: number[]) => {
    setTagsFilterState(tags);
    setPage(1);
  }, []);

  const fetchKeys = useCallback(
    async (pageNum: number, tags: number[], signal?: AbortSignal, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await keysService.getKeys(pageNum, signal, tags.length > 0 ? tags : undefined);
        if (signal?.aborted) return;
        setData(result);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof KeysError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load keys."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchKeys(page, tagsFilter, controller.signal);
    return () => controller.abort();
  }, [page, tagsFilter, fetchKeys]);

  const refetch = useCallback(() => {
    fetchKeys(page, tagsFilter, undefined, true);
  }, [page, tagsFilter, fetchKeys]);

  return {
    data,
    page,
    setPage,
    tagsFilter,
    setTagsFilter,
    isLoading,
    isRefreshing,
    error,
    refetch,
    clearError,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useKeyDetail — fetch a single key by ID                                 */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseKeyDetailReturn {
  key: EngineKey | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useKeyDetail(keyId: number | null): UseKeyDetailReturn {
  const [key, setKey] = useState<EngineKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (id: number, signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const found = await keysService.getKeyById(id, signal);
        if (signal?.aborted) return;
        setKey(found);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof KeysError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load key."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (keyId == null) {
      setKey(null);
      return;
    }
    const controller = new AbortController();
    fetchDetail(keyId, controller.signal);
    return () => controller.abort();
  }, [keyId, fetchDetail]);

  const refetch = useCallback(() => {
    if (keyId != null) fetchDetail(keyId);
  }, [keyId, fetchDetail]);

  return { key, isLoading, error, refetch };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCreateKey — create a new key                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCreateKeyReturn {
  createKey: (payload: CreateKeyPayload) => Promise<EngineKey | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateKey(): UseCreateKeyReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const create = useCallback(
    async (payload: CreateKeyPayload): Promise<EngineKey | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await keysService.createKey(payload);
        return result;
      } catch (err) {
        if (isCanceledError(err)) return null;
        if (err instanceof KeysError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred."
          );
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { createKey: create, isSubmitting, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useUpdateKey — update an existing key                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseUpdateKeyReturn {
  updateKey: (
    id: number,
    payload: UpdateKeyPayload
  ) => Promise<EngineKey | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useUpdateKey(): UseUpdateKeyReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const update = useCallback(
    async (
      id: number,
      payload: UpdateKeyPayload
    ): Promise<EngineKey | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await keysService.updateKey(id, payload);
        return result;
      } catch (err) {
        if (isCanceledError(err)) return null;
        if (err instanceof KeysError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred."
          );
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { updateKey: update, isSubmitting, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeactivateKey — deactivate (soft-delete) a key                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeactivateKeyReturn {
  deactivateKey: (id: number) => Promise<boolean>;
  isDeactivating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeactivateKey(): UseDeactivateKeyReturn {
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const deactivate = useCallback(async (id: number): Promise<boolean> => {
    setIsDeactivating(true);
    setError(null);

    try {
      await keysService.deactivateKey(id);
      return true;
    } catch (err) {
      if (isCanceledError(err)) return false;
      if (err instanceof KeysError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      }
      return false;
    } finally {
      setIsDeactivating(false);
    }
  }, []);

  return { deactivateKey: deactivate, isDeactivating, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useRestoreKey — restore (reactivate) a soft-deleted key                 */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseRestoreKeyReturn {
  restoreKey: (id: number) => Promise<boolean>;
  isRestoring: boolean;
  error: string | null;
  clearError: () => void;
}

export function useRestoreKey(): UseRestoreKeyReturn {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const restore = useCallback(async (id: number): Promise<boolean> => {
    setIsRestoring(true);
    setError(null);

    try {
      await keysService.restoreKey(id);
      return true;
    } catch (err) {
      if (isCanceledError(err)) return false;
      if (err instanceof KeysError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      }
      return false;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  return { restoreKey: restore, isRestoring, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useForceDeleteKey — permanently delete a key                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseForceDeleteKeyReturn {
  forceDeleteKey: (id: number) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useForceDeleteKey(): UseForceDeleteKeyReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const forceDelete = useCallback(async (id: number): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await keysService.forceDeleteKey(id);
      return true;
    } catch (err) {
      if (isCanceledError(err)) return false;
      if (err instanceof KeysError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      }
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { forceDeleteKey: forceDelete, isDeleting, error, clearError };
}
