import { create } from "zustand";
import { linkService } from "@/lib/api/services/inventory.service";
import { getInventoryErrorMessage, isCanceledError } from "@/lib/api/inventory-errors";
import type { Link, CreateLinkPayload, LinkListParams } from "@/types/inventory.types";
import type { PaginatedResponse } from "@/types/api.types";

/**
 * Links store — list per store + create (create returns one link per employee).
 */
interface LinksState {
  links: Link[];
  pagination: PaginatedResponse<Link>["meta"] | null;
  /** The links produced by the most recent create call (shown with copyable URLs). */
  createdLinks: Link[];

  isLoading: boolean;
  isCreating: boolean;

  error: string | null;
  createError: string | null;

  fetchLinks: (storeId: string, params?: LinkListParams) => Promise<void>;
  createLinks: (payload: CreateLinkPayload) => Promise<Link[]>;
  clearCreated: () => void;
  clearErrors: () => void;
}

export const useLinksStore = create<LinksState>()((set, get) => ({
  links: [],
  pagination: null,
  createdLinks: [],
  isLoading: false,
  isCreating: false,
  error: null,
  createError: null,

  fetchLinks: async (storeId, params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await linkService.listByStore(storeId, params);
      set({ links: res.data, pagination: res.meta, isLoading: false });
    } catch (error) {
      if (isCanceledError(error)) return;
      set({ error: getInventoryErrorMessage(error), isLoading: false });
    }
  },

  createLinks: async (payload) => {
    set({ isCreating: true, createError: null });
    try {
      const created = await linkService.create(payload);
      set({ createdLinks: created, isCreating: false });
      // Refresh the list for the same store so new links appear.
      await get().fetchLinks(payload.store_id);
      return created;
    } catch (error) {
      set({ createError: getInventoryErrorMessage(error), isCreating: false });
      throw error;
    }
  },

  clearCreated: () => set({ createdLinks: [] }),
  clearErrors: () => set({ error: null, createError: null }),
}));
