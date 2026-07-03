import { create } from "zustand";
import { itemService } from "@/lib/api/services/inventory.service";
import { getInventoryErrorMessage, isCanceledError } from "@/lib/api/inventory-errors";
import type { Item, ItemFormValues, ListParams } from "@/types/inventory.types";
import type { PaginatedResponse } from "@/types/api.types";

/**
 * Items store — list + create/update/delete (create & update are multipart).
 */
interface ItemsState {
  items: Item[];
  currentItem: Item | null;
  pagination: PaginatedResponse<Item>["meta"] | null;

  isLoading: boolean;
  isLoadingItem: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  error: string | null;
  itemError: string | null;
  saveError: string | null;
  deleteError: string | null;

  fetchItems: (params?: ListParams) => Promise<void>;
  fetchItem: (id: number) => Promise<Item | null>;
  createItem: (values: ItemFormValues) => Promise<Item>;
  updateItem: (id: number, values: ItemFormValues) => Promise<Item>;
  deleteItem: (id: number) => Promise<void>;
  clearErrors: () => void;
}

export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  currentItem: null,
  pagination: null,
  isLoading: false,
  isLoadingItem: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  itemError: null,
  saveError: null,
  deleteError: null,

  fetchItems: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await itemService.list(params);
      set({ items: res.data, pagination: res.meta, isLoading: false });
    } catch (error) {
      if (isCanceledError(error)) return;
      set({ error: getInventoryErrorMessage(error), isLoading: false });
    }
  },

  fetchItem: async (id) => {
    set({ isLoadingItem: true, itemError: null, currentItem: null });
    try {
      const item = await itemService.get(id);
      set({ currentItem: item, isLoadingItem: false });
      return item;
    } catch (error) {
      if (isCanceledError(error)) return null;
      set({ itemError: getInventoryErrorMessage(error), isLoadingItem: false });
      return null;
    }
  },

  createItem: async (values) => {
    set({ isSaving: true, saveError: null });
    try {
      const item = await itemService.create(values);
      set({ isSaving: false });
      return item;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  updateItem: async (id, values) => {
    set({ isSaving: true, saveError: null });
    try {
      const item = await itemService.update(id, values);
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? item : i)),
        currentItem: item,
        isSaving: false,
      }));
      return item;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  deleteItem: async (id) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await itemService.remove(id);
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        isDeleting: false,
      }));
    } catch (error) {
      set({ deleteError: getInventoryErrorMessage(error), isDeleting: false });
      throw error;
    }
  },

  clearErrors: () =>
    set({ error: null, itemError: null, saveError: null, deleteError: null }),
}));
