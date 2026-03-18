import { create } from "zustand";
import {
  qaService,
  QAError,
  type QAErrorCode,
} from "@/lib/api/services/qa.service";
import type { CameraReportData } from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const STALE_AFTER_MS = 2 * 60 * 1000;
const AUTO_REFRESH_MS = 3 * 60 * 1000;
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CameraReportFilterParams {
  store_id?: number;
  group?: number;
  report_type?: string;
  date_from?: string;
  date_to?: string;
  rating_id?: number;
  category_ids?: number[];
  date_range_type?: "daily" | "weekly";
}

interface CameraReportErrorState {
  message: string;
  code: QAErrorCode;
  retryable: boolean;
  retryAfter?: number;
}

interface CameraReportState {
  data: CameraReportData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: CameraReportErrorState | null;
  filters: CameraReportFilterParams;
  isExporting: boolean;
  isExportingExcel: boolean;
  isExportingImages: boolean;
  lastFetchedAt: number | null;
  fetchCount: number;

  fetchReport: (params?: CameraReportFilterParams) => Promise<void>;
  refreshReport: () => Promise<void>;
  setFilters: (filters: CameraReportFilterParams) => void;
  exportReport: () => Promise<void>;
  exportReportExcel: () => Promise<void>;
  exportReportImages: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isStale: () => boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal state                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

let _autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let _abortController: AbortController | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Gets the date range for the current week starting from Tuesday to Monday.
 */
function getThisWeekRange(): { date_from: string; date_to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) to 6 (Sat)

  // Target: Tuesday (2)
  // If today is Tue, Wed, Thu, Fri, Sat, Sun, Mon
  // We want the most recent Tuesday.
  // Day of week mapping: Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6
  
