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
  filters: TicketsFilters;
  lastStoreId: string | null;

  fetchTickets: (storeId: string, filters?: TicketsFilters, page?: number) => Promise<void>;
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
    filters: {},
    lastStoreId: null,

    fetchTickets: async (storeId: string, filters?: TicketsFilters, page = 1) => {
      // Cancel any in-flight request
      if (_abortController) _abortController.abort();
      _abortController = new AbortController();

      const hasExistingData = get().data !== null;
      const mergedFilters = { ...(filters ?? get().filters), page };

      set({
        isLoading: !hasExistingData,
        isRefreshing: hasExistingData,
        error: null,
        currentPage: page,
        lastStoreId: storeId,
        ...(filters !== undefined && { filters }),
      });

      try {
        const result = await maintenanceTicketsService.getTickets(
          storeId,
          mergedFilters,
          _abortController.signal
        );

        if (_abortController.signal.aborted) return;

        set({ data: result, isLoading: false, isRefreshing: false });
      } catch (err) {
        if (_abortController.signal.aborted) return;

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

    goToPage: (page: number) => {
      const { lastStoreId, filters, fetchTickets } = get();
      if (lastStoreId) {
        fetchTickets(lastStoreId, filters, page);
      }
    },

    setFilters: (filters: TicketsFilters) => {
      const { lastStoreId, fetchTickets } = get();
      set({ filters });
      if (lastStoreId) {
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
        filters: {},
        lastStoreId: null,
      });
    },
  })
);
