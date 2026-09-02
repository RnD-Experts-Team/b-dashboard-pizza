"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import {
  adaptScheduleWeek,
  type ScheduleWeekData,
} from "@/lib/scheduling/adapters";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import {
  fetchedAtOf,
  invalidateStore,
  isStale,
  keyFor,
  readFresh,
  write,
} from "@/lib/scheduling/week-cache";
import type { SetupErrorCode } from "@/components/scheduling/schedule-setup-error";

/**
 * The scheduling grid's single bootstrap fetch.
 *
 * `GET /schedule/week` returns roster, shifts, actuals, availability, time off,
 * conflicts, stats, store settings and the published record in one trip — so the
 * user never watches a week assemble itself piece by piece, and the derived
 * numbers can never disagree with each other.
 *
 * Follows the AbortController pattern from `use-labor-dashboard`: abort the
 * in-flight request before starting a new one, guard every state write on
 * `!signal.aborted`, and bail out silently on cancellation.
 *
 * ## Always `mode=both`
 *
 * The three views (Planned, Actual, Compare) used to each request their own
 * `mode`, so a tour of the tabs cost three round trips. `both` is a strict
 * superset: the grid derives `displayShifts` locally, and the server's `stats`
 * describes the PLAN in every mode — which is why Actual and Compare already
 * ignore it and compute their own. One response therefore renders all three,
 * and toggling now costs nothing at all rather than being merely cached.
 *
 * `mode` is not a parameter of this hook precisely so it cannot drift back.
 *
 * ## Caching
 *
 * Reads go through `lib/scheduling/week-cache` first (5 min, in-memory). The
 * remaining benefit is week navigation — leaving a week and returning to it.
 */

/** Debounce for `search`, since every request costs an upstream token verify. */
const SEARCH_DEBOUNCE_MS = 300;

export interface UseScheduleWeekParams {
  storeId: string | null;
  /** Any day inside the target week — the server snaps it to the true start. */
  weekStart: string;
  department?: string;
  search?: string;
}

export interface UseScheduleWeekResult {
  data: ScheduleWeekData | null;
  isLoading: boolean;
  /** True on a background refetch, so the grid can stay visible. */
  isRefetching: boolean;
  error: SchedulingError | null;
  /**
   * Set when the store itself is not configured for scheduling. These are
   * dead ends, not user errors — the grid should be replaced, not annotated.
   */
  setupError: { code: SetupErrorCode; message: string } | null;
  /**
   * Discard every cached week for this store, then fetch.
   *
   * IMPORTANT: this is the ONLY cache-invalidation path. Every write on the
   * page already funnels through it — the three mutation hooks receive it as
   * `refetchWeek`, and bulk operations call it from `onSettled` — which is what
   * makes caching safe here. A future mutation that updates state directly
   * without calling this will serve stale data.
   */
  refetch: () => void;
  /**
   * Refetch only if the cached week has aged out.
   *
   * The view toggle calls this. Switching between Planned, Actual and Compare
   * does not change what is requested — one `both` response serves all three —
   * so nothing would otherwise ever re-check freshness for a manager who sits
   * on one week and keeps toggling. This restores the TTL's meaning for that
   * case without making the toggle itself cost a request.
   */
  revalidateIfStale: () => void;
  /** When the data on screen was fetched, epoch ms; null when not cached. */
  lastFetchedAt: number | null;
}

