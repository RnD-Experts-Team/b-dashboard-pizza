"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  AnalyticsActivityTicket,
  AnalyticsParams,
  AnalyticsSummary,
  AnalyticsWatchlist,
} from "@/types/maintenance-analytics.types";

type Section = "summary" | "activity" | "watchlist";

function messageOf(err: unknown): string {
  return err instanceof MaintenanceTicketsError ? err.message : "Could not load this part of the report.";
}

/**
 * The analytics page's data: the three sections, loaded together and failing
 * apart -- one slow or refused section never blanks the others. A new load
 * cancels the one in flight, so quickly flicking between presets cannot paint
 * an older answer over a newer one.
 */
export function useMaintenanceAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [watchlist, setWatchlist] = useState<AnalyticsWatchlist | null>(null);
  const [activity, setActivity] = useState<AnalyticsActivityTicket[]>([]);
  const [activityPage, setActivityPage] = useState({ page: 0, lastPage: 1, total: 0 });
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedParams, setLoadedParams] = useState<AnalyticsParams | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (params: AnalyticsParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setErrors({});

    const [s, w, a] = await Promise.allSettled([
      maintenanceTicketsService.getAnalyticsSummary(params, controller.signal),
      maintenanceTicketsService.getAnalyticsWatchlist(params, controller.signal),
      maintenanceTicketsService.getAnalyticsActivity(params, 1, controller.signal),
    ]);

    if (controller.signal.aborted) return;

    const nextErrors: Partial<Record<Section, string>> = {};
    if (s.status === "fulfilled") setSummary(s.value);
    else { setSummary(null); nextErrors.summary = messageOf(s.reason); }
    if (w.status === "fulfilled") setWatchlist(w.value);
    else { setWatchlist(null); nextErrors.watchlist = messageOf(w.reason); }
    if (a.status === "fulfilled") {
      setActivity(a.value.data);
      setActivityPage({ page: a.value.current_page, lastPage: a.value.last_page, total: a.value.total });
    } else {
      setActivity([]);
      setActivityPage({ page: 0, lastPage: 1, total: 0 });
      nextErrors.activity = messageOf(a.reason);
    }

    setErrors(nextErrors);
    setLoadedParams(params);
    setIsLoading(false);
  }, []);

  /** The next page of "What changed", appended. */
  const loadMoreActivity = useCallback(async () => {
    if (!loadedParams || activityPage.page >= activityPage.lastPage) return;
    setIsLoadingMore(true);
    try {
      const next = await maintenanceTicketsService.getAnalyticsActivity(loadedParams, activityPage.page + 1);
      setActivity((prev) => [...prev, ...next.data]);
      setActivityPage({ page: next.current_page, lastPage: next.last_page, total: next.total });
    } catch (err) {
      setErrors((prev) => ({ ...prev, activity: messageOf(err) }));
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadedParams, activityPage]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    summary,
    watchlist,
    activity,
    activityPage,
    errors,
    isLoading,
    isLoadingMore,
    loadedParams,
    load,
    loadMoreActivity,
  };
}
