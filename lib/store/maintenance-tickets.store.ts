import { create } from "zustand";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
  type TicketsErrorCode,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  TicketsListResponse,
  TicketsFilters,
  TicketsErrorState,
  TicketsAnalytics,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  State shape                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface MaintenanceTicketsState {
  data: TicketsListResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: TicketsErrorState | null;
  currentPage: number;
  mode: "store" | "global";
  filters: TicketsFilters;
  lastStoreId: string | null;
  /** Global-index scoping: restricts a "global" fetch to these store numbers (stores[]). Null = unrestricted. */
  scopedStoreIds: string[] | null;

  analytics: TicketsAnalytics | null;
  analyticsLoading: boolean;
  analyticsError: TicketsErrorState | null;

  fetchTickets: (storeId?: string, filters?: TicketsFilters, page?: number) => Promise<void>;
  fetchAnalytics: (storeId?: string, filters?: TicketsFilters) => Promise<void>;
  setMode: (mode: "store" | "global") => void;
  setScopedStoreIds: (ids: string[] | null) => void;
  goToPage: (page: number) => void;
  setFilters: (filters: TicketsFilters) => void;
  clearError: () => void;
  reset: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal abort controllers                                              */
/* ────────────────────────────────────────────────────────────────────────── */

let _abortController: AbortController | null = null;
// Separate controller so pagination (which only touches fetchTickets) never
// cancels an in-flight analytics request, and vice versa.
let _analyticsAbortController: AbortController | null = null;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useMaintenanceTicketsStore = create<MaintenanceTicketsState>()(
  (set, get) => ({
    data: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    currentPage: 1,
    mode: "store",
    filters: {},
    lastStoreId: null,
    scopedStoreIds: null,

    analytics: null,
    analyticsLoading: false,
    analyticsError: null,

    fetchTickets: async (storeId?: string, filters?: TicketsFilters, page = 1) => {
      // Cancel any in-flight request
      if (_abortController) _abortController.abort();
      const controller = new AbortController();
      _abortController = controller;

      const mode = get().mode;
      if (mode === "store" && !storeId) {
        set({
          data: null,
          isLoading: false,
          isRefreshing: false,
          error: null,
          currentPage: 1,
          lastStoreId: null,
        });
        return;
      }

      const hasExistingData = get().data !== null;
      const scopedStoreIds = get().scopedStoreIds;
      const mergedFilters = {
        ...(filters ?? get().filters),
        page,
        ...(mode === "global" && scopedStoreIds?.length ? { stores: scopedStoreIds } : {}),
      };

      set({
        isLoading: !hasExistingData,
        isRefreshing: hasExistingData,
        error: null,
        currentPage: page,
        lastStoreId: storeId ?? null,
        ...(filters !== undefined && { filters }),
      });

      try {
        const result =
          mode === "global"
            ? await maintenanceTicketsService.getGlobalTickets(mergedFilters, controller.signal)
            : await maintenanceTicketsService.getTickets(
                storeId as string,
                mergedFilters,
                controller.signal
              );

        if (controller.signal.aborted || _abortController !== controller) return;

        set({ data: result, isLoading: false, isRefreshing: false });
      } catch (err) {
        if (controller.signal.aborted || _abortController !== controller) return;

        let errorState: TicketsErrorState;
        if (err instanceof MaintenanceTicketsError) {
          errorState = {
            message: err.message,
            code: err.code,
            retryable: err.retryable,
          };
        } else {
          errorState = {
            message: "An unexpected error occurred.",
            code: "UNKNOWN",
            retryable: false,
          };
        }
        set({ error: errorState, isLoading: false, isRefreshing: false });
      }
    },

    fetchAnalytics: async (storeId?: string, filters?: TicketsFilters) => {
      // Cancel any in-flight analytics request — independent of the list-fetch controller.
      if (_analyticsAbortController) _analyticsAbortController.abort();
      const controller = new AbortController();
      _analyticsAbortController = controller;

      const mode = get().mode;
      if (mode === "store" && !storeId) {
        set({ analytics: null, analyticsLoading: false, analyticsError: null });
        return;
      }

      const scopedStoreIds = get().scopedStoreIds;
      // Analytics is unpaginated — strip page/per_page so they're never sent upstream.
      const { page: _page, per_page: _perPage, ...baseFilters } = filters ?? get().filters;
      const mergedFilters = {
        ...baseFilters,
        ...(mode === "global" && scopedStoreIds?.length ? { stores: scopedStoreIds } : {}),
      };

      set({ analyticsLoading: true, analyticsError: null });

      try {
        const result =
          mode === "global"
            ? await maintenanceTicketsService.getGlobalTicketsAnalytics(mergedFilters, controller.signal)
            : await maintenanceTicketsService.getTicketsAnalytics(
                storeId as string,
                mergedFilters,
                controller.signal
              );

        if (controller.signal.aborted || _analyticsAbortController !== controller) return;

        set({ analytics: result, analyticsLoading: false });
      } catch (err) {
        if (controller.signal.aborted || _analyticsAbortController !== controller) return;

        let errorState: TicketsErrorState;
        if (err instanceof MaintenanceTicketsError) {
          errorState = {
            message: err.message,
            code: err.code,
            retryable: err.retryable,
          };
        } else {
          errorState = {
            message: "An unexpected error occurred.",
            code: "UNKNOWN",
            retryable: false,
          };
        }
        set({ analyticsError: errorState, analyticsLoading: false });
      }
    },

    setMode: (mode: "store" | "global") => {
      const { lastStoreId, filters, fetchTickets, fetchAnalytics } = get();
      set({ mode, currentPage: 1, error: null });
      if (mode === "global") {
        fetchTickets(undefined, filters, 1);
        fetchAnalytics(undefined, filters);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, 1);
        fetchAnalytics(lastStoreId, filters);
      } else {
        set({ data: null, isLoading: false, isRefreshing: false });
      }
    },

    setScopedStoreIds: (ids: string[] | null) => {
      set({ scopedStoreIds: ids });
    },

    goToPage: (page: number) => {
      const { mode, lastStoreId, filters, fetchTickets } = get();
      if (mode === "global") {
        fetchTickets(undefined, filters, page);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, page);
      }
    },

    setFilters: (filters: TicketsFilters) => {
      const { mode, lastStoreId, fetchTickets, fetchAnalytics } = get();
      set({ filters });
      if (mode === "global") {
        fetchTickets(undefined, filters, 1);
        fetchAnalytics(undefined, filters);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, 1);
        fetchAnalytics(lastStoreId, filters);
      }
    },

    clearError: () => set({ error: null }),

    reset: () => {
      if (_abortController) _abortController.abort();
      if (_analyticsAbortController) _analyticsAbortController.abort();
      set({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        currentPage: 1,
        mode: "store",
        filters: {},
        lastStoreId: null,
        scopedStoreIds: null,
        analytics: null,
        analyticsLoading: false,
        analyticsError: null,
      });
    },
  })
);
