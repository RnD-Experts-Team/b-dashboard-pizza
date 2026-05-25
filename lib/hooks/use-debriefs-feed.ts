"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  EmployeeDebriefError,
  employeeDebriefService,
} from "@/lib/api/services/employee-debriefs.service";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

export interface DebriefPage {
  dateFrom: string;
  dateTo: string;
  /** Items keyed by YYYY-MM-DD, only days with items included */
  days: Record<string, EmployeeDebriefItem[]>;
}

interface UseDebriefsFeedReturn {
  pages: DebriefPage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
  inject: (item: EmployeeDebriefItem) => void;
  /** Increments each time inject successfully adds an item; used to trigger scroll-to-bottom. */
  lastInjectTime: number;
}

const CHUNK_DAYS = 7;

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches employee debriefs for a date range, with infinite scroll support.
 * Initial range: dateFrom → dateTo.
 * loadMore() extends backwards by CHUNK_DAYS.
 * hasMore becomes false when the loaded range spans > 365 days from dateTo.
 */
export function useDebriefsFeed(
  storeId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  employeeId?: number | null
): UseDebriefsFeedReturn {
  const [pages, setPages] = useState<DebriefPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastInjectTime, setLastInjectTime] = useState(0);

  // Keep filter values in refs so inject() always sees the latest
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  const employeeIdRef = useRef(employeeId);
  dateFromRef.current = dateFrom;
  dateToRef.current = dateTo;
  employeeIdRef.current = employeeId;

  // Track the oldest loaded `from` date
  const oldestFromRef = useRef<string | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Initial load / reload
  useEffect(() => {
    if (!storeId || !dateFrom || !dateTo) {
      setPages([]);
      setIsLoading(false);
      setError(null);
      setHasMore(true);
      oldestFromRef.current = null;
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setPages([]);
    setError(null);
    setHasMore(true);
    oldestFromRef.current = dateFrom;

    employeeDebriefService
      .listRange(storeId, dateFrom, dateTo, controller.signal, employeeId)
      .then((days) => {
        if (controller.signal.aborted) return;
        // Filter out empty days
        const nonEmpty: Record<string, EmployeeDebriefItem[]> = {};
        for (const [day, items] of Object.entries(days)) {
          if (items.length > 0) nonEmpty[day] = items;
        }
        setPages([{ dateFrom, dateTo, days: nonEmpty }]);
        oldestFromRef.current = dateFrom;
        // Stop if no items found at all, or range limit reached
        const limitDate = offsetDate(dateTo, -365);
        const hasItems = Object.keys(nonEmpty).length > 0;
        setHasMore(hasItems && dateFrom > limitDate);
      })
      .catch((err) => {
        if (isCanceledError(err) || controller.signal.aborted) return;
        setError(
          err instanceof EmployeeDebriefError
            ? err.message
            : "Failed to load employee debriefs."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, dateFrom, dateTo, employeeId, reloadKey]);

  const loadMore = useCallback(() => {
    if (!storeId || !dateTo || isLoadingMore || isLoading || !hasMore) return;
    const currentFrom = oldestFromRef.current;
    if (!currentFrom) return;

    const newTo = offsetDate(currentFrom, -1);
    const newFrom = offsetDate(currentFrom, -CHUNK_DAYS);

    const limitDate = offsetDate(dateTo, -365);
    if (newTo < limitDate) {
      setHasMore(false);
      return;
    }

    setIsLoadingMore(true);
    const controller = new AbortController();

    employeeDebriefService
      .listRange(storeId, newFrom, newTo, controller.signal, employeeId)
      .then((days) => {
        if (controller.signal.aborted) return;
        const nonEmpty: Record<string, EmployeeDebriefItem[]> = {};
        for (const [day, items] of Object.entries(days)) {
          if (items.length > 0) nonEmpty[day] = items;
        }
        setPages((prev) => [{ dateFrom: newFrom, dateTo: newTo, days: nonEmpty }, ...prev]);
        oldestFromRef.current = newFrom;
        // Stop if no items found in this chunk, or range limit reached
        const hasItems = Object.keys(nonEmpty).length > 0;
        setHasMore(hasItems && newFrom > limitDate);
      })
      .catch((err) => {
        if (isCanceledError(err) || controller.signal.aborted) return;
        setError(
          err instanceof EmployeeDebriefError
            ? err.message
            : "Failed to load more debriefs."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingMore(false);
      });
  }, [storeId, dateTo, isLoadingMore, isLoading, hasMore]);

  const inject = useCallback((item: EmployeeDebriefItem) => {
    // Normalize date to YYYY-MM-DD — the server may return a full ISO datetime string
    const itemDate = item.date ? item.date.slice(0, 10) : null;
    if (!itemDate) return;
    // Only inject if the item's date is within the currently loaded range
    const from = dateFromRef.current;
    const to = dateToRef.current;
    if (from && itemDate < from) return;
    if (to && itemDate > to) return;
    // Only inject if it matches the active employee filter
    const empId = employeeIdRef.current;
    if (empId != null && item.employeeId !== empId) return;

    setPages((prev) => {
      const pageIdx = prev.findIndex(
        (p) => itemDate >= p.dateFrom && itemDate <= p.dateTo
      );
      if (pageIdx === -1) return prev;
      const page = prev[pageIdx];
      const existingDay = page.days[itemDate] ?? [];
      // Deduplicate by id
      if (existingDay.some((e) => e.id === item.id)) return prev;
      const updatedPage: DebriefPage = {
        ...page,
        days: { ...page.days, [itemDate]: [...existingDay, item] },
      };
      const newPages = [...prev];
      newPages[pageIdx] = updatedPage;
      return newPages;
    });
    // Signal the feed to scroll to bottom so the new item is visible
    setLastInjectTime(Date.now());
  }, []);

  return { pages, isLoading, isLoadingMore, hasMore, error, loadMore, reload, inject, lastInjectTime };
}
