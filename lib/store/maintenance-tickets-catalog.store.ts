import { create } from "zustand";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { EMPTY_BOARD } from "@/lib/maintenance-tickets/technician-ranking";
import type {
  CatalogIssue,
  CatalogTechnician,
  TechnicianAbilityBoard,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  State shape                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface MaintenanceTicketsCatalogState {
  issues: CatalogIssue[];
  technicians: CatalogTechnician[];
  /**
   * Technician ratings, which order the pickers. Empty when this person may
   * not see ratings (a 403) or they failed to load -- the pickers then fall
   * back to name order rather than the catalog failing.
   */
  abilities: TechnicianAbilityBoard;
  isLoading: boolean;
  error: string | null;

  /** Call on page entry and after any successful mutation. Pass the active store id to forward it as X-Store-Id. */
  loadCatalog: (storeId?: string) => Promise<void>;
  /** Re-read just the ratings, after one is edited. */
  loadAbilities: () => Promise<void>;
  clearError: () => void;
}

/**
 * The ratings, or `null` when they could not be read this time. A 403 is an
 * answer, not a failure: this person does not see ratings, so the board is
 * empty.
 */
async function fetchAbilities(): Promise<TechnicianAbilityBoard | null> {
  try {
    return await maintenanceTicketsService.getTechnicianAbilities();
  } catch (err) {
    return err instanceof MaintenanceTicketsError && err.code === "FORBIDDEN" ? EMPTY_BOARD : null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useMaintenanceTicketsCatalogStore =
  create<MaintenanceTicketsCatalogState>()((set, get) => ({
    issues: [],
    technicians: [],
    abilities: EMPTY_BOARD,
    isLoading: false,
    error: null,

    loadCatalog: async (storeId?: string) => {
      set({ isLoading: true, error: null });
      try {
        const [issues, technicians, abilities] = await Promise.all([
          maintenanceTicketsService.getCatalogIssues(undefined, storeId),
          maintenanceTicketsService.getCatalogTechnicians(),
          fetchAbilities(),
        ]);
        // A failed ratings read keeps the last good one.
        set({ issues, technicians, abilities: abilities ?? get().abilities, isLoading: false });
      } catch (err) {
        const message =
          err instanceof MaintenanceTicketsError
            ? err.message
            : "Failed to load catalog data.";
        set({ isLoading: false, error: message });
      }
    },

    loadAbilities: async () => {
      const abilities = await fetchAbilities();
      if (abilities) set({ abilities });
    },

    clearError: () => set({ error: null }),
  }));
