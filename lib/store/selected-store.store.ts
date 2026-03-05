import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Store } from "@/types/store.types";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface SelectedStoreState {
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;
  clearSelectedStore: () => void;
}

/**
 * Validates that a persisted store object has a correct string `id`.
 * Guards against stale data where `id` was a numeric PK instead of the
 * actual store identifier (e.g., "03795-00001").
 */
function isValidPersistedStore(store: unknown): store is Store {
  if (!store || typeof store !== "object") return false;
  const s = store as Record<string, unknown>;
  return (
    typeof s.id === "string" && s.id.length > 0 &&
    typeof s.name === "string" &&
    typeof s.storeId === "string" && s.storeId.length > 0
  );
}

/**
 * Global Zustand store for managing the currently selected store
 * This store is persisted to localStorage automatically via the persist middleware
 * All components that subscribe to this store will update reactively when the store changes
 *
 * Version history:
 *  0 → id was incorrectly set to the numeric DB primary key
 *  1 → id is now the actual store_id (e.g., "03795-00001")
 *  2 → added storeId field alongside id
 *  3 → storeId is now the human-readable code; id is the numeric lookup key
 */
export const useSelectedStoreStore = create<SelectedStoreState>()(
  persist(
    (set) => ({
      selectedStore: null,

      setSelectedStore: (store: Store | null) => {
        console.log("[Zustand selectedStore] Setting store:", store ? { id: store.id, name: store.name } : null);
        set({ selectedStore: store });
      },

      clearSelectedStore: () => {
        set({ selectedStore: null });
      },
    }),
    {
      name: "selected-store-storage",
      version: 3,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      migrate: (persisted, version) => {
        const state = persisted as { selectedStore: unknown };
        const store = state?.selectedStore as Record<string, unknown> | undefined;
        // v0/v1 → v2: clear invalid store data (missing storeId or numeric id)
        if (version < 2 || !isValidPersistedStore(store)) {
          return { selectedStore: null };
        }
        // v2 → v3: clear stores where storeId was mistakenly set equal to the numeric id
        if (version < 3 && store && store.storeId === store.id) {
          return { selectedStore: null };
        }
        return state as { selectedStore: Store | null };
      },
    }
  )
);
