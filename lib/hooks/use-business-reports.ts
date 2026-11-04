"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { businessReportsService } from "@/lib/api/services/business-reports.service";
import type {
  BusinessReportsData,
  BusinessReportsParams,
  BusinessReportsState,
  SectionKey,
} from "@/types/business-reports.types";

const SECTION_KEYS: SectionKey[] = [
  "sales",
  "operations",
  "menu",
  "orders",
  "quality",
  "debriefs",
  "storeScore",
  "labor",
  "feedback",
  "tickets",
];

const IDLE: BusinessReportsState = Object.fromEntries(
  SECTION_KEYS.map((k) => [k, { data: null, error: null, loading: false }]),
) as unknown as BusinessReportsState;

const LOADING: BusinessReportsState = Object.fromEntries(
  SECTION_KEYS.map((k) => [k, { data: null, error: null, loading: true }]),
) as unknown as BusinessReportsState;

const HTTP_FORBIDDEN = 403;

/** A readable message out of an axios / proxy error. */
function toMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    if (err.response?.status === HTTP_FORBIDDEN) return "You don't have access to this part for the selected stores.";
    return data?.error?.message ?? data?.message ?? err.message;
  }
  return err instanceof Error ? err.message : "Failed to load.";
}

interface UseBusinessReportsResult {
  sections: BusinessReportsState;
  loadedParams: BusinessReportsParams | null;
  loadedAt: Date | null;
  /** Any section still loading. */
  busy: boolean;
  load: (params: BusinessReportsParams) => void;
}

/**
 * Loads every Business Reports section in parallel. Each one renders as soon
 * as it lands and fails on its own (an error blanks only that section). A new
 * load aborts the previous one. Nothing runs until `load()` is called.
 */
export function useBusinessReports(): UseBusinessReportsResult {
  const [sections, setSections] = useState<BusinessReportsState>(IDLE);
  const [loadedParams, setLoadedParams] = useState<BusinessReportsParams | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback((params: BusinessReportsParams) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    setSections(LOADING);
    setLoadedParams(params);
    setLoadedAt(new Date());

    const settle = async <K extends SectionKey>(key: K, promise: Promise<BusinessReportsData[K]>) => {
      try {
        const data = await promise;
        if (!signal.aborted) setSections((s) => ({ ...s, [key]: { data, error: null, loading: false } }));
      } catch (err) {
        if (!signal.aborted) {
          setSections((s) => ({ ...s, [key]: { data: null, error: toMessage(err), loading: false } }));
        }
      }
    };

    const svc = businessReportsService;
    // Fire-and-forget: each settles into its own section.
    void settle("sales", svc.getSales(params, signal));
    void settle("operations", svc.getOperations(params, signal));
    void settle("menu", svc.getMenu(params, signal));
    void settle("orders", svc.getOrders(params, signal));
    void settle("quality", svc.getQuality(params, signal));
    void settle("debriefs", svc.getDebriefs(params, signal));
    void settle("labor", svc.getLabor(params, signal));
    void settle("feedback", svc.getFeedback(params, signal));
    void settle("tickets", svc.getTickets(params, signal));
    void settle(
      "storeScore",
      // The grid fills in batch by batch; `loading` stays on until the last one.
      svc.getStoreScore(params, signal, (partial) => {
        if (!signal.aborted) {
          setSections((s) => ({ ...s, storeScore: { data: partial, error: null, loading: true } }));
        }
      }),
    );
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const busy = SECTION_KEYS.some((k) => sections[k].loading);

  return { sections, loadedParams, loadedAt, busy, load };
}
