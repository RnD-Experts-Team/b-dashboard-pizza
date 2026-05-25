"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelectedStoreStore } from "@/lib/store";
import { screenProjectService } from "@/lib/api/services/screen-project.service";
import type { Station, SupervisorTokensResponse } from "@/types/screen-project.types";

interface UseScreenProjectResult {
  stations: Station[];
  serverUrl: string;
  /** Map from room_name → JWT token */
  tokenMap: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useScreenProject(): UseScreenProjectResult {
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? null;

  const [stations, setStations] = useState<Station[]>([]);
  const [supervisorData, setSupervisorData] =
    useState<SupervisorTokensResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!storeId) {
      setStations([]);
      setSupervisorData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    setIsLoading(true);
    setError(null);

    Promise.all([
      screenProjectService.getStations(storeId, signal),
      screenProjectService.getSupervisorTokens(storeId, signal),
    ])
      .then(([stationsData, tokensData]) => {
        if (signal.aborted) return;
        setStations(stationsData);
        setSupervisorData(tokensData);
      })
      .catch((err) => {
        if (signal.aborted) return;
        const message =
          err?.response?.data?.error?.message ??
          err?.message ??
          "Failed to load screen project data";
        setError(message);
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [storeId, fetchKey]);

  const tokenMap: Record<string, string> = {};
  if (supervisorData) {
    for (const entry of supervisorData.tokens) {
      tokenMap[entry.room] = entry.token;
    }
  }

  return {
    stations,
    serverUrl: supervisorData?.server_url ?? "",
    tokenMap,
    isLoading,
    error,
    refetch,
  };
}
