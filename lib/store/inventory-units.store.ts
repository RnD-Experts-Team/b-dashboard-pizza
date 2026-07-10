import { create } from "zustand";
import { unitService } from "@/lib/api/services/inventory.service";
import { getInventoryErrorMessage, isCanceledError } from "@/lib/api/inventory-errors";
import type { Unit, UnitPayload, ListParams } from "@/types/inventory.types";
import type { PaginatedResponse } from "@/types/api.types";

/**
 * Units store — list + create/update/delete.
 * Mirrors the roles.store pattern: one loading/error flag per async operation.
 */
interface UnitsState {
  units: Unit[];
  pagination: PaginatedResponse<Unit>["meta"] | null;

  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  error: string | null;
  saveError: string | null;
  deleteError: string | null;

  fetchUnits: (params?: ListParams) => Promise<void>;
  createUnit: (payload: UnitPayload) => Promise<Unit>;
  updateUnit: (id: number, payload: UnitPayload) => Promise<Unit>;
  deleteUnit: (id: number) => Promise<void>;
  clearErrors: () => void;
}

export const useUnitsStore = create<UnitsState>()((set, get) => ({
  units: [],
  pagination: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  saveError: null,
  deleteError: null,

  fetchUnits: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await unitService.list(params);
      set({ units: res.data, pagination: res.meta, isLoading: false });
    } catch (error) {
      if (isCanceledError(error)) return; // ignore aborted requests
      set({ error: getInventoryErrorMessage(error), isLoading: false });
    }
  },

  createUnit: async (payload) => {
    set({ isSaving: true, saveError: null });
    try {
      const unit = await unitService.create(payload);
      await get().fetchUnits();
      set({ isSaving: false });
      return unit;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  updateUnit: async (id, payload) => {
    set({ isSaving: true, saveError: null });
    try {
      const unit = await unitService.update(id, payload);
      set((state) => ({
        units: state.units.map((u) => (u.id === id ? { ...u, ...unit } : u)),
        isSaving: false,
      }));
      return unit;
    } catch (error) {
      set({ saveError: getInventoryErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  deleteUnit: async (id) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await unitService.remove(id);
      set((state) => ({
        units: state.units.filter((u) => u.id !== id),
        isDeleting: false,
      }));
    } catch (error) {
      // A 422 here usually means the unit is still referenced by an item.
      set({ deleteError: getInventoryErrorMessage(error), isDeleting: false });
      throw error;
    }
  },

  clearErrors: () =>
    set({ error: null, saveError: null, deleteError: null }),
}));
