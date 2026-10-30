"use client";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The read / write state every maintenance v2 hook is built from           */
/*                                                                            */
/*  useMaintenanceResource(key, fetcher): loads when `key` changes (null =   */
/*  don't load), cancels the request in flight so a fast filter change can  */
/*  never paint an older answer over a newer one, and keeps the last data   */
/*  while refreshing (isRefreshing) so lists don't flash empty.             */
/*                                                                            */
/*  useMaintenanceMutation(fn): pending + error for one write, so dialogs   */
/*  can disable their button, show a spinner and map a 422 onto fields.     */
/*                                                                            */
/*  Plain React state on purpose: none of this is shared between screens.   */
/*  (CLAUDE.md: Zustand only where state is shared.)                        */
/* ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";

export interface ResourceState<T> {
  data: T | null;
  /** First load, nothing to show yet. */
  isLoading: boolean;
  /** Reloading with data already on screen. */
  isRefreshing: boolean;
  error: MaintenanceTicketsError | null;
  /** Reload with the same key. */
  refresh: () => Promise<void>;
  /** Replace the data in place (e.g. with what a write returned). */
  setData: (next: T | null | ((prev: T | null) => T | null)) => void;
}

function asError(err: unknown): MaintenanceTicketsError {
  return err instanceof MaintenanceTicketsError
    ? err
    : new MaintenanceTicketsError(err instanceof Error ? err.message : "Something went wrong.", "UNKNOWN");
}

/**
 * `key` must change whenever the request would (stringify the filters);
 * `fetcher` may be a fresh closure every render — only the latest is used.
 */
export function useMaintenanceResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(key !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<MaintenanceTicketsError | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (hasDataRef.current) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const next = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted) return;
      hasDataRef.current = true;
      setData(next);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      const e = asError(err);
      if (e.code !== "CANCELLED") setError(e);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (key === null) {
      abortRef.current?.abort();
      hasDataRef.current = false;
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    void load();
  }, [key, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const refresh = useCallback(async () => {
    if (key !== null) await load();
  }, [key, load]);

  return { data, isLoading, isRefreshing, error, refresh, setData };
}

export interface MutationState<A extends unknown[], R> {
  /** Runs the write; resolves with its result, or rethrows (the error is also kept in `error`). */
  run: (...args: A) => Promise<R>;
  isPending: boolean;
  error: MaintenanceTicketsError | null;
  reset: () => void;
}

export function useMaintenanceMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>): MutationState<A, R> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<MaintenanceTicketsError | null>(null);

  const run = useCallback(async (...args: A) => {
    setIsPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      const e = asError(err);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);
  return { run, isPending, error, reset };
}

/** A stable key for a filters object (undefined keys dropped, order-insensitive). */
export function keyOf(prefix: string, params?: object | null): string {
  if (!params) return prefix;
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `${prefix}:${JSON.stringify(entries)}`;
}
