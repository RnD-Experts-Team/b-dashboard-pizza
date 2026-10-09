import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export type OddView = "charts" | "list";

interface WeekOutlookState {
  /**
   * How the "Keep in mind" odd days are shown: the calendar and day charts, or
   * the sentences. Charts to begin with; remembered in this browser. A view
   * preference, not data, so it is not keyed by store or user.
   */
  oddView: OddView;
  setOddView: (view: OddView) => void;
}

export const useWeekOutlookStore = create<WeekOutlookState>()(
  persist(
    (set) => ({
      oddView: "charts",
      setOddView: (oddView) => set({ oddView }),
    }),
    {
      name: "scheduling-odd-view",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage,
      ),
      partialize: (state) => ({ oddView: state.oddView }),
    },
  ),
);
