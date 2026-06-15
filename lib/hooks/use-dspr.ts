"use client";

import { useEffect, useCallback, useRef } from "react";
import { useDsprStore } from "@/lib/store/dspr.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * Hook that exposes DSPR store state with smart refresh capabilities:
 *  - Auto-refresh on visibility change (when tab comes back into focus)
 *  - Starts/stops periodic auto-refresh when component mounts/unmounts
 *  - Exposes refetch, isRefreshing, structured error, and stale indicator
 */
export function useDspr() {
  const { selectedStore } = useSelectedStoreStore();
  const {
    data,
    wbrData,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    fetchCount,
    fetchReport,
    refreshReport,
    clearError,
    isStale,
    startAutoRefresh,
    stopAutoRefresh,
  } = useDsprStore();

  // Use the human-readable storeId (e.g. "03795-00021") for the DSPR API URL
  const storeIdRef = useRef(selectedStore?.storeId ?? selectedStore?.id);
  storeIdRef.current = selectedStore?.storeId ?? selectedStore?.id;

  // console.log("[useDspr] selectedStore:", selectedStore ? { id: selectedStore.id, name: selectedStore.name } : null);

  /** Fetch for a specific date (or re-fetch current) */
  const refetch = useCallback(
    (date?: string) => {
      // console.log("[useDspr] refetch called with:", { storeId: storeIdRef.current, date });
      if (storeIdRef.current) {
        fetchReport(storeIdRef.current, date);
      } else {
        // console.warn("[useDspr] refetch skipped — no storeId");
      }
    },
    [fetchReport]
  );

  /** Refresh the last fetched report (same store + date) */
  const refresh = useCallback(() => {
    refreshReport();
  }, [refreshReport]);

  // ── Auto-refresh lifecycle ───────────────────────────────────────────
  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  // ── Visibility change: refetch stale data when tab regains focus ─────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isStale()) {
        refreshReport();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isStale, refreshReport]);

  return {
    data,
    wbrData,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    fetchCount,
    refetch,
    refresh,
    clearError,
    isStale: isStale(),
    selectedStore,
  };
}
