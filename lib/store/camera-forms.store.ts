import { create } from "zustand";
import {
  qaService,
  QAError,
  type QAErrorCode,
} from "@/lib/api/services/qa.service";
import type {
  CameraFormsListResponse,
  CameraFormsFilterParams,
} from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface CameraFormsErrorState {
  message: string;
  code: QAErrorCode;
  retryable: boolean;
  retryAfter?: number;
}

interface CameraFormsState {
  // Daily tab
  dailyData: CameraFormsListResponse | null;
  dailyPage: number;
  dailyLoading: boolean;
  dailyRefreshing: boolean;
  dailyError: CameraFormsErrorState | null;

  // Weekly tab
  weeklyData: CameraFormsListResponse | null;
  weeklyPage: number;
  weeklyLoading: boolean;
  weeklyRefreshing: boolean;
  weeklyError: CameraFormsErrorState | null;

  // Shared filters
  filters: {
    dateFrom: string;
    dateTo: string;
    storeId: number | undefined;
  };

  // Deleting state
  isDeleting: boolean;
  deleteError: CameraFormsErrorState | null;

  // Actions
  fetchDaily: (page?: number) => Promise<void>;
  fetchWeekly: (page?: number) => Promise<void>;
  deleteCameraForm: (id: number, storeId?: string) => Promise<void>;
  setDailyPage: (page: number) => void;
  setWeeklyPage: (page: number) => void;
  setFilters: (filters: Partial<CameraFormsState["filters"]>) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  clearDailyError: () => void;
  clearWeeklyError: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal state                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

let _dailyAbortController: AbortController | null = null;
let _weeklyAbortController: AbortController | null = null;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useCameraFormsStore = create<CameraFormsState>()((set, get) => ({
  dailyData: null,
  dailyPage: 1,
  dailyLoading: false,
  dailyRefreshing: false,
  dailyError: null,

  weeklyData: null,
  weeklyPage: 1,
  weeklyLoading: false,
  weeklyRefreshing: false,
  weeklyError: null,

  filters: {
    dateFrom: "",
    dateTo: "",
    storeId: undefined,
  },

  fetchDaily: async (page: number = 1) => {
    const state = get();

    // Cancel any in-flight daily request
    if (_dailyAbortController) {
      _dailyAbortController.abort();
    }
    _dailyAbortController = new AbortController();

    const hasExistingData = state.dailyData !== null;
    set({
      dailyLoading: !hasExistingData,
      dailyRefreshing: hasExistingData,
      dailyError: null,
    });

    try {
      const params: CameraFormsFilterParams = {
        page,
        dateRangeType: "daily",
      };
      if (state.filters.dateFrom) params.dateFrom = state.filters.dateFrom;
      if (state.filters.dateTo) params.dateTo = state.filters.dateTo;
      if (state.filters.storeId) params.storeId = state.filters.storeId;

      const data = await qaService.getCameraForms(
        params,
        _dailyAbortController?.signal
      );

      set({
        dailyData: data,
        dailyLoading: false,
        dailyRefreshing: false,
        dailyError: null,
        dailyPage: page,
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
                : "Failed to load camera forms.",
              "UNKNOWN"
            );

      set({
        dailyLoading: false,
        dailyRefreshing: false,
        dailyError: {
          message: qaErr.message,
          code: qaErr.code,
          retryable: qaErr.retryable,
          retryAfter: qaErr.retryAfter,
        },
      });
    }
  },

  fetchWeekly: async (page: number = 1) => {
    const state = get();

    // Cancel any in-flight weekly request
    if (_weeklyAbortController) {
      _weeklyAbortController.abort();
    }
    _weeklyAbortController = new AbortController();

    const hasExistingData = state.weeklyData !== null;
    set({
      weeklyLoading: !hasExistingData,
      weeklyRefreshing: hasExistingData,
      weeklyError: null,
    });

    try {
      const params: CameraFormsFilterParams = {
        page,
        dateRangeType: "weekly",
      };
      if (state.filters.dateFrom) params.dateFrom = state.filters.dateFrom;
      if (state.filters.dateTo) params.dateTo = state.filters.dateTo;
      if (state.filters.storeId) params.storeId = state.filters.storeId;

      const data = await qaService.getCameraForms(
        params,
        _weeklyAbortController?.signal
      );

      set({
        weeklyData: data,
        weeklyLoading: false,
        weeklyRefreshing: false,
        weeklyError: null,
        weeklyPage: page,
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
                : "Failed to load camera forms.",
              "UNKNOWN"
            );

      set({
        weeklyLoading: false,
        weeklyRefreshing: false,
        weeklyError: {
          message: qaErr.message,
          code: qaErr.code,
          retryable: qaErr.retryable,
          retryAfter: qaErr.retryAfter,
        },
      });
    }
  },

  setDailyPage: (page: number) => {
    get().fetchDaily(page);
  },

  setWeeklyPage: (page: number) => {
    get().fetchWeekly(page);
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  applyFilters: () => {
    const { fetchDaily, fetchWeekly } = get();
    set({ dailyPage: 1, weeklyPage: 1 });
    fetchDaily(1);
    fetchWeekly(1);
  },

  resetFilters: () => {
    set({
      filters: { dateFrom: "", dateTo: "", storeId: undefined },
      dailyPage: 1,
      weeklyPage: 1,
    });
    const { fetchDaily, fetchWeekly } = get();
    // Small delay to let state update
    setTimeout(() => {
      fetchDaily(1);
      fetchWeekly(1);
    }, 0);
  },

  clearDailyError: () => set({ dailyError: null }),
  clearWeeklyError: () => set({ weeklyError: null }),

  isDeleting: false,
  deleteError: null,

  deleteCameraForm: async (id: number, storeId?: string) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await qaService.deleteCameraForm(id, storeId);
      set({ isDeleting: false });
      // Refetch both tabs
      const { dailyPage, weeklyPage, fetchDaily, fetchWeekly } = get();
      fetchDaily(dailyPage);
      fetchWeekly(weeklyPage);
    } catch (err: unknown) {
      const qaErr =
        err instanceof QAError
          ? err
          : new QAError(
              err instanceof Error ? err.message : "Failed to delete camera form.",
              "UNKNOWN"
            );
      set({
        isDeleting: false,
        deleteError: {
          message: qaErr.message,
          code: qaErr.code,
          retryable: qaErr.retryable,
          retryAfter: qaErr.retryAfter,
        },
      });
      throw err;
    }
  },
}));
