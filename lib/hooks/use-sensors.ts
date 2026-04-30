"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSensorStore } from "@/lib/store/sensor.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * Convenience hook that wires the Sensor Zustand store to the sidebar's
 * selected store.  Automatically fetches sensor data when the store
 * changes and manages auto-refresh / visibility-change re-fetching.
 */
export function useSensors() {
  const { selectedStore } = useSelectedStoreStore();
  const store = useSensorStore();

  const storeId = selectedStore?.storeId ?? null;
  const mountFetchedRef = useRef(false);

  /* ── Always fetch fresh data when the page is entered (mounted) ────────── */
  useEffect(() => {
    if (storeId) {
      mountFetchedRef.current = true;
      store.fetchSensors(storeId);
    } else {
      store.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-fetch when the selected store changes while the page is open ──── */
  useEffect(() => {
    if (!mountFetchedRef.current) {
      mountFetchedRef.current = true;
      return;
    }
    if (storeId) {
      store.fetchSensors(storeId);
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
        store.fetchSensors(storeId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  /** Manual full refresh */
  const refetch = useCallback(() => {
    if (storeId) store.fetchSensors(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  return {
    selectedStore,
    sensors: store.sensors,
    sensorsLoading: store.sensorsLoading,
    sensorsError: store.sensorsError,
    useCelsius: store.useCelsius,
    refetch,
    toggleUnit: store.toggleUnit,
  };
}
