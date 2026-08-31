import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MAX_BOTTOM_NAV_ITEMS } from "@/lib/nav/bottom-nav-access";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface BottomNavState {
  /** Persisted selection once the user has customized. Null = use computed defaults. */
  selectedItemIds: string[] | null;
  hasCustomized: boolean;

  /** Runtime-only, not persisted. */
  isVisible: boolean;
  isEditMode: boolean;
  editBackup: string[] | null;

  setVisible: (visible: boolean) => void;
  enterEditMode: (currentActiveIds: string[]) => void;
  exitEditMode: (save: boolean) => void;
  toggleItemInEdit: (id: string) => void;
  resetDraftToDefaults: (defaultIds: string[]) => void;
  /** Clears the saved customization. Called on identity switch (login/logout/
   * impersonate) — the selection is per-user and must not leak across accounts
   * sharing the same browser/localStorage. */
  reset: () => void;
}

export const useBottomNavStore = create<BottomNavState>()(
  persist(
    (set, get) => ({
      selectedItemIds: null,
      hasCustomized: false,
      isVisible: true,
      isEditMode: false,
      editBackup: null,

      setVisible: (visible) => {
        if (get().isVisible === visible) return;
        set({ isVisible: visible });
      },

      enterEditMode: (currentActiveIds) => {
        set({
          isEditMode: true,
          editBackup: [...currentActiveIds],
          selectedItemIds: [...currentActiveIds],
        });
      },

      exitEditMode: (save) => {
        set((state) => ({
          isEditMode: false,
          selectedItemIds: save ? state.selectedItemIds : state.editBackup,
          hasCustomized: save ? true : state.hasCustomized,
          editBackup: null,
        }));
      },

      toggleItemInEdit: (id) => {
        set((state) => {
          const current = state.selectedItemIds ?? [];
          if (current.includes(id)) {
            return { selectedItemIds: current.filter((existing) => existing !== id) };
          }
          if (current.length >= MAX_BOTTOM_NAV_ITEMS) return {};
          return { selectedItemIds: [...current, id] };
        });
      },

      resetDraftToDefaults: (defaultIds) => {
        set({ selectedItemIds: [...defaultIds] });
      },

      reset: () => {
        set({
          selectedItemIds: null,
          hasCustomized: false,
          isVisible: true,
          isEditMode: false,
          editBackup: null,
        });
      },
    }),
    {
      name: "bottom-nav-storage",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        selectedItemIds: state.selectedItemIds,
        hasCustomized: state.hasCustomized,
      }),
    }
  )
);
