import { create } from "zustand";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  CatalogIssue,
  CatalogTechnician,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  State shape                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface MaintenanceTicketsCatalogState {
  issues: CatalogIssue[];
  technicians: CatalogTechnician[];
  isLoading: boolean;
  error: string | null;

  /** Call on page entry and after any successful mutation */
  loadCatalog: () => Promise<void>;
  clearError: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useMaintenanceTicketsCatalogStore =
  create<MaintenanceTicketsCatalogState>()((set) => ({
    issues: [],
    technicians: [],
    isLoading: false,
    error: null,

    loadCatalog: async () => {
      set({ isLoading: true, error: null });
      try {
        const [issues, technicians] = await Promise.all([
          maintenanceTicketsService.getCatalogIssues(),
          maintenanceTicketsService.getCatalogTechnicians(),
        ]);
        set({ issues, technicians, isLoading: false });
      } catch (err) {
        const message =
          err instanceof MaintenanceTicketsError
            ? err.message
            : "Failed to load catalog data.";
        set({ isLoading: false, error: message });
      }
    },

    clearError: () => set({ error: null }),
  }));
