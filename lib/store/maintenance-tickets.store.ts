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

  fetchTickets: (storeId?: string, filters?: TicketsFilters, page?: number) => Promise<void>;
  setMode: (mode: "store" | "global") => void;
  goToPage: (page: number) => void;
  setFilters: (filters: TicketsFilters) => void;
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
      const mergedFilters = { ...(filters ?? get().filters), page };

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

    setMode: (mode: "store" | "global") => {
      const { lastStoreId, filters, fetchTickets } = get();
      set({ mode, currentPage: 1, error: null });
      if (mode === "global") {
        fetchTickets(undefined, filters, 1);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, 1);
      } else {
        set({ data: null, isLoading: false, isRefreshing: false });
      }
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
      const { mode, lastStoreId, fetchTickets } = get();
      set({ filters });
      if (mode === "global") {
        fetchTickets(undefined, filters, 1);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, 1);
      }
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
        mode: "store",
        filters: {},
        lastStoreId: null,
      });
    },
  })
);
