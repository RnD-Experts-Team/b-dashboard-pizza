import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface ScreenProjectSelectionState {
  /** Store the selection belongs to, so switching stores doesn't apply a stale one. */
  storeId: string | null;
  selectedStationIds: number[];

  setSelection: (storeId: string, selectedStationIds: number[]) => void;
  clearSelection: () => void;
}

export const useScreenProjectSelectionStore = create<ScreenProjectSelectionState>()(
  persist(
    (set) => ({
      storeId: null,
      selectedStationIds: [],

      setSelection: (storeId, selectedStationIds) => set({ storeId, selectedStationIds }),

      clearSelection: () => set({ storeId: null, selectedStationIds: [] }),
    }),
    {
      name: "screen-project-selection",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
