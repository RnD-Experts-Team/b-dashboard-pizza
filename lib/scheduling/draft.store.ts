import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShiftType } from "@/types/scheduling.types";

/**
 * Unsaved shifts the manager has laid out but not yet submitted.
 *
 * Adding a shift used to fire `POST /shifts` immediately, which meant dozens of
 * round trips to build a week, each able to fail on its own, with no chance to
 * review the week before committing it. Now adds are local and one Save submits
 * them all through `POST /schedule/bulk/create-shifts`.
 *
 * Persisted to localStorage via the `persist` middleware, keyed by store AND
 * week — so switching week, switching store, or reloading the page PARKS the
 * drafts rather than losing them, and coming back restores them. That is also
 * why the sidebar store picker needs no guard.
 *
 * Only ADDITIONS are drafted. Editing or deleting a shift that already exists
 * on the server still goes straight to the API, so `mode: "merge"` is the normal
 * save and existing shifts are never wiped or re-written.
 */

/** SSR-safe no-op storage — same shim as `lib/store/selected-store.store.ts`. */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Abandoned drafts expire rather than accumulating, as in `use-ticket-draft.ts`. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How a draft set should be submitted.
 *
 * `merge` adds the drafts alongside whatever is already in the week — the normal
 * case. `replace` wipes the week and rebuilds it from the drafts, which is only
 * correct for a Copy Previous Week set, where the drafts describe the WHOLE
 * intended week rather than a set of additions.
 */
export type DraftSaveMode = "merge" | "replace";

/**
 * A shift that exists only in the browser.
 *
 * Deliberately NOT a `Shift`: it has no `shiftId`, `durationMinutes`,
 * `syncStatus` or `origin`, because the server owns all four. Keeping the shapes
 * distinct is what stops a draft being mistaken for something addressable by the
 * update/delete endpoints.
 */
export interface DraftShift {
  /** Client-generated. Never sent to the server. */
  draftId: string;
  employeeId: string;
  /** Column index within the store's business week, 0-6. */
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  note?: string;
}

interface DraftWeek {
  shifts: DraftShift[];
  saveMode: DraftSaveMode;
  /** For the TTL sweep. */
  updatedAt: number;
}

/** Drafts belong to one store and one week; the key carries both. */
type DraftKey = string;

function keyFor(storeId: string, weekStart: string): DraftKey {
  return `${storeId}|${weekStart}`;
}

export function newDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ScheduleDraftState {
  weeks: Record<DraftKey, DraftWeek>;

  addDraft: (
    storeId: string,
    weekStart: string,
    shift: Omit<DraftShift, "draftId">,
  ) => void;
  updateDraft: (
    storeId: string,
    weekStart: string,
    draftId: string,
    patch: Partial<Omit<DraftShift, "draftId">>,
  ) => void;
  removeDraft: (storeId: string, weekStart: string, draftId: string) => void;
  /** Drop every draft for one week — used by Cancel and after a clean Save. */
  clearWeek: (storeId: string, weekStart: string) => void;
  /**
   * Overwrite a week's drafts wholesale. Used by Copy Previous Week, which sets
   * `saveMode: "replace"` because the copied set IS the intended week.
   */
  replaceWeek: (
    storeId: string,
    weekStart: string,
    shifts: Omit<DraftShift, "draftId">[],
    saveMode: DraftSaveMode,
  ) => void;
  /** Keep only the drafts that failed to save, so nothing is silently dropped. */
  keepOnly: (storeId: string, weekStart: string, draftIds: string[]) => void;
  /** Remove drafts older than the TTL. Called once on mount. */
  pruneExpired: () => void;
}

const EMPTY: DraftShift[] = [];

