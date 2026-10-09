import { create } from "zustand";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError, type TicketError } from "@/lib/toolbox-tickets/errors";
import type { TicketSection } from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Active ticket sections — the "what is this about?" picker and the list   */
/*  filters. Fetched once per session (promise de-duped); the admin tab      */
/*  calls `reload()` after it changes the catalogue. Not persisted: the      */
/*  catalogue is server state, and a stale key would 422 on create.          */
/* ────────────────────────────────────────────────────────────────────────── */

interface CatalogState {
  sections: TicketSection[] | null;
  loading: boolean;
  error: TicketError | null;
  load: () => Promise<void>;
  reload: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useToolboxTicketsCatalog = create<CatalogState>((set, get) => ({
  sections: null,
  loading: false,
  error: null,

  load: () => {
    if (get().sections) return Promise.resolve();
    return get().reload();
  },

  reload: () => {
    if (inflight) return inflight;
    set({ loading: true, error: null });
    inflight = toolboxTicketsService
      .listSections()
      .then((sections) => {
        set({
          sections: [...sections].sort(
            (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
          ),
          loading: false,
        });
      })
      .catch((err) => set({ error: parseTicketError(err), loading: false }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
}));
