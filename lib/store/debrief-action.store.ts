import { create } from "zustand";

interface PendingDebriefKey {
  keyId: number;
  date: string;
  storeId: string;
}

/** Tabs of the floating debrief panel, in its own `activeNav` order. */
export type DebriefPanelTab = "debrief" | "due-keys" | "cleaning-chart";

/**
 * Outstanding-task counts published by the floating debrief button so other
 * surfaces (e.g. Dashboard V1's Manager Tasks card) can show the same numbers
 * without re-fetching. The panel already loads both data sets on every page.
 */
export interface ManagerTaskCounts {
  dueKeysUnfilled: number;
  dueKeysTotal: number;
  /** Labels of the unfilled due-key items, for display. */
  dueKeysUnfilledLabels: string[];
  /** Date the due-key counts were computed for (YYYY-MM-DD). */
  dueKeysDate: string | null;
  /** True once due-keys data has loaded at least once. */
  dueKeysReady: boolean;
  cleaningPending: number;
  cleaningTotal: number;
  /** Labels of the pending cleaning-task items, for display. */
  cleaningPendingLabels: string[];
  /** Date the cleaning counts were computed for (YYYY-MM-DD). */
  cleaningDate: string | null;
  /** True once cleaning data has loaded at least once. */
  cleaningReady: boolean;
  /** False when the user lacks access to the cleaning "due" tab. */
  canSeeCleaning: boolean;
  /** False when the floating panel is unavailable, so it can't be opened. */
  panelAvailable: boolean;
}

const EMPTY_TASK_COUNTS: ManagerTaskCounts = {
  dueKeysUnfilled: 0,
  dueKeysTotal: 0,
  dueKeysUnfilledLabels: [],
  dueKeysDate: null,
  dueKeysReady: false,
  cleaningPending: 0,
  cleaningTotal: 0,
  cleaningPendingLabels: [],
  cleaningDate: null,
  cleaningReady: false,
  canSeeCleaning: false,
  panelAvailable: false,
};

interface DebriefActionState {
  pendingDebriefKey: PendingDebriefKey | null;
  openDebriefKey: (keyId: number, date: string, storeId: string) => void;
  clearPendingDebriefKey: () => void;

  /** Set to request the floating panel open on a given tab. */
  pendingPanelTab: DebriefPanelTab | null;
  openDebriefPanel: (tab: DebriefPanelTab) => void;
  clearPendingPanelTab: () => void;

  taskCounts: ManagerTaskCounts;
  setTaskCounts: (partial: Partial<ManagerTaskCounts>) => void;
}

export const useDebriefActionStore = create<DebriefActionState>()((set) => ({
  pendingDebriefKey: null,
  openDebriefKey: (keyId, date, storeId) =>
    set({ pendingDebriefKey: { keyId, date, storeId } }),
  clearPendingDebriefKey: () => set({ pendingDebriefKey: null }),

  pendingPanelTab: null,
  openDebriefPanel: (tab) => set({ pendingPanelTab: tab }),
  clearPendingPanelTab: () => set({ pendingPanelTab: null }),

  taskCounts: EMPTY_TASK_COUNTS,
  setTaskCounts: (partial) =>
    set((state) => {
      // Skip the state write when nothing actually changed — these setters are
      // called from effects that re-run on every panel render. Arrays compare
      // by content (new references arrive each call even when labels didn't change).
      const next = { ...state.taskCounts, ...partial };
      const sameValue = (a: unknown, b: unknown) =>
        Array.isArray(a) && Array.isArray(b)
          ? a.length === b.length && a.every((v, i) => v === b[i])
          : a === b;
      const unchanged = (
        Object.keys(partial) as (keyof ManagerTaskCounts)[]
      ).every((k) => sameValue(state.taskCounts[k], next[k]));
      return unchanged ? state : { taskCounts: next };
    }),
}));
