"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import { insightsWindow } from "@/lib/scheduling/insights";
import { parseSchedulingError } from "@/lib/scheduling/errors";
import { todayIso } from "@/lib/scheduling/week";
import type { SchedulingInsights } from "@/types/scheduling.types";

/**
 * The staffing guide's history.
 *
 * This is last weeks' sales and staffing, not this week's schedule, so it does
 * not change while a manager plans and is not touched by any write on the page.
 * That is what makes a long-lived in-memory cache safe here, where the week
 * itself only gets five minutes.
 *
 * It is keyed by the WINDOW, not the week: planning next week and the week after
 * both look back at the same four finished weeks, so flipping between them costs
 * nothing.
 *
 * It loads independently of the grid on purpose. The guide is an aid, and a slow
 * or failing history service must never hold up, or blank, the schedule.
 */

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 12;

interface Entry {
  data: SchedulingInsights;
  fetchedAt: number;
}

const cache = new Map<string, Entry>();

function readFresh(key: string): SchedulingInsights | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.fetchedAt >= TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function write(key: string, data: SchedulingInsights): void {
  cache.set(key, { data, fetchedAt: Date.now() });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export interface UseSchedulingInsightsResult {
  data: SchedulingInsights | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useSchedulingInsights(
  storeId: string | null,
  /** The grid's true week start, `week.start`. */
  weekStart: string,
  /** Skip the request while the guide is closed and has never been opened. */
  enabled = true,
): UseSchedulingInsightsResult {
  const [data, setData] = useState<SchedulingInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchInsights = useCallback(
    async (skipCache = false) => {
      if (!storeId || !enabled) return;

      const today = todayIso();
      const window = insightsWindow(weekStart, today);
      const key = `${storeId}|${window.start}|${window.end}`;

      if (!skipCache) {
        const hit = readFresh(key);
        if (hit) {
          abortRef.current?.abort();
          setData(hit);
          setError(null);
          setIsLoading(false);
          return;
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const result = await schedulingService.getInsights(
          storeId,
          { week_start: weekStart, today },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        write(key, result);
        setData(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load the staffing history.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [storeId, weekStart, enabled],
  );

  // A different store is a different history.
  const lastStoreRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastStoreRef.current !== storeId) {
      lastStoreRef.current = storeId;
      setData(null);
    }
  }, [storeId]);

  useEffect(() => {
    void fetchInsights();
    return () => abortRef.current?.abort();
  }, [fetchInsights]);

  const retry = useCallback(() => void fetchInsights(true), [fetchInsights]);

  return { data, isLoading, error, retry };
}
