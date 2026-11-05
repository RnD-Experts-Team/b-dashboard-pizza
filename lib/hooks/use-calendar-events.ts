"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calendarService, type CalendarEventsPage, type CalendarYearCounts } from "@/lib/api/services/calendar.service";
import { calendarToolboxService } from "@/lib/api/services/calendar-toolbox.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { addDays, dayKey, startOfDay } from "@/lib/calendar/dates";
import { isStoreCode, type FeedSource } from "@/lib/calendar/feed-types";
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

/**
 * The stores the user can pick in the Calendar: the same list as the sidebar's
 * store picker (active stores, in its order), in the calendar's shape. Stores
 * without a readable store number are left out — the feeds only know numbers.
 */
export function useCalendarStoreOptions(): CalendarStoreRef[] {
  const overview = useAuthStore((s) => s.overviewStores);
  return useMemo(
    () =>
      (overview ?? [])
        .filter((s) => s.isActive !== false && isStoreCode(s.storeId))
        .map((s) => ({ code: s.storeId!, name: s.name })),
    [overview],
  );
}

/**
 * The stores the Calendar page shows: the ones the user picked (kept only while
 * they are still stores the user can pick), otherwise just the dashboard's
 * selected store, following it as it changes.
 */
export function useCalendarStores(): CalendarStoreRef[] {
  const dashboard = useCalendarStoreRef();
  const options = useCalendarStoreOptions();
  const codes = useCalendarStore((s) => s.storeCodes);
  return useMemo(() => {
    if (codes?.length) {
      const picked = options.filter((o) => codes.includes(o.code));
      if (picked.length) return picked;
    }
    return dashboard ? [dashboard] : [];
  }, [codes, options, dashboard]);
}

/**
 * Keeps only the events of `stores` (none given → everything). Company-wide
 * events (announcements) belong to every store.
 */
function useScoped(events: CalendarEvent[], stores: readonly CalendarStoreRef[]): CalendarEvent[] {
  return useMemo(() => {
    if (!stores.length) return events;
    const codes = new Set(stores.map((s) => s.code));
    return events.filter((e) => e.companyWide || codes.has(e.store.code));
  }, [events, stores]);
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
  /** Nothing could be loaded at all (every feed failed). */
  error: boolean;
  retry: () => void;
  /** Feeds that failed while others loaded — the page names them. */
  failed: FeedSource[];
  /** Some feed hit its event cap. */
  truncated: boolean;
}

const EMPTY_PAGE: CalendarEventsPage = { events: [], failed: [], truncated: false };

/**
 * Events overlapping a range, for the stores the Calendar shows
 * (`useCalendarStores`) — or, with `source: "dashboard"`, only the dashboard's
 * selected store (the topbar's Today panel: it must stay cheap on every page,
 * however many stores were picked in the Calendar). Stale responses (the user
 * paged on) are dropped. If no feed loads at all it surfaces as `error` with a
 * `retry()` — never a silently empty view; if only some fail, they are listed
 * in `failed`.
 *
 * Results are keyed by the request they answer, so a range change never shows
 * the previous range's events (or a false "nothing scheduled") in between.
 */
