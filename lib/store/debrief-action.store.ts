import { create } from "zustand";

interface PendingDebriefKey {
  keyId: number;
  date: string;
  storeId: string;
}

interface DebriefActionState {
  pendingDebriefKey: PendingDebriefKey | null;
  openDebriefKey: (keyId: number, date: string, storeId: string) => void;
  clearPendingDebriefKey: () => void;
}

export const useDebriefActionStore = create<DebriefActionState>()((set) => ({
  pendingDebriefKey: null,
  openDebriefKey: (keyId, date, storeId) =>
    set({ pendingDebriefKey: { keyId, date, storeId } }),
  clearPendingDebriefKey: () => set({ pendingDebriefKey: null }),
}));
