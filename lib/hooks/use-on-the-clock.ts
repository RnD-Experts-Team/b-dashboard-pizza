"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { schedulingService, handleUnauthorized } from "@/lib/api/services/scheduling.service";
import { adaptOnTheClock } from "@/lib/scheduling/adapters";
import { parseSchedulingError, type SchedulingError } from "@/lib/scheduling/errors";
import type { OnTheClockEntry } from "@/types/scheduling.types";

/**
 * Who is on the clock at this store, kept roughly current.
 *
 * Polling is affordable here and nowhere else in this feature: the endpoint
 * answers from our own database rather than calling TCP, so it costs nothing
 * against the vendor's 2500-a-day account budget. The underlying rows refresh
 * from TCP every ten minutes, so polling faster than about half a minute buys
 * nothing but load.
 *
 * Only polls while the dialog is open AND the tab is visible. A board nobody
 * is looking at is the easy way to spend a night making pointless requests.
 */

const POLL_MS = 30_000;

interface UseOnTheClockOptions {
  storeId: string | null;
  /** Poll only while the board is actually on screen. */
  enabled: boolean;
}

interface UseOnTheClockResult {
  entries: OnTheClockEntry[];
  /** True only on the first load, so a refresh does not blank the list. */
  isLoading: boolean;
  isRefreshing: boolean;
  error: SchedulingError | null;
  lastFetchedAt: number | null;
  refresh: () => void;
}

export function useOnTheClock({
  storeId,
  enabled,
}: UseOnTheClockOptions): UseOnTheClockResult {
  const [entries, setEntries] = useState<OnTheClockEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  /** Whether anything has landed yet, so a poll never re-shows the skeleton. */
  const hasLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchNow = useCallback(async () => {
    if (!storeId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (hasLoadedRef.current) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const raw = await schedulingService.getOnTheClock(
        storeId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setEntries(
        Array.isArray(raw) ? raw.map(adaptOnTheClock) : [],
      );
      setError(null);
      hasLoadedRef.current = true;
      setLastFetchedAt(Date.now());
    } catch (err) {
      if (controller.signal.aborted) return;
      const parsed = parseSchedulingError(
        err,
        "Could not check who is on the clock.",
      );
      if (handleUnauthorized(parsed.status)) return;
      setError(parsed);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [storeId]);

  // Fetch on open, then poll only while the tab is actually being looked at.
  useEffect(() => {
    if (!enabled || !storeId) return;

    /**
     * Fetch once, unconditionally.
     *
     * Deliberately outside the visibility check below: a board that opened
     * with an empty list because the tab happened to be in the background
     * would be reporting that nobody is working, which is worse than slow.
     * Only the repeating poll is worth suppressing.
     */
    void fetchNow();

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void fetchNow(), POLL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        stop();
        return;
      }
      // Coming back to a board that sat idle — catch it up before resuming.
      void fetchNow();
      start();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [enabled, storeId, fetchNow]);

  // A different store's board has nothing to do with this one's.
  useEffect(() => {
    hasLoadedRef.current = false;
    setEntries([]);
    setLastFetchedAt(null);
  }, [storeId]);

  return {
    entries,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    refresh: () => void fetchNow(),
  };
}
