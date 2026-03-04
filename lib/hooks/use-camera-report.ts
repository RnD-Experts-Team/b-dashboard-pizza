"use client";

import { useEffect, useCallback } from "react";
import {
  useCameraReportStore,
  type CameraReportFilterParams,
} from "@/lib/store/camera-report.store";

/**
 * Hook that exposes camera report store state with:
 *  - Filter-aware fetching
 *  - Export functionality
 *  - Auto-refresh on visibility change
 *  - Periodic auto-refresh
 */
export function useCameraReport() {
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    filters,
    isExporting,
    isExportingExcel,
    isExportingImages,
    lastFetchedAt,
    fetchCount,
    fetchReport,
    refreshReport,
    setFilters,
    exportReport,
    exportReportExcel,
    exportReportImages,
    clearError,
    isStale,
    startAutoRefresh,
    stopAutoRefresh,
  } = useCameraReportStore();

  /** Fetch camera report with current filters */
  const refetch = useCallback(() => {
    fetchReport();
  }, [fetchReport]);

  /** Apply filters and fetch */
  const applyFilters = useCallback(
    (newFilters: CameraReportFilterParams) => {
      fetchReport(newFilters);
    },
    [fetchReport]
  );

  // ── Auto-fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
    isLoading,
    isRefreshing,
    error,
    filters,
    isExporting,
    isExportingExcel,
    isExportingImages,
    lastFetchedAt,
    fetchCount,
    refetch,
    applyFilters,
    setFilters,
    exportReport,
    exportReportExcel,
    exportReportImages,
    clearError,
    isStale: isStale(),
  };
}
