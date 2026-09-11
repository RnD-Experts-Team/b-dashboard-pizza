import { create } from "zustand";
import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import { storageService } from "@/lib/api/services/storage.service";
import type {
  StockBalanceFilters,
  StockBalanceListResponse,
  StockMovementFilters,
  StockMovementListResponse,
  StorageErrorState,
  StorageLocationFilters,
  StorageLocationListResponse,
} from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage & Stock list state                                               */
/*                                                                            */
/*  Mirrors lib/store/maintenance-tickets.store.ts: plain create() with no    */
/*  middleware, module-level AbortControllers, and a stale-response guard in  */
/*  BOTH the success and catch branches.                                     */
/*                                                                            */
/*  THREE separate controllers, one per resource — the three tabs refresh     */
/*  independently, and paginating movements must never cancel an in-flight    */
/*  balances fetch (or the KPI strip silently goes blank).                   */
/* ────────────────────────────────────────────────────────────────────────── */

let _movementsCtrl: AbortController | null = null;
let _balancesCtrl: AbortController | null = null;
let _locationsCtrl: AbortController | null = null;

function toErrorState(err: unknown): StorageErrorState {
  if (err instanceof MaintenanceTicketsError) {
    return { message: err.message, code: err.code, retryable: err.retryable };
  }
  return { message: "An unexpected error occurred.", code: "UNKNOWN", retryable: false };
}

interface StorageState {
  /* Movements */
  movements: StockMovementListResponse | null;
  movementsLoading: boolean;
  movementsRefreshing: boolean;
  movementsError: StorageErrorState | null;
  movementFilters: StockMovementFilters;

  /* Balances */
  balances: StockBalanceListResponse | null;
  balancesLoading: boolean;
  balancesRefreshing: boolean;
  balancesError: StorageErrorState | null;
  balanceFilters: StockBalanceFilters;

  /* Locations */
  locations: StorageLocationListResponse | null;
  locationsLoading: boolean;
  locationsRefreshing: boolean;
  locationsError: StorageErrorState | null;
  locationFilters: StorageLocationFilters;

  fetchMovements: (filters?: StockMovementFilters, page?: number) => Promise<void>;
  fetchBalances: (filters?: StockBalanceFilters, page?: number) => Promise<void>;
  fetchLocations: (filters?: StorageLocationFilters, page?: number) => Promise<void>;
  clearErrors: () => void;
  reset: () => void;
}

const INITIAL = {
  movements: null,
  movementsLoading: false,
  movementsRefreshing: false,
  movementsError: null,
  movementFilters: { sort: "moved_at", dir: "desc", per_page: 25 } as StockMovementFilters,

  balances: null,
  balancesLoading: false,
  balancesRefreshing: false,
  balancesError: null,
  // non_zero on by default: a shelf that netted back to nothing is noise.
  balanceFilters: { non_zero: true, per_page: 50 } as StockBalanceFilters,

  locations: null,
  locationsLoading: false,
  locationsRefreshing: false,
  locationsError: null,
  locationFilters: { per_page: 50 } as StorageLocationFilters,
} as const;

export const useStorageStore = create<StorageState>()((set, get) => ({
  ...INITIAL,

  async fetchMovements(filters, page = 1) {
    _movementsCtrl?.abort();
    const controller = new AbortController();
    _movementsCtrl = controller;

    const next = { ...(filters ?? get().movementFilters), page };
    const hasExisting = get().movements !== null;
    set({
      movementsLoading: !hasExisting,
      movementsRefreshing: hasExisting,
      movementsError: null,
      movementFilters: next,
    });

    try {
      const result = await storageService.getStockMovements(next, controller.signal);
      if (controller.signal.aborted || _movementsCtrl !== controller) return;
      set({ movements: result, movementsLoading: false, movementsRefreshing: false });
    } catch (err) {
      if (controller.signal.aborted || _movementsCtrl !== controller) return;
      set({
        movementsError: toErrorState(err),
        movementsLoading: false,
        movementsRefreshing: false,
      });
    }
  },

  async fetchBalances(filters, page = 1) {
    _balancesCtrl?.abort();
    const controller = new AbortController();
    _balancesCtrl = controller;

    const next = { ...(filters ?? get().balanceFilters), page };
    const hasExisting = get().balances !== null;
    set({
      balancesLoading: !hasExisting,
      balancesRefreshing: hasExisting,
      balancesError: null,
      balanceFilters: next,
    });

    try {
      const result = await storageService.getStockBalances(next, controller.signal);
      if (controller.signal.aborted || _balancesCtrl !== controller) return;
      set({ balances: result, balancesLoading: false, balancesRefreshing: false });
    } catch (err) {
      if (controller.signal.aborted || _balancesCtrl !== controller) return;
      set({
        balancesError: toErrorState(err),
        balancesLoading: false,
        balancesRefreshing: false,
      });
    }
  },

  async fetchLocations(filters, page = 1) {
    _locationsCtrl?.abort();
    const controller = new AbortController();
    _locationsCtrl = controller;

    const next = { ...(filters ?? get().locationFilters), page };
    const hasExisting = get().locations !== null;
    set({
      locationsLoading: !hasExisting,
      locationsRefreshing: hasExisting,
      locationsError: null,
      locationFilters: next,
    });

    try {
      const result = await storageService.getStorageLocations(next, controller.signal);
      if (controller.signal.aborted || _locationsCtrl !== controller) return;
      set({ locations: result, locationsLoading: false, locationsRefreshing: false });
    } catch (err) {
      if (controller.signal.aborted || _locationsCtrl !== controller) return;
      set({
        locationsError: toErrorState(err),
        locationsLoading: false,
        locationsRefreshing: false,
      });
    }
  },

  clearErrors() {
    set({ movementsError: null, balancesError: null, locationsError: null });
  },

  reset() {
    _movementsCtrl?.abort();
    _balancesCtrl?.abort();
    _locationsCtrl?.abort();
    _movementsCtrl = null;
    _balancesCtrl = null;
    _locationsCtrl = null;
    set({ ...INITIAL });
  },
}));
