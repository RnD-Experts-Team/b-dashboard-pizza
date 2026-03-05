import { create } from "zustand";
import {
  qaService,
  QAError,
  type QAErrorCode,
} from "@/lib/api/services/qa.service";
import type { QAAuditsResponse } from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Data is considered fresh for 2 minutes */
const STALE_AFTER_MS = 2 * 60 * 1000;

/** Max retries for retryable errors (client-level) */
const MAX_AUTO_RETRIES = 2;

/** Delay between auto-retries */
const RETRY_DELAY_MS = 3_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface QAErrorState {
  message: string;
  code: QAErrorCode;
  retryable: boolean;
  retryAfter?: number;
}

interface QAState {
  // Data
  data: QAAuditsResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: QAErrorState | null;

  // Pagination
  currentPage: number;

  // Metadata
  lastFetchedAt: number | null;
  fetchCount: number;

  // Actions
  fetchAudits: (page?: number) => Promise<void>;
  refreshAudits: () => Promise<void>;
  goToPage: (page: number) => void;
  clearError: () => void;
  reset: () => void;

  // Smart refresh
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isStale: () => boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal state                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

let _abortController: AbortController | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useQAStore = create<QAState>()((set, get) => ({
  data: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  currentPage: 1,
  lastFetchedAt: null,
  fetchCount: 0,

  fetchAudits: async (page: number = 1) => {
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
        const data = await qaService.getAudits(
          page,
          _abortController?.signal
        );

        set({
          data,
          isLoading: false,
          isRefreshing: false,
          error: null,
          currentPage: page,
          lastFetchedAt: Date.now(),
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

        const qaErr =
          err instanceof QAError
            ? err
            : new QAError(
                err instanceof Error
                  ? err.message
                  : "Failed to load QA audits.",
                "UNKNOWN"
              );

        // Auto-retry for retryable errors (exclude auth errors)
        const isAuthError =
          qaErr.code === "UNAUTHORIZED" ||
          qaErr.code === "NOT_AUTHENTICATED" ||
          qaErr.code === "FORBIDDEN";
        if (
          qaErr.retryable &&
          !isAuthError &&
          _retryCount < MAX_AUTO_RETRIES
        ) {
          _retryCount++;
          await new Promise<void>((resolve) => {
            _retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
            _abortController?.signal.addEventListener(
              "abort",
              () => {
                if (_retryTimer) {
                  clearTimeout(_retryTimer);
                  _retryTimer = null;
                }
                resolve();
              },
              { once: true }
            );
          });
          if (_abortController?.signal.aborted) return;
          _retryTimer = null;
          return performFetch();
        }

        set({
          isLoading: false,
          isRefreshing: false,
          error: {
            message: qaErr.message,
            code: qaErr.code,
            retryable: qaErr.retryable,
            retryAfter: qaErr.retryAfter,
          },
          // Keep stale data on refresh failures
          ...(hasExistingData ? {} : { data: null }),
        });
      }
    };

    await performFetch();
  },

  refreshAudits: async () => {
    const { currentPage, fetchAudits } = get();
    await fetchAudits(currentPage);
  },

  goToPage: (page: number) => {
    const { fetchAudits } = get();
    fetchAudits(page);
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (_abortController) _abortController.abort();
    if (_retryTimer) clearTimeout(_retryTimer);
    _retryTimer = null;
    _retryCount = 0;

    set({
      data: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      currentPage: 1,
      lastFetchedAt: null,
      fetchCount: 0,
    });
  },

  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt > STALE_AFTER_MS;
  },

  startAutoRefresh: () => {
    // Auto-refresh polling intentionally disabled.
  },

  stopAutoRefresh: () => {
    // No-op: polling is disabled.
  },
}));
