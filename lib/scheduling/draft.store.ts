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
 * Editing or deleting a shift that already exists on the server still goes
 * straight to the API, so `mode: "merge"` is the normal save and existing shifts
 * are never wiped or re-written.
 *
 * ONE exception to "only additions": MOVING a saved shift by dragging it. That
 * is a deletion and an addition at once, and it is staged like everything else
 * here — the original is recorded as a pending REMOVAL (hidden on screen, still
 * on the server) and a draft stands in for it at the new place. Save creates the
 * draft first and deletes the original afterwards, so a failure can leave a
 * duplicate but never lose the shift.
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
 * A shift the manager has laid out but not saved.
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
  /**
   * Set when this draft is a MOVED saved shift: the assignment id of the pending
   * removal it stands in for. It is what lets the Save bar count a move as one
   * change rather than two. Never sent to the server.
   */
  replacesId?: string;
}

/**
 * A saved shift that is hidden on screen and will be deleted on Save — the
 * "from" half of a move. Keeps the original's place and details so that
 * dragging the moved shift back can cancel the move.
 */
export interface RemovedShift {
  /** ASSIGNMENT id — what the card carries, so what is hidden. */
  id: string;
  /** SHIFT id — what the delete endpoint addresses. */
  shiftId: string;
  employeeId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
}

