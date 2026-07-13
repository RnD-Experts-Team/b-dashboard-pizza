"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelectedStoreStore } from "@/lib/store";
import { screenProjectService } from "@/lib/api/services/screen-project.service";
import type { Station } from "@/types/screen-project.types";

interface UseScreenProjectResult {
  stations: Station[];
  serverUrl: string;
  /** Map from room_name → JWT token (supervisor or observer depending on tokenType) */
  tokenMap: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches stations and — only when the user has committed to a view —
 * the corresponding tokens.
 *
 * - tokenType "supervisor" → POST /api/screen-project/{storeId}/tokens
 * - tokenType "observer"   → POST /api/screen-project/{storeId}/tokens/observer
 * - tokenType null         → no token fetch (user is still on the select screen)
 */
export function useScreenProject(
  tokenType: "supervisor" | "observer" | null,
): UseScreenProjectResult {
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? null;

  const [stations, setStations] = useState<Station[]>([]);
  const [tokenData, setTokenData] = useState<{
    server_url: string;
    tokens: { room: string; token: string }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!storeId) {
      setStations([]);
      setTokenData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    setIsLoading(true);
    setError(null);

    const stationsPromise = screenProjectService.getStations(storeId, signal);
    const tokensPromise =
      tokenType === "supervisor"
        ? screenProjectService.getSupervisorTokens(storeId, signal)
        : tokenType === "observer"
        ? screenProjectService.getObserverTokens(storeId, signal)
        : Promise.resolve(null);

    Promise.allSettled([stationsPromise, tokensPromise])
      .then(([stationsResult, tokensResult]) => {
        if (signal.aborted) return;

        // Stations error takes priority since it's the more fundamental failure —
        // token errors are only surfaced when stations loaded successfully.
        let nextError: string | null = null;

        if (stationsResult.status === "fulfilled") {
          setStations(stationsResult.value);
        } else {
          nextError =
            stationsResult.reason?.response?.data?.error?.message ??
            stationsResult.reason?.message ??
            "Failed to load stations";
        }

        if (tokenType !== null) {
          if (tokensResult.status === "fulfilled" && tokensResult.value) {
            setTokenData(tokensResult.value);
          } else if (tokensResult.status === "rejected") {
            setTokenData(null);
            if (!nextError) {
              nextError =
                tokensResult.reason?.response?.data?.error?.message ??
                tokensResult.reason?.message ??
                "Failed to connect to station streams";
            }
          }
        }

        setError(nextError);
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  // tokenType in deps: re-fetches tokens when user picks supervisor vs observer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, fetchKey, tokenType]);

  const tokenMap: Record<string, string> = {};
  if (tokenData) {
    for (const entry of tokenData.tokens) {
      tokenMap[entry.room] = entry.token;
    }
  }

  return {
    stations,
    serverUrl: tokenData?.server_url ?? "",
    tokenMap,
    isLoading,
    error,
    refetch,
  };
}
