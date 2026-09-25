"use client";

import { create } from "zustand";
import { breaksService } from "@/lib/api/services/breaks.service";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import type {
  ActiveBreak,
  BreakDay,
  BreakSettings,
  BreakType,
} from "@/types/breaks.types";

/**
 * Breaks — the server-backed break timer's shared client state.
 *
 * Deliberately NOT persisted: the server is the only source of truth (it
 * replaced the old localStorage-only timer), and a stale cached "running"
 * break is exactly the kind of drift that makes the next start 409.
 *
 * Holds only what the topbar and the page share: the catalogue, settings,
 * the running break and the CURRENT work day. Other days and history are
 * page-local (see lib/hooks/use-break-day.ts / use-break-history.ts).
 *
 * In-flight reads are shared: calling `refresh()` while one is running
 * returns the same promise. `GET breaks/active` and `GET breaks/day` write
 * upstream, so StrictMode's double effects and the topbar + page mounting
 * together must not multiply requests.
 */

interface BreaksState {
  settings: BreakSettings | null;
  types: BreakType[];
  active: ActiveBreak | null;
  today: BreakDay | null;
  /** First bootstrap finished (successfully or not). */
  ready: boolean;
  /** Last failure of a background read — surfaced as a quiet retry hint. */
  syncError: BreakError | null;
  /** Epoch ms of the last successful active/today sync. */
  syncedAt: number | null;
  /** The catalogue failed to load (settings may still be fine). */
  typesError: BreakError | null;
  typesLoading: boolean;

  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Re-read the catalogue — read-only upstream, safe to retry any time. */
  reloadTypes: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  setSettings: (settings: BreakSettings) => void;
  /** Throws BreakError — the caller handles ALREADY_ON_BREAK as a flow. */
  start: (breakTypeId: number, otherLabel?: string) => Promise<void>;
  /** Stops the running break. A break already stopped elsewhere is not an error. */
  stop: () => Promise<void>;
  /** End `runningId`, then start the new one (the ALREADY_ON_BREAK resolution). */
  switchTo: (runningId: number, breakTypeId: number, otherLabel?: string) => Promise<void>;
  reset: () => void;
}

let bootstrapInflight: Promise<void> | null = null;
let refreshInflight: Promise<void> | null = null;
let typesInflight: Promise<void> | null = null;

const INITIAL = {
  settings: null,
  types: [],
  active: null,
  today: null,
  ready: false,
  syncError: null,
  syncedAt: null,
  typesError: null,
  typesLoading: false,
} satisfies Partial<BreaksState>;

export const useBreaksStore = create<BreaksState>()((set, get) => ({
  ...INITIAL,

  bootstrap: () => {
    if (get().ready && get().settings) return get().refresh();
    if (bootstrapInflight) return bootstrapInflight;
    bootstrapInflight = (async () => {
      try {
        // The catalogue loads on its own track: a failed or empty type list
        // must not take settings (and the whole timer) down with it.
        void get().reloadTypes();
        const settings = await breaksService.getSettings();
        set({ settings });
        await get().refresh();
      } catch (err) {
        set({ syncError: parseBreakError(err) });
      } finally {
        set({ ready: true });
        bootstrapInflight = null;
      }
    })();
    return bootstrapInflight;
  },

  refresh: () => {
    if (refreshInflight) return refreshInflight;
    refreshInflight = (async () => {
      try {
        const [active, today] = await Promise.all([
          breaksService.getActive(),
          breaksService.getDay(),
        ]);
        set({ active, today, syncError: null, syncedAt: Date.now() });
      } catch (err) {
        const parsed = parseBreakError(err);
        if (parsed.code !== "CANCELLED") set({ syncError: parsed });
      } finally {
        refreshInflight = null;
      }
    })();
    return refreshInflight;
  },

  reloadTypes: () => {
    if (typesInflight) return typesInflight;
    typesInflight = (async () => {
      set({ typesLoading: true });
      try {
        const types = await breaksService.getTypes();
        set({ types, typesError: null });
      } catch (err) {
        const parsed = parseBreakError(err);
        if (parsed.code !== "CANCELLED") set({ typesError: parsed });
      } finally {
        set({ typesLoading: false });
        typesInflight = null;
      }
    })();
    return typesInflight;
  },

  reloadSettings: async () => {
    const settings = await breaksService.getSettings();
    set({ settings });
  },

  setSettings: (settings) => set({ settings }),

  start: async (breakTypeId, otherLabel) => {
    try {
      await breaksService.start({
        break_type_id: breakTypeId,
        ...(otherLabel ? { other_label: otherLabel } : {}),
      });
    } finally {
      // Refresh on failure too — a 409 means our view of "running" was stale.
      await get().refresh();
    }
  },

  stop: async () => {
    const running = get().active;
    if (!running) return get().refresh();
    try {
      await breaksService.stop(running.id);
    } catch (err) {
      const parsed = parseBreakError(err);
      // Stopped in another tab / device, or deleted: the goal is already met.
      if (parsed.code !== "BREAK_NOT_RUNNING" && parsed.code !== "NOT_FOUND") {
        await get().refresh();
        throw parsed;
      }
    }
    await get().refresh();
  },

  switchTo: async (runningId, breakTypeId, otherLabel) => {
    try {
      await breaksService.stop(runningId);
    } catch (err) {
      const parsed = parseBreakError(err);
      if (parsed.code !== "BREAK_NOT_RUNNING" && parsed.code !== "NOT_FOUND") {
        await get().refresh();
        throw parsed;
      }
    }
    await get().start(breakTypeId, otherLabel);
  },

  reset: () => {
    bootstrapInflight = null;
    refreshInflight = null;
    typesInflight = null;
    set({ ...INITIAL });
  },
}));

/**
 * Seconds of COUNTED break used today, right now — the server's
 * `counted_seconds` (computed at `as_of`, running break included) plus the
 * time since then, if the running break counts and belongs to today.
 */
export function liveCountedSeconds(
  today: BreakDay | null,
  active: ActiveBreak | null,
  now: number
): number {
  if (!today) return 0;
  let seconds = today.counted_seconds;
  if (
    active &&
    active.counts_toward_limit &&
    !active.belongs_to_previous_work_day &&
    active.work_date === today.work_date
  ) {
    const asOf = new Date(today.as_of).getTime();
    if (!Number.isNaN(asOf)) seconds += Math.max(0, Math.floor((now - asOf) / 1000));
  }
  return seconds;
}
