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
  /** Internal store id the current entry was fetched with — reused so a recount
   *  PATCH can send the same X-Store-Id the backend needs to authorize it. */
  currentStoreId: string | null;
  /** True when currentEntry came from /history (i.e. items carry is_edited/edits). */
  hasHistoryAccess: boolean;

  isLoading: boolean;
  isLoadingDetail: boolean;
  isSaving: boolean;

  error: string | null;
  detailError: string | null;
  saveError: string | null;

  fetchEntries: (storeId: string, params?: EntryListParams) => Promise<void>;
  fetchEntry: (id: number, storeId?: string) => Promise<EntryDetail | null>;
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
  currentStoreId: null,
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
  fetchEntry: async (id, storeId) => {
    set({
      isLoadingDetail: true,
      detailError: null,
      currentEntry: null,
      currentStoreId: storeId ?? null,
      hasHistoryAccess: false,
    });
    try {
      const entry = await entryService.getHistory(id, storeId);
      set({ currentEntry: entry, hasHistoryAccess: true, isLoadingDetail: false });
      return entry;
    } catch (error) {
      if (isCanceledError(error)) return null;
      if (!isForbiddenError(error)) {
        set({ detailError: getInventoryErrorMessage(error), isLoadingDetail: false });
        return null;
      }
      try {
        const entry = await entryService.get(id, storeId);
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
      const updated = await entryService.updateEntryItem(
        entryItemId,
        payload,
        get().currentStoreId ?? undefined
      );
      // Merge the updated counts back immediately for instant row feedback.
      const entryId = get().currentEntry?.id;
      const storeId = get().currentStoreId ?? undefined;
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
      // Re-fetch the full entry silently (no loading state) so the summary
      // metrics (edited_items_count) and the per-item edits history update
      // without requiring the user to reopen the sheet.
      if (entryId) {
        try {
          const fresh = await entryService.getHistory(entryId, storeId);
          set({ currentEntry: fresh, hasHistoryAccess: true });
        } catch {
          try {
            const fresh = await entryService.get(entryId, storeId);
            set({ currentEntry: fresh });
          } catch {
            // Silent — the already-merged counts are still correct.
          }
        }
      }
      return updated;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  clearErrors: () =>
    set({ error: null, detailError: null, saveError: null }),
}));
