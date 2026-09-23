import { create } from "zustand";
import type { PeriodType } from "@/types/cleaning.types";

interface PendingCleaningAction {
  periodType: PeriodType;
  periodKey: string;
  /** A human label (e.g. "Store 1"), not an id — carried through for display
   *  only. The deep-link target is always the "My Store" tab, which already
   *  shows the viewing user's own store regardless, so nothing here needs to
   *  resolve this to an actual store id. */
  store: string | null;
}

interface CleaningActionState {
  pendingCleaningAction: PendingCleaningAction | null;
  openCleaningEvaluation: (periodType: PeriodType, periodKey: string, store?: string | null) => void;
  clearPendingCleaningAction: () => void;
}

/**
 * Deep-link target for a "cleaning_evaluation_ready" (and related) notification —
 * mirrors useHiringActionStore's pattern: the notification click sets this, the
 * Cleaning Chart page reads it once on mount and clears it.
 */
export const useCleaningActionStore = create<CleaningActionState>()((set) => ({
  pendingCleaningAction: null,
  openCleaningEvaluation: (periodType, periodKey, store = null) =>
    set({ pendingCleaningAction: { periodType, periodKey, store } }),
  clearPendingCleaningAction: () => set({ pendingCleaningAction: null }),
}));
