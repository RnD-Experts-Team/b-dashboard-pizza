"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { dueKeysService, DueKeysError } from "@/lib/api/services/due-keys.service";
import type { DueKeyItem, Employee } from "@/types/due-key.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One day's worth of data */
export interface DayPage {
  date: string;
  items: DueKeyItem[];
  employees: Employee[];
}

export interface UseDueKeysFeedState {
  pages: DayPage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many days we fetch per request */
const BATCH_DAYS = 3;

/** How far back (in days from today) we ever try to load */
const MAX_DAYS_BACK = 90;

/** Minimum ms to wait between consecutive load-more requests */
const LOAD_MORE_THROTTLE_MS = 600;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDueKeysFeed(
  storeId: string | null,
  /** Start of the date range. Defaults to dateTo - 2 days. */
  dateFrom?: string | null,
  /** End of the date range. Defaults to today. */
  dateTo?: string | null,
  /** Tag IDs to filter by */
  selectedTags?: number[] | null,
): UseDueKeysFeedState {
  const anchor = dateTo ?? todayStr();
  const initialFrom = dateFrom ?? subtractDays(anchor, BATCH_DAYS - 1);
  const tagsKey = (selectedTags ?? []).slice().sort().join(",");

  // Keep selected tags in a ref so load-more always uses the current value
  const selectedTagsRef = useRef<number[]>(selectedTags ?? []);
  selectedTagsRef.current = selectedTags ?? [];

  const [pages, setPages] = useState<DayPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // `oldestFrom` tracks the `from` date of the last-fetched batch so that
  // load-more knows where to continue.
  const oldestFromRef = useRef<string | null>(null);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // ── Initial / reload fetch ────────────────────────────────────────
  useEffect(() => {
    if (!storeId) {
      setPages([]);
      setIsLoading(false);
      setHasMore(true);
      setError(null);
      oldestFromRef.current = null;
      return;
    }

    const controller = new AbortController();

    // First batch: from initialFrom to anchor
    const to = anchor;
    const from = initialFrom;

    setIsLoading(true);
    setPages([]);
    setError(null);
    setHasMore(true);
    oldestFromRef.current = null;

    dueKeysService
      .getDueRange(
        storeId,
        from,
        to,
        controller.signal,
        selectedTagsRef.current.length > 0 ? selectedTagsRef.current : undefined
      )
      .then((entries) => {
        if (controller.signal.aborted) return;
        // Entries come back in any order — sort ascending so oldest is first
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
        setPages(sorted);
        oldestFromRef.current = from;

        // Stop if no filled items — nothing older to show
        const hasFilled = sorted.some((e) => e.items.some((i) => i.filled && i.value));
        if (!hasFilled) {
          setHasMore(false);
          return;
        }

        // Can we still go further back?
        const daysBack = Math.round(
          (new Date(anchor).getTime() - new Date(from).getTime()) / 86_400_000
        );
        setHasMore(daysBack < MAX_DAYS_BACK);
      })
      .catch((err) => {
        if (isCanceledError(err) || controller.signal.aborted) return;
        setError(
          err instanceof DueKeysError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load due keys."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, anchor, initialFrom, tagsKey, reloadKey]);

  // ── Load-more (scroll-to-top) ─────────────────────────────────────
  const lastLoadMoreRef = useRef<number>(0);

  const loadMore = useCallback(() => {
    if (!storeId || isLoadingMore || !hasMore || oldestFromRef.current === null) return;

    // Throttle: wait LOAD_MORE_THROTTLE_MS between requests
    const now = Date.now();
    const waitMs = Math.max(0, LOAD_MORE_THROTTLE_MS - (now - lastLoadMoreRef.current));

    // The next batch ends one day before our current oldest `from`
    const nextTo = subtractDays(oldestFromRef.current, 1);
    const nextFrom = subtractDays(nextTo, BATCH_DAYS - 1);

    // Check how far back we've gone
    const totalDaysBack = Math.round(
      (new Date(anchor).getTime() - new Date(nextFrom).getTime()) / 86_400_000
    );
    if (totalDaysBack > MAX_DAYS_BACK) {
      setHasMore(false);
      return;
    }

    setIsLoadingMore(true);

    const doFetch = () => {
      lastLoadMoreRef.current = Date.now();

      dueKeysService
        .getDueRange(
          storeId,
          nextFrom,
          nextTo,
          undefined,
          selectedTagsRef.current.length > 0 ? selectedTagsRef.current : undefined
        )
        .then((entries) => {
          const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
          setPages((prev) => [...sorted, ...prev]);
          oldestFromRef.current = nextFrom;

          // Stop if this batch has no filled items — end of history
          const hasFilled = sorted.some((e) => e.items.some((i) => i.filled && i.value));
          if (!hasFilled) {
            setHasMore(false);
            return;
          }

          const newTotal = Math.round(
            (new Date(anchor).getTime() - new Date(nextFrom).getTime()) / 86_400_000
          );
          setHasMore(newTotal < MAX_DAYS_BACK);
        })
        .catch((err) => {
          if (isCanceledError(err)) return;
          setError(
            err instanceof DueKeysError
              ? err.message
              : err instanceof Error
              ? err.message
              : "Failed to load older entries."
          );
        })
        .finally(() => setIsLoadingMore(false));
    };

    if (waitMs > 0) {
      setTimeout(doFetch, waitMs);
    } else {
      doFetch();
    }
  }, [storeId, anchor, isLoadingMore, hasMore]);

  return { pages, isLoading, isLoadingMore, hasMore, error, loadMore, reload };
}