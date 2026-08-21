"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { todayIso } from "@/lib/hooks/use-cleaning";

export interface BreakSession {
  start: number;
  end: number | null;
  /**
   * Which counter cycle this break belongs to. Breaks sharing a cycle add up
   * into a single running counter, so starting a break resumes from where the
   * previous one stopped instead of restarting at 0:00 — the day's break
   * allowance is one budget, not one-per-break.
   *
   * Opening a new cycle (double-clicking the topbar trigger) is the only way
   * to zero that counter without wiping the day's recorded history.
   */
  cycle: number;
}

interface BreakTimerState {
  date: string;
  sessions: BreakSession[];
  /** Minutes a break can run before the overtime alert kicks in. User-configurable. */
  overtimeMinutes: number;
  ensureToday: () => void;
  startBreak: () => void;
  /** Start a break in a brand-new cycle, so its counter begins at 0:00. */
  startFreshCounter: () => void;
  endBreak: () => void;
  reset: () => void;
  setOvertimeMinutes: (minutes: number) => void;
}

/** The slice `partialize` writes to localStorage. */
type PersistedBreakTimer = Pick<BreakTimerState, "date" | "sessions" | "overtimeMinutes">;

/** The same slice as written before BreakSession gained `cycle`. */
type LegacyPersistedBreakTimer = Omit<PersistedBreakTimer, "sessions"> & {
  sessions?: (Omit<BreakSession, "cycle"> & { cycle?: number })[];
};

const DEFAULT_OVERTIME_MINUTES = 20;

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

/**
 * The cycle a new break joins by default — the highest one recorded today.
 * Cycles are 1-based so an untouched day already has a cycle to accumulate in.
 */
export function currentCycle(sessions: BreakSession[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.cycle), 1);
}

/**
 * Break time inside one cycle — what the live counter paints. Includes the
 * running break, which is the whole point: the clock has to keep climbing past
 * the total the earlier breaks in this cycle already banked.
 */
export function cycleBreakMs(
  sessions: BreakSession[],
  cycle: number,
  now: number = Date.now()
): number {
  return sessions
    .filter((s) => s.cycle === cycle)
    .reduce((sum, s) => sum + (s.end ?? now) - s.start, 0);
}

export const useBreakTimerStore = create<BreakTimerState>()(
  persist(
    (set, get) => ({
      date: todayIso(),
      sessions: [],
      overtimeMinutes: DEFAULT_OVERTIME_MINUTES,

      ensureToday: () => {
        const today = todayIso();
        if (get().date !== today) set({ date: today, sessions: [] });
      },

      startBreak: () => {
        get().ensureToday();
        const { sessions } = get();
        if (isOnBreak(sessions)) return;
        set({
          sessions: [
            ...sessions,
            { start: Date.now(), end: null, cycle: currentCycle(sessions) },
          ],
        });
      },

      startFreshCounter: () => {
        get().ensureToday();
        const { sessions } = get();
        // Close anything still running first — a fresh counter must not leave
        // the previous break open, or it would keep accruing invisibly in a
        // cycle nothing is displaying any more.
        const now = Date.now();
        const closed = sessions.map((s) => (s.end === null ? { ...s, end: now } : s));
        set({
          sessions: [
            ...closed,
            // An empty day starts at cycle 1 rather than jumping to 2 — there
            // is no earlier counter to step past.
            { start: now, end: null, cycle: closed.length === 0 ? 1 : currentCycle(closed) + 1 },
          ],
        });
      },

      endBreak: () => {
        const { sessions } = get();
        const idx = sessions.findIndex((s) => s.end === null);
        if (idx === -1) return;
        const next = [...sessions];
        next[idx] = { ...next[idx], end: Date.now() };
        set({ sessions: next });
      },

      reset: () => set({ date: todayIso(), sessions: [] }),

      setOvertimeMinutes: (minutes) => {
        const clamped = Math.max(1, Math.round(minutes) || DEFAULT_OVERTIME_MINUTES);
        set({ overtimeMinutes: clamped });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      // v1 introduced BreakSession.cycle. Migrating rather than bumping
      // STORAGE_KEY again keeps the user's overtimeMinutes setting (and any
      // break already logged today) instead of silently discarding both.
      version: 1,
      migrate: (persisted, version): PersistedBreakTimer => {
        const prev = (persisted ?? {}) as LegacyPersistedBreakTimer;
        if (version >= 1) return prev as PersistedBreakTimer;
        return {
          ...prev,
          sessions: (prev.sessions ?? []).map((s) => ({ ...s, cycle: s.cycle ?? 1 })),
        } as PersistedBreakTimer;
      },
      partialize: (state) => ({
        date: state.date,
        sessions: state.sessions,
        overtimeMinutes: state.overtimeMinutes,
      }),
    }
  )
);
