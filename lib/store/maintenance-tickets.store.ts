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

  /**
   * The same figures, over the store's WHOLE set -- deliberately not narrowed
   * by whatever is currently filtered.
   *
   * The attention chips are a map you navigate by, so their numbers have to
   * hold still. Reading them off `analytics` meant pressing one chip rescoped
   * the counts feeding all the others, and they read 0 -- which looks like
   * "there is nothing waiting" when it means "nothing waiting ALSO matches the
   * filter you just applied".
   *
   * Scoped by store and by the search box only. A search is the user narrowing
   * what they are looking at on purpose; a chip is them asking a question about
   * the whole set.
   */
  baseAnalytics: TicketsAnalytics | null;
  baseAnalyticsLoading: boolean;

  fetchTickets: (storeId?: string, filters?: TicketsFilters, page?: number) => Promise<void>;
  fetchAnalytics: (storeId?: string, filters?: TicketsFilters) => Promise<void>;
  fetchBaseAnalytics: (storeId?: string) => Promise<void>;
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
// And a third, because the base counts are a SECOND analytics request. Sharing
// the one above would mean each call aborted the other and whichever lost the
// race would silently never arrive.
let _baseAnalyticsAbortController: AbortController | null = null;

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
    baseAnalytics: null,
    baseAnalyticsLoading: false,

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

    /**
     * The chips' stable numbers.
     *
     * Same endpoint, but sent WITHOUT the filter set -- only the store scope and
     * the search box. Its own abort controller and its own slot, so it and the
     * scoped request cannot cancel or overwrite each other.
     *
     * No error slot on purpose: if this fails the chips render an em dash and
     * the page carries on. It is a navigation aid, not the content.
     */
    fetchBaseAnalytics: async (storeId?: string) => {
      if (_baseAnalyticsAbortController) _baseAnalyticsAbortController.abort();
      const controller = new AbortController();
      _baseAnalyticsAbortController = controller;

      const mode = get().mode;
      if (mode === "store" && !storeId) {
        set({ baseAnalytics: null, baseAnalyticsLoading: false });
        return;
      }

      const scopedStoreIds = get().scopedStoreIds;
      const q = get().filters.q;
      const baseFilters: TicketsFilters = {
        ...(q ? { q } : {}),
        ...(mode === "global" && scopedStoreIds?.length ? { stores: scopedStoreIds } : {}),
      };

      set({ baseAnalyticsLoading: true });

      try {
        const result =
          mode === "global"
            ? await maintenanceTicketsService.getGlobalTicketsAnalytics(baseFilters, controller.signal)
            : await maintenanceTicketsService.getTicketsAnalytics(
                storeId as string,
                baseFilters,
                controller.signal
              );

        if (controller.signal.aborted || _baseAnalyticsAbortController !== controller) return;

        set({ baseAnalytics: result, baseAnalyticsLoading: false });
      } catch {
        if (controller.signal.aborted || _baseAnalyticsAbortController !== controller) return;
        set({ baseAnalyticsLoading: false });
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
      const { mode, lastStoreId, fetchTickets, fetchAnalytics, fetchBaseAnalytics } = get();
      // The base counts are scoped by the search box and nothing else, so they
      // only need refetching when THAT changed. A chip press must not move them
      // -- that is the whole point of keeping them in a separate slot.
      const searchChanged = (get().filters.q ?? "") !== (filters.q ?? "");

      set({ filters });

      if (mode === "global") {
        fetchTickets(undefined, filters, 1);
        fetchAnalytics(undefined, filters);
        if (searchChanged) fetchBaseAnalytics(undefined);
      } else if (lastStoreId) {
        fetchTickets(lastStoreId, filters, 1);
        fetchAnalytics(lastStoreId, filters);
        if (searchChanged) fetchBaseAnalytics(lastStoreId);
      }
    },

    clearError: () => set({ error: null }),

    reset: () => {
      if (_abortController) _abortController.abort();
      if (_analyticsAbortController) _analyticsAbortController.abort();
      if (_baseAnalyticsAbortController) _baseAnalyticsAbortController.abort();
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
        baseAnalytics: null,
        baseAnalyticsLoading: false,
        analyticsLoading: false,
        analyticsError: null,
      });
    },
  })
);
