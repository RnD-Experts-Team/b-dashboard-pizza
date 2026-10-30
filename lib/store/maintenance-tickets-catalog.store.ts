import { create } from "zustand";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { maintenanceCatalogService } from "@/lib/api/services/maintenance-catalog.service";
import type { CatalogIssue } from "@/types/maintenance-tickets.types";
import type { Technician, TechnicianAbility } from "@/types/maintenance-v2";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The shared maintenance catalog: issues (what can break), technicians and */
/*  who covers which issue. Shared across the tickets list, the create       */
/*  dialog and the filters, so it lives in one Zustand store.                */
/*                                                                            */
/*  Ranked lists for one ticket (store/issue) come from the server instead:  */
/*  useTechnicians({ store, issueId }) in lib/hooks/use-maintenance-catalog. */
/* ────────────────────────────────────────────────────────────────────────── */

/** Enough for the dropdowns: one page this size holds every technician. */
const TECHNICIANS_PAGE_SIZE = 500;

interface MaintenanceTicketsCatalogState {
  issues: CatalogIssue[];
  technicians: Technician[];
  /**
   * Who covers which issue, with ratings. Empty when this person may not see
   * them (a 403) or they failed to load — the catalog still loads.
   */
  abilities: TechnicianAbility[];
  isLoading: boolean;
  error: string | null;

  /** Call on page entry and after any successful mutation. Pass the active store id to forward it as X-Store-Id. */
  loadCatalog: (storeId?: string) => Promise<void>;
  /** Re-read just the coverage, after one is edited. */
  loadAbilities: () => Promise<void>;
  clearError: () => void;
}

/** The coverage, or `null` when it could not be read this time (a 403 is an answer: none). */
async function fetchAbilities(): Promise<TechnicianAbility[] | null> {
  try {
    return await maintenanceCatalogService.listAbilities();
  } catch (err) {
    return err instanceof MaintenanceTicketsError && err.code === "FORBIDDEN" ? [] : null;
  }
}

export const useMaintenanceTicketsCatalogStore = create<MaintenanceTicketsCatalogState>()((set, get) => ({
  issues: [],
  technicians: [],
  abilities: [],
  isLoading: false,
  error: null,

  loadCatalog: async (storeId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const [issues, technicians, abilities] = await Promise.all([
        maintenanceTicketsService.getCatalogIssues(undefined, storeId),
        maintenanceCatalogService.listTechnicians({ perPage: TECHNICIANS_PAGE_SIZE }),
        fetchAbilities(),
      ]);
      // A failed coverage read keeps the last good one.
      set({ issues, technicians: technicians.data, abilities: abilities ?? get().abilities, isLoading: false });
    } catch (err) {
      const message = err instanceof MaintenanceTicketsError ? err.message : "Failed to load catalog data.";
      set({ isLoading: false, error: message });
    }
  },

  loadAbilities: async () => {
    const abilities = await fetchAbilities();
    if (abilities) set({ abilities });
  },

  clearError: () => set({ error: null }),
}));