interface DraftWeek {
  shifts: DraftShift[];
  /** Saved shifts pending deletion because they were moved. */
  removed: RemovedShift[];
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

/**
 * Put a week back in the map, or drop its entry once it holds nothing — so
 * localStorage does not fill with empty week records.
 */
function withWeek(
  weeks: Record<DraftKey, DraftWeek>,
  key: DraftKey,
  week: DraftWeek,
): Record<DraftKey, DraftWeek> {
  const next = { ...weeks };
  if (week.shifts.length === 0 && week.removed.length === 0) delete next[key];
  else next[key] = { ...week, updatedAt: Date.now() };
  return next;
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
  /**
   * Move an unsaved draft to another cell. Dropping a MOVED draft back on the
   * cell its original came from, unchanged, cancels the move instead (both the
   * draft and the pending removal go). Returns true when it did that.
   */
  moveDraft: (
    storeId: string,
    weekStart: string,
    draftId: string,
    target: { employeeId: string; dayIndex: number },
  ) => boolean;
  /**
   * Move a SAVED shift: hide the original (pending removal) and add the draft
   * that stands in for it at the new place.
   */
  moveSavedShift: (
    storeId: string,
    weekStart: string,
    removal: RemovedShift,
    draft: Omit<DraftShift, "draftId" | "replacesId">,
  ) => void;
  /** Drop every draft AND pending removal for one week — Cancel. */
  clearWeek: (storeId: string, weekStart: string) => void;
  /**
   * A save was accepted: the drafts are on their way to the server, but the
   * pending removals are not done yet, so they stay.
   */
  settleDrafts: (storeId: string, weekStart: string) => void;
  /** Forget pending removals: the given assignment ids, or all of them. */
  clearRemovals: (storeId: string, weekStart: string, ids?: string[]) => void;
  /**
   * Overwrite a week's drafts wholesale. Used by Copy Previous Week, which sets
   * `saveMode: "replace"` because the copied set IS the intended week — so any
   * pending removals go too, unless `keepRemovals` says this is a restore.
   */
  replaceWeek: (
    storeId: string,
    weekStart: string,
    shifts: Omit<DraftShift, "draftId">[],
    saveMode: DraftSaveMode,
    options?: { keepRemovals?: boolean },
  ) => void;
  /** Keep only the drafts that failed to save, so nothing is silently dropped. */
  keepOnly: (storeId: string, weekStart: string, draftIds: string[]) => void;
  /** Remove drafts older than the TTL. Called once on mount. */
  pruneExpired: () => void;
}

const EMPTY: DraftShift[] = [];
const EMPTY_REMOVED: RemovedShift[] = [];

export const useScheduleDraftStore = create<ScheduleDraftState>()(
  persist(
    (set) => ({
      weeks: {},

      addDraft: (storeId, weekStart, shift) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          return {
            weeks: withWeek(state.weeks, key, {
              // A `+` draft added on top of a copy-week set keeps `replace`:
              // the intent is still "this is the week".
              saveMode: existing?.saveMode ?? "merge",
              removed: existing?.removed ?? [],
              shifts: [
                ...(existing?.shifts ?? []),
                { ...shift, draftId: newDraftId() },
              ],
              updatedAt: 0,
            }),
          };
        }),

      updateDraft: (storeId, weekStart, draftId, patch) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              shifts: existing.shifts.map((s) =>
                s.draftId === draftId ? { ...s, ...patch } : s,
              ),
            }),
          };
        }),

      removeDraft: (storeId, weekStart, draftId) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              shifts: existing.shifts.filter((s) => s.draftId !== draftId),
            }),
          };
        }),

      moveDraft: (storeId, weekStart, draftId, target) => {
        let undone = false;
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          const draft = existing?.shifts.find((s) => s.draftId === draftId);
          if (!existing || !draft) return state;

          const removal = draft.replacesId
            ? existing.removed.find((r) => r.id === draft.replacesId)
            : undefined;
          const backHome =
            removal !== undefined &&
            removal.employeeId === target.employeeId &&
            removal.dayIndex === target.dayIndex &&
            removal.startTime === draft.startTime &&
            removal.endTime === draft.endTime &&
            removal.label === draft.label;

          if (backHome) {
            undone = true;
            return {
              weeks: withWeek(state.weeks, key, {
                ...existing,
                shifts: existing.shifts.filter((s) => s.draftId !== draftId),
                removed: existing.removed.filter((r) => r.id !== removal.id),
              }),
            };
          }

          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              shifts: existing.shifts.map((s) =>
                s.draftId === draftId
                  ? {
                      ...s,
                      employeeId: target.employeeId,
                      dayIndex: target.dayIndex,
                    }
                  : s,
              ),
            }),
          };
        });
        return undone;
      },

      moveSavedShift: (storeId, weekStart, removal, draft) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          return {
            weeks: withWeek(state.weeks, key, {
              saveMode: existing?.saveMode ?? "merge",
              removed: [
                ...(existing?.removed ?? []).filter((r) => r.id !== removal.id),
                removal,
              ],
              shifts: [
                ...(existing?.shifts ?? []),
                { ...draft, draftId: newDraftId(), replacesId: removal.id },
              ],
              updatedAt: 0,
            }),
          };
        }),

      clearWeek: (storeId, weekStart) =>
        set((state) => {
          const next = { ...state.weeks };
          delete next[keyFor(storeId, weekStart)];
          return { weeks: next };
        }),

      settleDrafts: (storeId, weekStart) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              shifts: [],
              saveMode: "merge",
            }),
          };
        }),

      clearRemovals: (storeId, weekStart, ids) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          const drop = ids ? new Set(ids) : null;
          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              removed: drop
                ? existing.removed.filter((r) => !drop.has(r.id))
                : [],
              // A draft that stood in for a forgotten removal is just a shift now.
              shifts: existing.shifts.map((s) =>
                s.replacesId && (!drop || drop.has(s.replacesId))
                  ? { ...s, replacesId: undefined }
                  : s,
              ),
            }),
          };
        }),

      replaceWeek: (storeId, weekStart, shifts, saveMode, options) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          return {
            weeks: withWeek(state.weeks, key, {
              saveMode,
              removed: options?.keepRemovals
                ? (state.weeks[key]?.removed ?? [])
                : [],
              shifts: shifts.map((s) => ({ ...s, draftId: newDraftId() })),
              updatedAt: 0,
            }),
          };
        }),

      keepOnly: (storeId, weekStart, draftIds) =>
        set((state) => {
          const key = keyFor(storeId, weekStart);
          const existing = state.weeks[key];
          if (!existing) return state;
          const keep = new Set(draftIds);
          return {
            weeks: withWeek(state.weeks, key, {
              ...existing,
              shifts: existing.shifts.filter((s) => keep.has(s.draftId)),
            }),
          };
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
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage,
      ),
      /**
       * A draft written by an older shape must be dropped, not rendered. A
       * half-understood draft would show shifts the manager cannot save.
       *
       * Version 1 -> 2 only ADDED `removed`, so those weeks are kept and given
       * an empty list.
       */
      migrate: (persisted, version) => {
        if (version < 1) return { weeks: {} };
        const state = persisted as { weeks?: unknown };
        if (!state?.weeks || typeof state.weeks !== "object") return { weeks: {} };
        const weeks: Record<DraftKey, DraftWeek> = {};
        for (const [key, week] of Object.entries(
          state.weeks as Record<DraftKey, Partial<DraftWeek>>,
        )) {
          weeks[key] = {
            ...(week as DraftWeek),
            removed: Array.isArray(week.removed) ? week.removed : [],
          };
        }
        return { weeks };
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

/** The saved shifts of one store-week that were moved and await deletion on Save. */
export function useWeekRemovals(
  storeId: string | null,
  weekStart: string,
): RemovedShift[] {
  return useScheduleDraftStore((s) =>
    storeId
      ? (s.weeks[keyFor(storeId, weekStart)]?.removed ?? EMPTY_REMOVED)
      : EMPTY_REMOVED,
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

/**
 * How many changes a week is waiting to save. A moved saved shift is ONE change
 * even though it is a draft plus a removal underneath; a removal whose draft was
 * deleted afterwards still counts, because it is still going to be deleted.
 */
export function countChanges(
  drafts: DraftShift[],
  removals: RemovedShift[],
): number {
  const claimed = new Set(drafts.map((d) => d.replacesId).filter(Boolean));
  return drafts.length + removals.filter((r) => !claimed.has(r.id)).length;
}

/** True when ANY week for this store has unsaved changes — used by the page guard. */
export function useHasAnyDrafts(storeId: string | null): boolean {
  return useScheduleDraftStore((s) => {
    if (!storeId) return false;
    const prefix = `${storeId}|`;
    return Object.entries(s.weeks).some(
      ([key, week]) =>
        key.startsWith(prefix) &&
        (week.shifts.length > 0 || week.removed.length > 0),
    );
  });
}
