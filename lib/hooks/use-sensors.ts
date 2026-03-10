"use client";

import { useEffect, useCallback } from "react";
import { useSensorStore } from "@/lib/store/sensor.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * Convenience hook that wires the Sensor Zustand store to the sidebar's
 * selected store.  Automatically fetches all sensor data when the store
 * changes and manages auto-refresh / visibility-change re-fetching.
 */
export function useSensors() {
  const { selectedStore } = useSelectedStoreStore();
  const store = useSensorStore();

  const storeId = selectedStore?.storeId ?? null;

  /* ── Fetch everything when the selected store changes ─────────────────── */
  useEffect(() => {
    if (storeId) {
      store.fetchAll(storeId);
    } else {
      store.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  /* ── Auto-refresh lifecycle ───────────────────────────────────────────── */
  useEffect(() => {
    store.startAutoRefresh();
    return () => store.stopAutoRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-fetch stale data on tab focus ─────────────────────────────────── */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && store.isStale() && storeId) {
        store.fetchAll(storeId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  /** Manual full refresh */
  const refetch = useCallback(() => {
    if (storeId) store.fetchAll(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  /** Refresh only reports with a new period */
  const changePeriod = useCallback(
    (period: "daily" | "weekly" | "monthly") => {
      store.setReportPeriod(period);
      if (storeId) store.fetchReports(storeId, period);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId],
  );

  /** Navigate history pages */
  const goToHistoryPage = useCallback(
    (page: number) => {
      if (storeId) store.fetchHistory(storeId, page);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId],
  );

  return {
    /* state */
    selectedStore,
    sensors: store.sensors,
    sensorsLoading: store.sensorsLoading,
    sensorsError: store.sensorsError,
    reports: store.reports,
    reportsLoading: store.reportsLoading,
    reportsError: store.reportsError,
    reportPeriod: store.reportPeriod,
    history: store.history,
    historyLoading: store.historyLoading,
    historyError: store.historyError,
    alerts: store.alerts,
    alertsLoading: store.alertsLoading,
    alertsError: store.alertsError,
    useCelsius: store.useCelsius,
    /* actions */
    refetch,
    changePeriod,
    goToHistoryPage,
    toggleUnit: store.toggleUnit,
    clearErrors: store.clearErrors,
  };
}
