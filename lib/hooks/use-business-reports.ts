"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { businessReportsService } from "@/lib/api/services/business-reports.service";
import type {
  BusinessReportsData,
  BusinessReportsParams,
  BusinessReportsState,
  SectionErrorKind,
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
  "skills",
  "salesHistory",
];

const IDLE: BusinessReportsState = Object.fromEntries(
  SECTION_KEYS.map((k) => [k, { data: null, error: null, loading: false }]),
) as unknown as BusinessReportsState;

const LOADING: BusinessReportsState = Object.fromEntries(
  SECTION_KEYS.map((k) => [k, { data: null, error: null, loading: true }]),
) as unknown as BusinessReportsState;

const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;

const MESSAGES: Record<SectionErrorKind, string> = {
  stopped: "Stopped. Change the filters and press Load to run it again.",
  "too-big": "Too much data for this range — it took too long. Try fewer weeks or stores.",
  "no-access": "You don't have access to this part for the selected stores.",
  failed: "Couldn't load this part. Press Load to try again.",
};

/**
 * What went wrong, in the user's words: a timeout or a server that gave up
 * (5xx — on these heavy reports that is the range being too big) reads as
 * "too much data", a 403 as no access; never the raw server error.
 */
function toError(err: unknown): { error: string; errorKind: SectionErrorKind } {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  const timedOut = axios.isAxiosError(err) && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT");
  const kind: SectionErrorKind =
    [
      { when: status === HTTP_FORBIDDEN, kind: "no-access" as const },
      { when: timedOut || (status !== undefined && status >= HTTP_SERVER_ERROR), kind: "too-big" as const },
    ].find((c) => c.when)?.kind ?? "failed";
  return { error: MESSAGES[kind], errorKind: kind };
}

interface UseBusinessReportsResult {
  sections: BusinessReportsState;
  loadedParams: BusinessReportsParams | null;
  loadedAt: Date | null;
  /** Any section still loading. */
  busy: boolean;
  load: (params: BusinessReportsParams) => void;
  /** Cancel everything still loading; what already landed stays on screen. */
  stop: () => void;
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
          setSections((s) => ({ ...s, [key]: { data: null, ...toError(err), loading: false } }));
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
    void settle("skills", svc.getSkills(params, signal));
    void settle("salesHistory", svc.getSalesHistory(params, signal));
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

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    // A section that was still loading keeps whatever partial data it had
    // (store-score batches) and is marked stopped.
    setSections((s) =>
      Object.fromEntries(
        SECTION_KEYS.map((k) => [
          k,
          s[k].loading ? { ...s[k], loading: false, error: MESSAGES.stopped, errorKind: "stopped" } : s[k],
        ]),
      ) as unknown as BusinessReportsState,
    );
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const busy = SECTION_KEYS.some((k) => sections[k].loading);

  return { sections, loadedParams, loadedAt, busy, load, stop };
}
