"use client";

import { useEffect, useRef } from "react";
import { useMosSensorStore } from "@/lib/store/mos-sensor.store";

export function useMosSensors(unit?: "c" | "f") {
  const { data, loading, error, fetchAll } = useMosSensorStore();
  const abortRef = useRef<AbortController | null>(null);

  function refetch() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    fetchAll(unit, abortRef.current.signal);
  }

  useEffect(() => {
    refetch();
    return () => {
      abortRef.current?.abort();
    };
  // Re-fetch whenever the unit changes (°C ↔ °F toggle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  return {
    mosData: data,
    mosLoading: loading,
    mosError: error,
    refetchMos: refetch,
  };
}
