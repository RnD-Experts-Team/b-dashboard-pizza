import { create } from "zustand";
import type { PeriodType } from "@/types/cleaning.types";

interface PendingCleaningAction {
  storeId: number;
  periodType: PeriodType;
  periodKey: string;
}

interface CleaningActionState {
  pendingCleaningAction: PendingCleaningAction | null;
  openCleaningEvaluation: (storeId: number, periodType: PeriodType, periodKey: string) => void;
  clearPendingCleaningAction: () => void;
}

/**
 * Deep-link target for a "cleaning_evaluation_ready" (and related) notification —
 * mirrors useHiringActionStore's pattern: the notification click sets this, the
 * Cleaning Chart page reads it once on mount and clears it.
 */
export const useCleaningActionStore = create<CleaningActionState>()((set) => ({
  pendingCleaningAction: null,
  openCleaningEvaluation: (storeId, periodType, periodKey) =>
    set({ pendingCleaningAction: { storeId, periodType, periodKey } }),
  clearPendingCleaningAction: () => set({ pendingCleaningAction: null }),
}));
