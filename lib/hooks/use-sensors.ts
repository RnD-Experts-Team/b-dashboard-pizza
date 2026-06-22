"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { useSensorStore } from "@/lib/store/sensor.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";

export function useSensors() {
  const { selectedStore } = useSelectedStoreStore();
  const { globalPermissions, storePermissions, overviewStores } = useAuthStore();
  const store = useSensorStore();

  // True if the user has "mos" in global permissions OR any store-scoped permissions
  const hasMos =
    globalPermissions.has("mos") ||
    Object.values(storePermissions).some((perms) => perms.has("mos"));

  const storeId = selectedStore?.storeId ?? null;

  // All store numbers the user has access to — sent as store_ids[] to the bulk endpoint
  const mosStoreIds = useMemo(
    () => (overviewStores ?? []).map((s) => s.storeId).filter(Boolean) as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overviewStores],
  );

  const mountFetchedRef = useRef(false);

  /* ── Set mode once on mount, then fetch ────────────────────────────────── */
  useEffect(() => {
    if (hasMos) {
      store.setMode("mos");
      store.fetchSensors(mosStoreIds);
    } else if (storeId) {
      store.setMode("store");
      store.fetchSensors(storeId);
    } else {
      store.reset();
    }
    mountFetchedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-fetch when the selected store changes (store mode only) ─────────── */
  useEffect(() => {
    if (!mountFetchedRef.current) {
      mountFetchedRef.current = true;
      return;
    }
    if (hasMos) return; // mos mode doesn't depend on the selected store
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
      if (document.visibilityState !== "visible" || !store.isStale()) return;
      if (hasMos) {
        store.fetchSensors(mosStoreIds);
      } else if (storeId) {
        store.fetchSensors(storeId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, hasMos, mosStoreIds]);

  const refetch = useCallback(() => {
    if (hasMos) {
      store.fetchSensors(mosStoreIds);
    } else if (storeId) {
      store.fetchSensors(storeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMos, mosStoreIds, storeId]);

  return {
    selectedStore,
    hasMos,
    sensors: store.sensors,
    mosSensors: store.mosSensors,
    sensorsLoading: store.sensorsLoading,
    sensorsError: store.sensorsError,
    useCelsius: store.useCelsius,
    refetch,
    toggleUnit: store.toggleUnit,
  };
}