export function useScheduleWeek({
  storeId,
  weekStart,
  department,
  search,
}: UseScheduleWeekParams): UseScheduleWeekResult {
  const [data, setData] = useState<ScheduleWeekData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [setupError, setSetupError] =
    useState<UseScheduleWeekResult["setupError"]>(null);

  const abortRef = useRef<AbortController | null>(null);
  /**
   * True while a request is running. `abortRef` cannot answer this — it holds a
   * controller whether or not its request has settled — and without it a toggle
   * during the initial load would abort that load and start an identical one.
   */
  const inFlightRef = useRef(false);
  /** Distinguishes the first load (show a skeleton) from a refetch (keep the grid). */
  const hasLoadedRef = useRef(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search ?? ""),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);

  const cacheKey = storeId
    ? keyFor(storeId, weekStart, department, debouncedSearch)
    : null;

  const fetchWeek = useCallback(
    async (opts?: { skipCache?: boolean }) => {
    if (!storeId) {
      setData(null);
      hasLoadedRef.current = false;
      return;
    }

    const key = keyFor(storeId, weekStart, department, debouncedSearch);

    // Read-through: a fresh entry renders with no request and no spinner, which
    // is what makes toggling and week-flipping feel instant.
    if (!opts?.skipCache) {
      const cached = readFresh(key);
      if (cached) {
        abortRef.current?.abort();
        setData(cached);
        setError(null);
        setSetupError(null);
        setIsLoading(false);
        setIsRefetching(false);
        hasLoadedRef.current = true;
        return;
      }
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    inFlightRef.current = true;
    if (hasLoadedRef.current) setIsRefetching(true);
    else setIsLoading(true);
    setError(null);
    setSetupError(null);

    try {
      // `mode: "both"` always — see the note at the top of this file.
      const raw = await schedulingService.getWeek(
        storeId,
        {
          week_start: weekStart,
          mode: "both",
          // Omit rather than send "All" — the API treats absence as no filter.
          ...(department && department !== "All" ? { department } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        const adapted = adaptScheduleWeek(raw);
        write(key, adapted);
        setData(adapted);
        hasLoadedRef.current = true;
      }
    } catch (err) {
      if (controller.signal.aborted || axios.isCancel(err)) return;

      const parsed = parseSchedulingError(
        err,
        "Could not load this week's schedule."
      );

      // These bypass axiosClient's interceptor, so 401 is handled explicitly.
      if (handleUnauthorized(parsed.status)) return;

      if (!controller.signal.aborted) {
        if (parsed.isSetup) {
          setSetupError({
            code: parsed.code as SetupErrorCode,
            message: parsed.message,
          });
          setData(null);
        } else {
          setError(parsed);
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        inFlightRef.current = false;
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  },
    [storeId, weekStart, department, debouncedSearch]
  );

  useEffect(() => {
    fetchWeek();
    return () => abortRef.current?.abort();
  }, [fetchWeek]);

  /**
   * Manual refresh, and the single invalidation point for the whole page.
   *
   * Drops every cached week for this store before fetching — not just the one
   * on screen — because a recurring shift or an applied template writes into
   * later weeks too, which a week-scoped drop would leave cached and wrong.
   */
  const refetch = useCallback(() => {
    if (storeId) invalidateStore(storeId);
    void fetchWeek({ skipCache: true });
  }, [storeId, fetchWeek]);

  /**
   * Refetch only when the current week has actually aged out.
   *
   * Shared by the view toggle and the tab-focus handler below: both mean "the
   * user is looking at this again — is it still good?", and neither should cost
   * a request when the answer is yes.
   */
  const revalidateIfStale = useCallback(() => {
    if (!storeId || inFlightRef.current) return;
    const key = keyFor(storeId, weekStart, department, debouncedSearch);
    if (isStale(key)) void fetchWeek({ skipCache: true });
  }, [storeId, weekStart, department, debouncedSearch, fetchWeek]);

  /**
   * Coming back to the tab after a while. Scheduling is collaborative, so a
   * week cached before the user walked away may have been changed by another
   * manager since.
   *
   * Same shape as `lib/hooks/use-dspr.ts`.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      revalidateIfStale();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [revalidateIfStale]);

  // A store change is a different schedule entirely — drop the old week so the
  // grid never shows one store's shifts under another store's name.
  useEffect(() => {
    hasLoadedRef.current = false;
    setData(null);
  }, [storeId]);

  return {
    data,
    isLoading,
    isRefetching,
    error,
    setupError,
    refetch,
    revalidateIfStale,
    lastFetchedAt: cacheKey ? fetchedAtOf(cacheKey) : null,
  };
}
