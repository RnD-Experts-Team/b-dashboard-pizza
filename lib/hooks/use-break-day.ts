"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { breaksService } from "@/lib/api/services/breaks.service";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import { useBreaksStore } from "@/lib/store/breaks.store";
import type { BreakDay } from "@/types/breaks.types";

/**
 * One work day's breakdown.
 *
 * The CURRENT work day is read straight from the shared store (the topbar
 * already polls it while a break runs), so the page never double-polls it.
 * Any other day is fetched once — a settled past day is read-only upstream
 * and only changes when this user edits it, which calls `reload()`.
 */
export function useBreakDay(date: string | null) {
  const today = useBreaksStore((s) => s.today);
  const storeReady = useBreaksStore((s) => s.ready);
  const storeError = useBreaksStore((s) => s.syncError);
  const refreshStore = useBreaksStore((s) => s.refresh);

  const isToday = !date || (today != null && date === today.work_date);

  const [day, setDay] = useState<BreakDay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BreakError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOther = useCallback(async () => {
    if (!date) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await breaksService.getDay(date, controller.signal);
      if (!controller.signal.aborted) setDay(result);
    } catch (err) {
      const parsed = parseBreakError(err);
      if (parsed.code !== "CANCELLED") setError(parsed);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [date]);

  // Wait for the store's first sync before deciding a date is "other" —
  // otherwise today's date would be fetched twice on a cold load.
  const decided = storeReady || today != null;

  useEffect(() => {
    if (!decided || isToday) return;
    void fetchOther();
    return () => abortRef.current?.abort();
  }, [decided, isToday, fetchOther]);

  const reload = useCallback(async () => {
    await refreshStore();
    if (!isToday) await fetchOther();
  }, [isToday, refreshStore, fetchOther]);

  if (isToday) {
    return {
      day: today,
      loading: !storeReady && !today,
      error: today ? null : storeError,
      isToday: true,
      reload,
    };
  }
  return { day, loading: (loading || !decided) && !day, error, isToday: false, reload };
}