export function useCalendarEvents(
  range: DateRange,
  { enabled = true, source = "selection" }: { enabled?: boolean; source?: "selection" | "dashboard" } = {},
): CalendarEventsResult {
  const dashboard = useCalendarStoreRef();
  const picked = useCalendarStores();
  const stores = useMemo(() => (source === "dashboard" ? (dashboard ? [dashboard] : []) : picked), [source, dashboard, picked]);
  const [loaded, setLoaded] = useState<{ key: string; baseKey: string; page: CalendarEventsPage } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Retry must skip the 60 s feed cache; ordinary refetches use it. */
  const forceNext = useRef(false);
  const revision = useCalendarStore((s) => s.revision);

  const fromMs = +range.from;
  const toMs = +range.to;
  const storesKey = stores.map((s) => s.code).join(",");
  // `baseKey` is the request without `revision`: a write bumps only the revision,
  // and the view keeps showing what it has while that one feed reloads.
  const baseKey = `${fromMs}|${toMs}|${storesKey}|${attempt}`;
  const key = `${baseKey}|${revision}`;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const controller = new AbortController();
    const slow = setTimeout(() => {
      if (live) setSlowKey(key);
    }, SKELETON_DELAY_MS);
    const force = forceNext.current;
    forceNext.current = false;
    // Same request as the one on screen, only `revision` moved (a write): reuse every
    // cached feed however old — the write already dropped the one it touched, so just
    // that one is asked again (FRONTEND_CALENDAR_REQUESTS.md §4).
    const reuse = !force && loaded?.baseKey === baseKey;

    calendarService
      .getEvents({ from: new Date(fromMs), to: new Date(toMs) }, stores, { signal: controller.signal, force, reuse })
      .then((page) => {
        if (live) setLoaded({ key, baseKey, page });
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
    // `stores` is captured through `storesKey` (part of `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fromMs, toMs, enabled]);

  const retry = useCallback(() => {
    forceNext.current = true;
    setAttempt((n) => n + 1);
  }, []);
  const fresh = loaded?.key === key;
  // Same request, older revision (a write just happened): show it while the refresh runs.
  const stale = !fresh && loaded?.baseKey === baseKey;
  const error = failedKey === key;
  const loading = !fresh && !stale && !error;
  const page = (fresh || stale) && loaded ? loaded.page : EMPTY_PAGE;
  return {
    events: useScoped(page.events, stores),
    loading,
    showSkeleton: loading && slowKey === key,
    error,
    retry,
    failed: page.failed,
    truncated: page.truncated,
  };
}

const EMPTY_YEAR: CalendarYearCounts = { days: new Map(), failed: [], truncated: false };

/**
 * The Year view's daily counts for the stores the Calendar shows
 * (`calendarService.getYearCounts`, `group=day`). Same contract as
 * `useCalendarEvents`: keyed by the request so another year never flashes the
 * previous one, a skeleton only after a short wait, `error` + `retry()` when no
 * source loads. A write bumps `revision`, which re-reads only what it dropped.
 */
export function useCalendarYear(range: DateRange, { enabled = true }: { enabled?: boolean } = {}) {
  const stores = useCalendarStores();
  const [loaded, setLoaded] = useState<{ key: string; data: CalendarYearCounts } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const forceNext = useRef(false);
  const revision = useCalendarStore((s) => s.revision);

  const fromMs = +range.from;
  const toMs = +range.to;
  const storesKey = stores.map((s) => s.code).join(",");
  const key = `${fromMs}|${toMs}|${storesKey}|${attempt}|${revision}`;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const controller = new AbortController();
    const slow = setTimeout(() => {
      if (live) setSlowKey(key);
    }, SKELETON_DELAY_MS);
    const force = forceNext.current;
    forceNext.current = false;

    calendarService
      .getYearCounts({ from: new Date(fromMs), to: new Date(toMs) }, stores, { signal: controller.signal, force })
      .then((data) => {
        if (live) setLoaded({ key, data });
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
    // `stores` is captured through `storesKey` (part of `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fromMs, toMs, enabled]);

  const retry = useCallback(() => {
    forceNext.current = true;
    setAttempt((n) => n + 1);
  }, []);
  const fresh = loaded?.key === key;
  const error = failedKey === key;
  const loading = enabled && !fresh && !error;
  const data = fresh && loaded ? loaded.data : EMPTY_YEAR;
  return { ...data, loading, showSkeleton: loading && slowKey === key, error, retry };
}

/**
 * ALL of today's events in the dashboard's selected store (category filters,
 * search and the Calendar page's store picks ignored — they drive the topbar
 * badge and the Today panel, which belong to the store you are working in).
 * Reloads when the date rolls over.
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
  // Nothing to ask until the clock is known (the placeholder range is 1970).
  const { events } = useCalendarEvents(range, { enabled: todayKey != null, source: "dashboard" });
  return { events: todayKey ? events : [], todayKey, now };
}

/** Fallback store for events created with no store selected. */
const NO_STORE: CalendarStoreRef = { code: "03795-00001", name: "Downtown" };

/**
 * The store a new event is saved under: the first store the Calendar shows, so
 * it never lands in a store the page is hiding. (Becomes the event's store list
 * when the Toolbox calendar endpoints are wired.)
 */
export function useCalendarWriteStore(): CalendarStoreRef | null {
  return useCalendarStores()[0] ?? null;
}

/**
 * Writes to Toolbox: create an event, task or reminder; cancel; move a task
 * along; snooze, finish or drop a reminder. Each one bumps `revision` so the
 * views refetch (the service already dropped the Toolbox feed's cache), and
 * re-throws a `CalendarWriteError` for the caller to show.
 */
export function useCalendarToolbox() {
  const bump = useCalendarStore((s) => s.bumpRevision);
  return useMemo(() => {
    const then = <A extends unknown[]>(fn: (...args: A) => Promise<void>) => {
      return async (...args: A) => {
        await fn(...args);
        bump();
      };
    };
    return {
      create: then(calendarToolboxService.createItem),
      cancel: then(calendarToolboxService.cancelEvent),
      taskAction: then(calendarToolboxService.taskAction),
      reminderAction: then(calendarToolboxService.reminderAction),
    };
  }, [bump]);
}

/**
 * Create / update / delete / restore for the events people make here. Each
 * write bumps `revision`, so every mounted calendar view refetches. Errors are
 * re-thrown for the caller to show.
 */
export function useCalendarMutations() {
  const store = useCalendarWriteStore();
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
