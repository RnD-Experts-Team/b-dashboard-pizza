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
import type { ScheduleMode } from "@/types/scheduling.types";
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
 */

/** Debounce for `search`, since every request costs an upstream token verify. */
const SEARCH_DEBOUNCE_MS = 300;

export interface UseScheduleWeekParams {
  storeId: string | null;
  /** Any day inside the target week — the server snaps it to the true start. */
  weekStart: string;
  mode: ScheduleMode;
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
  refetch: () => void;
}

export function useScheduleWeek({
  storeId,
  weekStart,
  mode,
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

  const fetchWeek = useCallback(async () => {
    if (!storeId) {
      setData(null);
      hasLoadedRef.current = false;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (hasLoadedRef.current) setIsRefetching(true);
    else setIsLoading(true);
    setError(null);
    setSetupError(null);

    try {
      const raw = await schedulingService.getWeek(
        storeId,
        {
          week_start: weekStart,
          mode,
          // Omit rather than send "All" — the API treats absence as no filter.
          ...(department && department !== "All" ? { department } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setData(adaptScheduleWeek(raw));
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
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [storeId, weekStart, mode, department, debouncedSearch]);

  useEffect(() => {
    fetchWeek();
    return () => abortRef.current?.abort();
  }, [fetchWeek]);

  // A store change is a different schedule entirely — drop the old week so the
  // grid never shows one store's shifts under another store's name.
  useEffect(() => {
    hasLoadedRef.current = false;
    setData(null);
  }, [storeId]);

  return { data, isLoading, isRefetching, error, setupError, refetch: fetchWeek };
}
