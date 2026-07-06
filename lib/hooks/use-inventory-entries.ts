"use client";

import { useCallback, useEffect } from "react";
import { useEntriesStore } from "@/lib/store/inventory-entries.store";
import type { EntryListParams } from "@/types/inventory.types";

/**
 * Entries for one store. Pass null storeId to wait until a store is chosen.
 * Pass live filters as `initialParams` on every render — the effect below
 * re-fetches whenever the store OR the params object changes.
 */
export function useStoreEntries(
  storeId: string | null,
  initialParams?: EntryListParams
) {
  const { entries, pagination, isLoading, error, fetchEntries } =
    useEntriesStore();

  useEffect(() => {
    if (storeId) fetchEntries(storeId, initialParams);
  }, [storeId, fetchEntries, initialParams]);

  const refetch = useCallback(
    (params?: EntryListParams) => {
      if (storeId) fetchEntries(storeId, { ...initialParams, ...params });
    },
    [storeId, fetchEntries, initialParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (storeId) fetchEntries(storeId, { ...initialParams, page });
    },
    [storeId, fetchEntries, initialParams]
  );

  return { entries, pagination, isLoading, error, refetch, handlePageChange };
}

/**
 * Single entry detail + recount. Pass null to skip fetching.
 */
export function useEntryDetail(id: number | null) {
  const {
    currentEntry,
    hasHistoryAccess,
    isLoadingDetail,
    detailError,
    isSaving,
    saveError,
    fetchEntry,
    recountItem,
    clearErrors,
  } = useEntriesStore();

  useEffect(() => {
    if (id != null) fetchEntry(id);
  }, [id, fetchEntry]);

  return {
    entry: currentEntry,
    hasHistoryAccess,
    isLoading: isLoadingDetail,
    error: detailError,
    isSaving,
    saveError,
    recountItem,
    clearErrors,
  };
}
