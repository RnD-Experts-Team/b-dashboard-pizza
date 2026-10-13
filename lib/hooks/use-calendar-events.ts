"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calendarService } from "@/lib/api/services/calendar.service";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { addDays, dayKey, startOfDay } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarEventInput, CalendarStoreRef, DateRange } from "@/lib/calendar/types";

/** Show the skeleton only when data is slower than this (no flash on fast loads). */
const SKELETON_DELAY_MS = 150;

/** The dashboard's selected store, in the calendar's shape. */
export function useCalendarStoreRef(): CalendarStoreRef | null {
  const selected = useSelectedStoreStore((s) => s.selectedStore);
  return useMemo(
    () => (selected ? { code: selected.storeId, name: selected.name } : null),
    [selected],
  );
}

/** "This store" scope keeps only the selected store's events (no store selected → everything). */
function useScoped(events: CalendarEvent[], store: CalendarStoreRef | null): CalendarEvent[] {
  const scope = useCalendarStore((s) => s.scope);
  return useMemo(
    () => (scope === "store" && store ? events.filter((e) => e.store.code === store.code) : events),
    [events, scope, store],
  );
}

/**
 * Wall-clock tick for now-lines, live events and "ended" states. `null` until
 * mounted so the first client paint matches SSR.
 */
export function useCalendarNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface CalendarEventsResult {
  events: CalendarEvent[];
  /**
   * The current range's data hasn't arrived yet. Views must not read an empty
   * `events` as "nothing scheduled" while this is true.
   */
  loading: boolean;
  /** True only after SKELETON_DELAY_MS of waiting. */
  showSkeleton: boolean;
  error: boolean;
  retry: () => void;
}

const EMPTY: CalendarEvent[] = [];

/**
 * Events overlapping a range, scoped to the selected store unless the user
 * picked "All stores". Stale responses (the user paged on) are dropped, and a
 * failure surfaces as `error` with a `retry()` — never a silently empty view.
 *
 * Results are keyed by the request they answer, so a range change never shows
 * the previous range's events (or a false "nothing scheduled") in between.
 */
export function useCalendarEvents(range: DateRange): CalendarEventsResult {
  const store = useCalendarStoreRef();
  const [loaded, setLoaded] = useState<{ key: string; events: CalendarEvent[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const revision = useCalendarStore((s) => s.revision);

  const fromMs = +range.from;
  const toMs = +range.to;
  const key = `${fromMs}|${toMs}|${store?.code ?? ""}|${attempt}|${revision}`;

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const slow = setTimeout(() => {
      if (live) setSlowKey(key);
    }, SKELETON_DELAY_MS);

    calendarService
      .getEvents({ from: new Date(fromMs), to: new Date(toMs) }, store, controller.signal)
      .then((list) => {
        if (live) setLoaded({ key, events: list });
      })
      .catch(() => {
        if (live && !controller.signal.aborted) setFailedKey(key);
      })
      .finally(() => clearTimeout(slow));

    return () => {
      live = false;
      clearTimeout(slow);
      controller.abort();
    };
  }, [key, fromMs, toMs, store]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const fresh = loaded?.key === key;
  const error = failedKey === key;
  const loading = !fresh && !error;
  return {
    events: useScoped(fresh ? loaded.events : EMPTY, store),
    loading,
    showSkeleton: loading && slowKey === key,
    error,
    retry,
  };
}

/**
 * ALL of today's events (category filters and search ignored — they drive the
 * topbar badge and the Today panel). Reloads when the date rolls over.
 */
export function useTodayEvents(): { events: CalendarEvent[]; todayKey: string | null; now: number | null } {
  const now = useCalendarNow();
  const todayKey = now == null ? null : dayKey(new Date(now));
  const range = useMemo<DateRange>(() => {
    const from = todayKey ? startOfDay(new Date(now!)) : startOfDay(new Date(0));
    return { from, to: addDays(from, 1) };
    // `now` ticks every minute; the range only changes with the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);
  const { events } = useCalendarEvents(range);
  return { events: todayKey ? events : [], todayKey, now };
}

/** Fallback store for events created with no store selected. */
const NO_STORE: CalendarStoreRef = { code: "03795-00001", name: "Downtown" };

/**
 * Create / update / delete / restore for the events people make here. Each
 * write bumps `revision`, so every mounted calendar view refetches. Errors are
 * re-thrown for the caller to show.
 */
export function useCalendarMutations() {
  const store = useCalendarStoreRef();
  const bump = useCalendarStore((s) => s.bumpRevision);
  return useMemo(
    () => ({
      create: async (input: CalendarEventInput) => {
        const ev = await calendarService.createEvent(input, store ?? NO_STORE);
        bump();
        return ev;
      },
      update: async (id: string, input: CalendarEventInput) => {
        const ev = await calendarService.updateEvent(id, input);
        bump();
        return ev;
      },
      remove: async (id: string) => {
        const snapshot = await calendarService.deleteEvent(id);
        bump();
        return snapshot;
      },
      restore: async (snapshot: unknown) => {
        await calendarService.restoreEvent(snapshot);
        bump();
      },
    }),
    [store, bump],
  );
}
