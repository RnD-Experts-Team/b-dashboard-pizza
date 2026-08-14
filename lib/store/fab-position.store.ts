"use client";

import { create } from "zustand";

interface FabPosition {
  x: number;
  y: number;
}

interface FabPositionState {
  /** Live top-left position of the draggable Debrief FAB, published on every
   * move so other floating bubbles can stay anchored beside it. Not persisted —
   * purely a runtime read of "where is it right now." */
  debriefPos: FabPosition | null;
  setDebriefPos: (pos: FabPosition) => void;
}

export const useFabPositionStore = create<FabPositionState>()((set) => ({
  debriefPos: null,
  setDebriefPos: (pos) => set({ debriefPos: pos }),
}));
