import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface PlanRowState {
  /**
   * Whether the "Plan vs usual" row in the schedule grid is folded down to its
   * title bar. Open by default; remembered in this browser, so folding it away
   * once also holds across week changes and reloads. A view preference, not data
   * — it is deliberately not keyed by store or user.
   */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const usePlanRowStore = create<PlanRowState>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: "scheduling-plan-row",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage,
      ),
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
