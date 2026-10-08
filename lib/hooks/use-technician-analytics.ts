"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  TechnicianAnalytics,
  TechnicianAnalyticsParams,
  TechniciansOverview,
} from "@/types/technician-analytics.types";

function messageOf(err: unknown): string {
  return err instanceof MaintenanceTicketsError ? err.message : "Could not load the technician report.";
}

/**
 * One report, loaded on demand. A new load cancels the one in flight, so
 * quickly flicking between ranges cannot paint an older answer over a newer
 * one; the last good report stays on screen while the next one loads.
 */
function useReport<T>(fetch: (params: TechnicianAnalyticsParams, signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedParams, setLoadedParams] = useState<TechnicianAnalyticsParams | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (params: TechnicianAnalyticsParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetch(params, controller.signal);
      if (controller.signal.aborted) return;
      setData(next);
      setLoadedParams(params);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(messageOf(err));
      setLoadedParams(params);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [fetch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { data, error, isLoading, loadedParams, load };
}

/** Every technician's pay and work -- the Technicians page. */
export function useTechniciansOverview() {
  const fetch = useCallback(
    (params: TechnicianAnalyticsParams, signal: AbortSignal) => maintenanceTicketsService.getTechniciansAnalytics(params, signal),
    [],
  );
  return useReport<TechniciansOverview>(fetch);
}

/** One technician's pay and work -- the technician's page. */
export function useTechnicianAnalytics(technicianId: number) {
  const fetch = useCallback(
    (params: TechnicianAnalyticsParams, signal: AbortSignal) => maintenanceTicketsService.getTechnicianAnalytics(technicianId, params, signal),
    [technicianId],
  );
  return useReport<TechnicianAnalytics>(fetch);
}
