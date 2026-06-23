"use client";

import { useEffect, useRef } from "react";
import { useMosSensorStore } from "@/lib/store/mos-sensor.store";

export function useMosSensors() {
  const { data, loading, error, fetchAll } = useMosSensorStore();
  const abortRef = useRef<AbortController | null>(null);

  function refetch() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    fetchAll(abortRef.current.signal);
  }

  useEffect(() => {
    refetch();
    return () => {
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mosData: data,
    mosLoading: loading,
    mosError: error,
    refetchMos: refetch,
  };
}
