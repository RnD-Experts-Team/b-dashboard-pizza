import { create } from "zustand";
import type { DebugView } from "@/lib/screen-usage/debug-view";

/**
 * Debug views received by an observer from the manager connected to each
 * station room (room_name → latest view). Not persisted: live only.
 */
interface RemoteUsageDebugState {
  views: Record<string, { view: DebugView; at: number }>;
  set: (room: string, view: DebugView) => void;
  clear: (room: string) => void;
}

export const useRemoteUsageDebugStore = create<RemoteUsageDebugState>((set) => ({
  views: {},
  set: (room, view) => set((s) => ({ views: { ...s.views, [room]: { view, at: Date.now() } } })),
  clear: (room) =>
    set((s) => ({ views: Object.fromEntries(Object.entries(s.views).filter(([r]) => r !== room)) })),
}));
