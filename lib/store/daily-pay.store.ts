import { create } from "zustand";
import {
  dailyPayService,
  DailyPayError,
} from "@/lib/api/services/daily-pay.service";
import type {
  DailyPayListResponse,
  DailyPayFilters,
  DailyPayErrorState,
} from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  State shape                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface DailyPayState {
  data: DailyPayListResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: DailyPayErrorState | null;
  currentPage: number;
  filters: DailyPayFilters;

  fetchEntries: (filters?: DailyPayFilters, page?: number) => Promise<void>;
  goToPage: (page: number) => void;
  setFilters: (filters: DailyPayFilters) => void;
  clearError: () => void;
  reset: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal abort controller                                               */
/* ────────────────────────────────────────────────────────────────────────── */

let _abortController: AbortController | null = null;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useDailyPayStore = create<DailyPayState>()((set, get) => ({
  data: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  currentPage: 1,
  filters: {},

  fetchEntries: async (filters?: DailyPayFilters, page = 1) => {
    // Cancel any in-flight request
    if (_abortController) _abortController.abort();
    const controller = new AbortController();
    _abortController = controller;

    const hasExistingData = get().data !== null;
    const mergedFilters = { ...(filters ?? get().filters), page };

    set({
      isLoading: !hasExistingData,
      isRefreshing: hasExistingData,
      error: null,
      currentPage: page,
      ...(filters !== undefined && { filters }),
    });

    try {
      const result = await dailyPayService.listEntries(mergedFilters, controller.signal);

      if (controller.signal.aborted || _abortController !== controller) return;

      set({ data: result, isLoading: false, isRefreshing: false });
    } catch (err) {
      if (controller.signal.aborted || _abortController !== controller) return;
      // Silently drop cancelled requests — not a user-visible error.
      if (err instanceof DailyPayError && err.code === "CANCELLED") return;

      const errorState: DailyPayErrorState =
        err instanceof DailyPayError
          ? { message: err.message, code: err.code, retryable: err.retryable }
          : { message: "An unexpected error occurred.", code: "UNKNOWN", retryable: false };
      set({ error: errorState, isLoading: false, isRefreshing: false });
    }
  },

  goToPage: (page: number) => {
    const { filters, fetchEntries } = get();
    fetchEntries(filters, page);
  },

  setFilters: (filters: DailyPayFilters) => {
    const { fetchEntries } = get();
    set({ filters });
    fetchEntries(filters, 1);
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (_abortController) _abortController.abort();
    set({
      data: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      currentPage: 1,
      filters: {},
    });
  },
}));
