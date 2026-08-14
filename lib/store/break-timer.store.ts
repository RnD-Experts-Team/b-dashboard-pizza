"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { todayIso } from "@/lib/hooks/use-cleaning";

export interface BreakSession {
  start: number;
  end: number | null;
}

interface BreakTimerState {
  date: string;
  sessions: BreakSession[];
  ensureToday: () => void;
  startBreak: () => void;
  endBreak: () => void;
}

// Bumped once to clear out early test sessions logged while building this
// feature — no migration needed since it's purely local, throwaway state.
const STORAGE_KEY = "break-timer-storage-v2";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Whether a break is currently in progress (an open, un-ended session). */
export function isOnBreak(sessions: BreakSession[]): boolean {
  return sessions.some((s) => s.end === null);
}

/** Total break time in ms — completed sessions plus the running one, if any. */
export function totalBreakMs(sessions: BreakSession[], now: number = Date.now()): number {
  return sessions.reduce((sum, s) => sum + (s.end ?? now) - s.start, 0);
}

export const useBreakTimerStore = create<BreakTimerState>()(
  persist(
    (set, get) => ({
      date: todayIso(),
      sessions: [],

      ensureToday: () => {
        const today = todayIso();
        if (get().date !== today) set({ date: today, sessions: [] });
      },

      startBreak: () => {
        get().ensureToday();
        const { sessions } = get();
        if (isOnBreak(sessions)) return;
        set({ sessions: [...sessions, { start: Date.now(), end: null }] });
      },

      endBreak: () => {
        const { sessions } = get();
        const idx = sessions.findIndex((s) => s.end === null);
        if (idx === -1) return;
        const next = [...sessions];
        next[idx] = { ...next[idx], end: Date.now() };
        set({ sessions: next });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({ date: state.date, sessions: state.sessions }),
    }
  )
);
