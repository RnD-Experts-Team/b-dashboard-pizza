import { create } from "zustand";
import { dsprService, DsprError, type DsprErrorCode } from "@/lib/api/services/dspr.service";
import type { DsprResponse } from "@/types/dspr.types";
import type { DashboardReportExtras } from "@/types/dashboard-report.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Data is considered fresh for 2.5 hours */
const STALE_AFTER_MS = 2.5 * 60 * 60 * 1000;

/** Auto-refresh interval (2.5 hours) */
const AUTO_REFRESH_MS = 2.5 * 60 * 60 * 1000;

/** Max retries for retryable errors (client-level) */
const MAX_AUTO_RETRIES = 2;

/** Delay between auto-retries */
const RETRY_DELAY_MS = 3_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface DsprErrorState {
  message: string;
  code: DsprErrorCode;
  retryable: boolean;
  retryAfter?: number;
}

interface DsprState {
  // Data
  data: DsprResponse | null;
  wbrData: DashboardReportExtras | null;
  isLoading: boolean;
  isRefreshing: boolean; // background refresh (data already loaded)
  error: DsprErrorState | null;

  // Metadata
  lastFetchedAt: number | null; // timestamp
  lastStoreId: string | null;
  lastDate: string | null;
  fetchCount: number;

  // Actions
  fetchReport: (storeId?: string, date?: string) => Promise<void>;
  refreshReport: () => Promise<void>;
  clearError: () => void;
  reset: () => void;

  // Smart refresh
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isStale: () => boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal state (not in Zustand — avoids serialization issues)           */
/* ────────────────────────────────────────────────────────────────────────── */

let _abortController: AbortController | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;
let _autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useDsprStore = create<DsprState>()((set, get) => ({
  data: null,
  wbrData: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  lastStoreId: null,
  lastDate: null,
  fetchCount: 0,

  fetchReport: async (storeId?: string, date?: string) => {
    // console.log("[DsprStore] fetchReport called with:", { storeId, date });
    const state = get();

    // Cancel any in-flight request
    if (_abortController) {
      _abortController.abort();
    }
    _abortController = new AbortController();

    // If we already have data, show "refreshing" instead of full loading
    const hasExistingData = state.data !== null;
    set({
      isLoading: !hasExistingData,
      isRefreshing: hasExistingData,
      error: null,
    });

    _retryCount = 0;

    const performFetch = async (): Promise<void> => {
      try {
        const result = await dsprService.getReport(
          storeId,
          date,
          _abortController?.signal
        );

        // console.log("[DsprStore] Data received:", { store: result.dspr.filtering?.store, date: result.dspr.filtering?.date, cashSales: result.dspr.day?.total_cash_sales, customers: result.dspr.day?.customer_count });

        set({
          data: result.dspr,
          wbrData: result.extras,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastFetchedAt: Date.now(),
          lastStoreId: storeId ?? result.dspr.filtering?.store ?? null,
          lastDate: date ?? result.dspr.filtering?.date ?? null,
          fetchCount: get().fetchCount + 1,
        });
      } catch (err: unknown) {
        // Cancelled — ignore silently
        if (
          err instanceof Error &&
          (err.name === "CanceledError" || err.name === "AbortError")
        ) {
          return;
        }

        const dsprErr =
          err instanceof DsprError
            ? err
            : new DsprError(
                err instanceof Error ? err.message : "Failed to load report data.",
                "UNKNOWN"
              );

        //console.error("[DsprStore] Error:", { code: dsprErr.code, message: dsprErr.message, retryable: dsprErr.retryable });

        // Auto-retry for retryable errors (exclude auth errors — those need manual intervention)
        const isAuthError = dsprErr.code === "UNAUTHORIZED" || dsprErr.code === "NOT_AUTHENTICATED" || dsprErr.code === "FORBIDDEN";
        if (dsprErr.retryable && !isAuthError && _retryCount < MAX_AUTO_RETRIES) {
          _retryCount++;
          // console.warn(
          //   `🔄 DSPR: Auto-retry ${_retryCount}/${MAX_AUTO_RETRIES} in ${RETRY_DELAY_MS}ms`
          // );
          await new Promise<void>((resolve) => {
            _retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
            // Cancel the retry if the request was aborted while waiting
            _abortController?.signal.addEventListener("abort", () => {
              if (_retryTimer) {
                clearTimeout(_retryTimer);
                _retryTimer = null;
              }
              resolve();
            }, { once: true });
          });
          // If aborted during the wait, bail out
          if (_abortController?.signal.aborted) return;
          _retryTimer = null;
          return performFetch();
        }

        // console.error(`❌ DSPR Store: [${dsprErr.code}] ${dsprErr.message}`);

        set({
          isLoading: false,
          isRefreshing: false,
          error: {
            message: dsprErr.message,
            code: dsprErr.code,
            retryable: dsprErr.retryable,
            retryAfter: dsprErr.retryAfter,
          },
          // Keep stale data on refresh failures
          ...(hasExistingData ? {} : { data: null }),
        });
      }
    };

    await performFetch();
  },

  refreshReport: async () => {
    const { lastStoreId, lastDate, fetchReport } = get();
    if (lastStoreId && lastDate) {
      await fetchReport(lastStoreId, lastDate);
    }
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (_abortController) _abortController.abort();
    if (_retryTimer) clearTimeout(_retryTimer);
    _retryTimer = null;
    _retryCount = 0;

    set({
      data: null,
      wbrData: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastFetchedAt: null,
      lastStoreId: null,
      lastDate: null,
      fetchCount: 0,
    });
  },

  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt > STALE_AFTER_MS;
  },

  startAutoRefresh: () => {
    if (_autoRefreshTimer) return;
    _autoRefreshTimer = setInterval(() => {
      const { lastStoreId, isStale } = get();
      if (lastStoreId && isStale()) {
        get().refreshReport();
      }
    }, AUTO_REFRESH_MS);
  },

  stopAutoRefresh: () => {
    if (_autoRefreshTimer) {
      clearInterval(_autoRefreshTimer);
      _autoRefreshTimer = null;
    }
  },
}));
