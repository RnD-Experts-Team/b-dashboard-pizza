import { create } from "zustand";

interface PendingDebriefKey {
  keyId: number;
  date: string;
  storeId: string;
}

/** Optional context for `openDebriefPanel` — the panel switches to it first. */
export interface DebriefPanelOpenOptions {
  /** YYYY-MM-DD — applied to the tab's own date picker. */
  date?: string;
  /** Store CODE (e.g. "03795-00001"), the same id the panel's store select uses. */
  storeId?: string;
}

/** A cleaning task the panel should open straight onto (Manager Hub rows). */
export interface PendingCleaningTask {
  taskId: number;
  date: string;
  /** Store CODE, as above. */
  storeId: string;
}

/** Tabs of the floating debrief panel, in its own `activeNav` order. */
export type DebriefPanelTab =
  | "debrief"
  | "due-keys"
  | "cleaning-chart"
  | "notepad";

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
  pendingPanelOpts: DebriefPanelOpenOptions | null;
  openDebriefPanel: (tab: DebriefPanelTab, opts?: DebriefPanelOpenOptions) => void;
  clearPendingPanelTab: () => void;

  /** Set to request the panel open on the Cleaning tab with this task's form. */
  pendingCleaningTask: PendingCleaningTask | null;
  openCleaningTask: (taskId: number, date: string, storeId: string) => void;
  clearPendingCleaningTask: () => void;

  /**
   * Bumped after every successful write made from the panel (debrief value,
   * bulk fill, cleaning complete/undo, employee debrief). Pages that show the
   * same data (Manager Hub) watch it and refetch quietly.
   */
  revision: number;
  bumpRevision: () => void;

  taskCounts: ManagerTaskCounts;
  setTaskCounts: (partial: Partial<ManagerTaskCounts>) => void;
}

export const useDebriefActionStore = create<DebriefActionState>()((set) => ({
  pendingDebriefKey: null,
  openDebriefKey: (keyId, date, storeId) =>
    set({ pendingDebriefKey: { keyId, date, storeId } }),
  clearPendingDebriefKey: () => set({ pendingDebriefKey: null }),

  pendingPanelTab: null,
  pendingPanelOpts: null,
  openDebriefPanel: (tab, opts) =>
    set({ pendingPanelTab: tab, pendingPanelOpts: opts ?? null }),
  clearPendingPanelTab: () => set({ pendingPanelTab: null, pendingPanelOpts: null }),

  pendingCleaningTask: null,
  openCleaningTask: (taskId, date, storeId) =>
    set({ pendingCleaningTask: { taskId, date, storeId } }),
  clearPendingCleaningTask: () => set({ pendingCleaningTask: null }),

  revision: 0,
  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),

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