export const useScheduleDraftStore = create<ScheduleDraftState>()(
  persist(
    (set) => ({
      weeks: {},

      addDraft: (storeId, weekStart, shift) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          return {
            weeks: {
              ...state.weeks,
              [key]: {
                // A `+` draft added on top of a copy-week set keeps `replace`:
                // the intent is still "this is the week".
                saveMode: existing?.saveMode ?? "merge",
                shifts: [
                  ...(existing?.shifts ?? []),
                  { ...shift, draftId: newDraftId() },
                ],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateDraft: (storeId, weekStart, draftId, patch) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          return {
            weeks: {
              ...state.weeks,
              [key]: {
                ...existing,
                shifts: existing.shifts.map((s) =>
                  s.draftId === draftId ? { ...s, ...patch } : s,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeDraft: (storeId, weekStart, draftId) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          const shifts = existing.shifts.filter((s) => s.draftId !== draftId);
          const next = { ...state.weeks };
          // Drop the whole entry once empty, so localStorage does not fill with
          // empty week records.
          if (shifts.length === 0) delete next[key];
          else next[key] = { ...existing, shifts, updatedAt: Date.now() };
          return { weeks: next };
        }),

      clearWeek: (storeId, weekStart) =>
        set((state) => {
          const next = { ...state.weeks };
          delete next[keyFor(storeId, weekStart)];
          return { weeks: next };
        }),

      replaceWeek: (storeId, weekStart, shifts, saveMode) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const next = { ...state.weeks };
          if (shifts.length === 0) {
            delete next[key];
          } else {
            next[key] = {
              saveMode,
              shifts: shifts.map((s) => ({ ...s, draftId: newDraftId() })),
              updatedAt: Date.now(),
            };
          }
          return { weeks: next };
        }),

      keepOnly: (storeId, weekStart, draftIds) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          const keep = new Set(draftIds);
          const shifts = existing.shifts.filter((s) => keep.has(s.draftId));
          const next = { ...state.weeks };
          if (shifts.length === 0) delete next[key];
          else next[key] = { ...existing, shifts, updatedAt: Date.now() };
          return { weeks: next };
        }),

      pruneExpired: () =>
        set((state) => {
          const cutoff = Date.now() - DRAFT_TTL_MS;
          const next: Record<DraftKey, DraftWeek> = {};
          let changed = false;
          for (const [key, week] of Object.entries(state.weeks)) {
            if (week.updatedAt >= cutoff) next[key] = week;
            else changed = true;
          }
          return changed ? { weeks: next } : state;
        }),
    }),
    {
      name: "scheduling-drafts",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage,
      ),
      /**
       * A draft written by an older shape must be dropped, not rendered. A
       * half-understood draft would show shifts the manager cannot save.
       */
      migrate: (persisted, version) => {
        if (version < 1) return { weeks: {} };
        const state = persisted as { weeks?: unknown };
        if (!state?.weeks || typeof state.weeks !== "object") return { weeks: {} };
        return state as { weeks: Record<DraftKey, DraftWeek> };
      },
    },
  ),
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Selectors                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The drafts for one store-week.
 *
 * Returns a shared frozen empty array when there are none, so the memos that
 * consume it are not invalidated on every render.
 */
export function useWeekDrafts(
  storeId: string | null,
  weekStart: string,
): DraftShift[] {
  return useScheduleDraftStore((s) =>
    storeId ? (s.weeks[keyFor(storeId, weekStart)]?.shifts ?? EMPTY) : EMPTY,
  );
}

export function useWeekDraftSaveMode(
  storeId: string | null,
  weekStart: string,
): DraftSaveMode {
  return useScheduleDraftStore((s) =>
    storeId
      ? (s.weeks[keyFor(storeId, weekStart)]?.saveMode ?? "merge")
      : "merge",
  );
}

/** True when ANY week for this store has unsaved drafts — used by the page guard. */
export function useHasAnyDrafts(storeId: string | null): boolean {
  return useScheduleDraftStore((s) => {
    if (!storeId) return false;
    const prefix = `${storeId}|`;
    return Object.entries(s.weeks).some(
      ([key, week]) => key.startsWith(prefix) && week.shifts.length > 0,
    );
  });
}
