import { create } from "zustand";

export type HiringActionTab = "hiring" | "separation" | "milestone_gift";

interface PendingHiringAction {
  tab: HiringActionTab;
  requestId: number;
  storeNumber: string;
}

interface HiringActionState {
  pendingHiringAction: PendingHiringAction | null;
  openHiringRequest: (tab: HiringActionTab, requestId: number, storeNumber: string) => void;
  clearPendingHiringAction: () => void;
}

export const useHiringActionStore = create<HiringActionState>()((set) => ({
  pendingHiringAction: null,
  openHiringRequest: (tab, requestId, storeNumber) =>
    set({ pendingHiringAction: { tab, requestId, storeNumber } }),
  clearPendingHiringAction: () => set({ pendingHiringAction: null }),
}));
