import { create } from "zustand";
import { entryService } from "@/lib/api/services/inventory.service";
import {
  getInventoryErrorMessage,
  isCanceledError,
  isForbiddenError,
} from "@/lib/api/inventory-errors";
import type {
  Entry,
  EntryDetail,
  EntryItem,
  UpdateEntryItemPayload,
  EntryListParams,
} from "@/types/inventory.types";
import type { PaginatedResponse } from "@/types/api.types";

/**
 * Entries store — list per store + detail + per-item recount (PATCH).
 */
interface EntriesState {
  entries: Entry[];
  pagination: PaginatedResponse<Entry>["meta"] | null;
  currentEntry: EntryDetail | null;
  /** True when currentEntry came from /history (i.e. items carry is_edited/edits). */
  hasHistoryAccess: boolean;

  isLoading: boolean;
  isLoadingDetail: boolean;
  isSaving: boolean;

  error: string | null;
  detailError: string | null;
  saveError: string | null;

  fetchEntries: (storeId: string, params?: EntryListParams) => Promise<void>;
  fetchEntry: (id: number) => Promise<EntryDetail | null>;
  recountItem: (
    entryItemId: number,
    payload: UpdateEntryItemPayload
  ) => Promise<EntryItem>;
  clearErrors: () => void;
}

export const useEntriesStore = create<EntriesState>()((set, get) => ({
  entries: [],
  pagination: null,
  currentEntry: null,
  hasHistoryAccess: false,
  isLoading: false,
  isLoadingDetail: false,
  isSaving: false,
  error: null,
  detailError: null,
  saveError: null,

  fetchEntries: async (storeId, params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await entryService.listByStore(storeId, params);
      set({ entries: res.data, pagination: res.meta, isLoading: false });
    } catch (error) {
      if (isCanceledError(error)) return;
      set({ error: getInventoryErrorMessage(error), isLoading: false });
    }
  },

  // Deterministic per the API: try the history endpoint first (it returns
  // is_edited/edits on every item); a 403 means this user isn't permitted to
  // see history, so fall back to the plain endpoint instead of erroring out.
  fetchEntry: async (id) => {
    set({
      isLoadingDetail: true,
      detailError: null,
      currentEntry: null,
      hasHistoryAccess: false,
    });
    try {
      const entry = await entryService.getHistory(id);
      set({ currentEntry: entry, hasHistoryAccess: true, isLoadingDetail: false });
      return entry;
    } catch (error) {
      if (isCanceledError(error)) return null;
      if (!isForbiddenError(error)) {
        set({ detailError: getInventoryErrorMessage(error), isLoadingDetail: false });
        return null;
      }
      try {
        const entry = await entryService.get(id);
        set({ currentEntry: entry, hasHistoryAccess: false, isLoadingDetail: false });
        return entry;
      } catch (fallbackError) {
        if (isCanceledError(fallbackError)) return null;
        set({
          detailError: getInventoryErrorMessage(fallbackError),
          isLoadingDetail: false,
        });
        return null;
      }
    }
  },

  recountItem: async (entryItemId, payload) => {
    set({ isSaving: true, saveError: null });
    try {
      const updated = await entryService.updateEntryItem(entryItemId, payload);
      // Merge the updated counts/edits back into the loaded entry detail.
      set((state) => {
        if (!state.currentEntry) return { isSaving: false };
        return {
          isSaving: false,
          currentEntry: {
            ...state.currentEntry,
            items: state.currentEntry.items.map((it) =>
              it.id === entryItemId ? { ...it, ...updated } : it
            ),
          },
        };
      });
      return updated;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  clearErrors: () =>
    set({ error: null, detailError: null, saveError: null }),
}));