  // Calculate days to subtract to get to last Tuesday
  // (day - 2 + 7) % 7
  const daysSinceTuesday = (day - 2 + 7) % 7;
  
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - daysSinceTuesday);
  tuesday.setHours(0, 0, 0, 0);

  const monday = new Date(tuesday);
  monday.setDate(tuesday.getDate() + 6);
  monday.setHours(23, 59, 59, 999);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayOfMonth}`;
  };

  return {
    date_from: formatDate(tuesday),
    date_to: formatDate(monday),
  };
}

/** Strip empty/null/undefined values from filters */
function cleanParams(
  raw: CameraReportFilterParams
): CameraReportFilterParams {
  const out: CameraReportFilterParams = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      (out as Record<string, unknown>)[key] = value;
      continue;
    }

    if (value !== undefined && value !== "" && value !== null) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useCameraReportStore = create<CameraReportState>()(
  (set, get) => ({
    data: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    filters: getThisWeekRange(),
    isExporting: false,
    isExportingExcel: false,
    isExportingImages: false,
    lastFetchedAt: null,
    fetchCount: 0,

    fetchReport: async (params?: CameraReportFilterParams) => {
      const state = get();

      if (params !== undefined) {
        set({ filters: params });
      }

      const activeFilters = params !== undefined ? params : state.filters;

      // Cancel any in-flight request
      if (_abortController) _abortController.abort();
      _abortController = new AbortController();

      const hasExistingData = state.data !== null;
      set({
        isLoading: !hasExistingData,
        isRefreshing: hasExistingData,
        error: null,
      });

      _retryCount = 0;
      const clean = cleanParams(activeFilters);

      const performFetch = async (): Promise<void> => {
        try {
          const data = await qaService.getCameraReport(
            Object.keys(clean).length > 0 ? clean : undefined,
            _abortController?.signal
          );

          set({
            data,
            isLoading: false,
            isRefreshing: false,
            error: null,
            lastFetchedAt: Date.now(),
            fetchCount: get().fetchCount + 1,
          });
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err.name === "CanceledError" || err.name === "AbortError")
          ) {
            return;
          }

          if (err instanceof QAError) {
            if (err.retryable && _retryCount < MAX_AUTO_RETRIES) {
              _retryCount++;
              _retryTimer = setTimeout(performFetch, RETRY_DELAY_MS);
              return;
            }

            set({
              isLoading: false,
              isRefreshing: false,
              error: {
                message: err.message,
                code: err.code,
                retryable: err.retryable,
                retryAfter: err.retryAfter,
              },
            });
            return;
          }

          set({
            isLoading: false,
            isRefreshing: false,
            error: {
              message:
                err instanceof Error
                  ? err.message
                  : "An unexpected error occurred.",
              code: "UNKNOWN",
              retryable: true,
            },
          });
        }
      };

      await performFetch();
    },

    refreshReport: async () => {
      const state = get();
      if (state.isLoading || state.isRefreshing) return;
      await get().fetchReport(state.filters);
    },

    setFilters: (filters: CameraReportFilterParams) => {
      set({ filters });
    },

    exportReport: async () => {
      const state = get();
      if (state.isExporting) return;

      set({ isExporting: true });

      const clean = cleanParams(state.filters);

      try {
        await qaService.exportCameraReport(
          Object.keys(clean).length > 0 ? clean : undefined
        );
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === "CanceledError" || err.name === "AbortError")
        ) {
          set({ isExporting: false });
          return;
        }

        if (err instanceof QAError) {
          set({
            isExporting: false,
            error: {
              message: err.message,
              code: err.code,
              retryable: err.retryable,
              retryAfter: err.retryAfter,
            },
          });
          return;
        }

        set({
          isExporting: false,
          error: {
            message:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred during export.",
            code: "UNKNOWN",
            retryable: true,
          },
        });
        return;
      }

      set({ isExporting: false });
    },

    exportReportExcel: async () => {
      const state = get();
      if (state.isExportingExcel) return;

      set({ isExportingExcel: true });

      const clean = cleanParams(state.filters);

      try {
        await qaService.exportCameraReportExcel(
          Object.keys(clean).length > 0 ? clean : undefined
        );
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === "CanceledError" || err.name === "AbortError")
        ) {
          set({ isExportingExcel: false });
          return;
        }

        if (err instanceof QAError) {
          set({
            isExportingExcel: false,
            error: {
              message: err.message,
              code: err.code,
              retryable: err.retryable,
              retryAfter: err.retryAfter,
            },
          });
          return;
        }

        set({
          isExportingExcel: false,
          error: {
            message:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred during export.",
            code: "UNKNOWN",
            retryable: true,
          },
        });
        return;
      }

      set({ isExportingExcel: false });
    },

    exportReportImages: async () => {
      const state = get();
      if (state.isExportingImages) return;

      set({ isExportingImages: true });

      const clean = cleanParams(state.filters);

      try {
        await qaService.exportCameraReportImages(
          Object.keys(clean).length > 0 ? clean : undefined
        );
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === "CanceledError" || err.name === "AbortError")
        ) {
          set({ isExportingImages: false });
          return;
        }

        if (err instanceof QAError) {
          set({
            isExportingImages: false,
            error: {
              message: err.message,
              code: err.code,
              retryable: err.retryable,
              retryAfter: err.retryAfter,
            },
          });
          return;
        }

        set({
          isExportingImages: false,
          error: {
            message:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred during export.",
            code: "UNKNOWN",
            retryable: true,
          },
        });
        return;
      }

      set({ isExportingImages: false });
    },

    clearError: () => set({ error: null }),

    reset: () => {
      if (_abortController) _abortController.abort();
      if (_retryTimer) clearTimeout(_retryTimer);
      if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
      _abortController = null;
      _retryTimer = null;
      _autoRefreshTimer = null;
      _retryCount = 0;

      set({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        filters: {},
        isExporting: false,
        isExportingExcel: false,
        isExportingImages: false,
        lastFetchedAt: null,
        fetchCount: 0,
      });
    },

    startAutoRefresh: () => {
      if (_autoRefreshTimer) return;
      _autoRefreshTimer = setInterval(() => {
        const state = get();
        if (!state.isLoading && !state.isRefreshing && state.data) {
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

    isStale: () => {
      const { lastFetchedAt } = get();
      if (!lastFetchedAt) return true;
      return Date.now() - lastFetchedAt > STALE_AFTER_MS;
    },
  })
);
