"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CATEGORY_KEYS, type CategoryKey } from "@/lib/calendar/types";
import { isStoreCode } from "@/lib/calendar/feed-types";

/**
 * Calendar UI preferences — only what should survive a reload.
 *
 * View and date are NOT here: they live in the page URL (`?view=&date=`) so
 * the topbar can deep-link and the back button works. The search query is
 * page-local and never persisted.
 */
interface CalendarPrefsState {
  /** Visible event categories. All of them = no filter. */
  filters: CategoryKey[];
  /** "YYYY-MM-DD" the topbar badge was last cleared ("Mark all seen"). */
  seenDay: string | null;
  /**
   * Store numbers the Calendar page shows. `null` = just the dashboard's
   * selected store, following it when it changes (the default). Set only when
   * the user picks other stores; picking exactly the dashboard store clears it.
   */
  storeCodes: string[] | null;
  /**
   * Bumped after every create/update/delete so each open view (page, topbar)
   * refetches. Not persisted.
   */
  revision: number;

  toggleCategory: (key: CategoryKey) => void;
  onlyCategory: (key: CategoryKey) => void;
  showAll: () => void;
  hideAll: () => void;
  markSeen: (day: string) => void;
  setStoreCodes: (codes: string[] | null) => void;
  bumpRevision: () => void;
}

export const useCalendarStore = create<CalendarPrefsState>()(
  persist(
    (set) => ({
      filters: [...CATEGORY_KEYS],
      seenDay: null,
      storeCodes: null,
      revision: 0,

      toggleCategory: (key) =>
        set((s) => ({
          filters: s.filters.includes(key)
            ? s.filters.filter((k) => k !== key)
            : CATEGORY_KEYS.filter((k) => k === key || s.filters.includes(k)),
        })),
      onlyCategory: (key) => set({ filters: [key] }),
      showAll: () => set({ filters: [...CATEGORY_KEYS] }),
      hideAll: () => set({ filters: [] }),
      markSeen: (day) => set({ seenDay: day }),
      setStoreCodes: (codes) => set({ storeCodes: codes && codes.length ? [...codes] : null }),
      bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
    }),
    {
      name: "calendar-prefs",
      storage: createJSONStorage(() => localStorage),
      // v1 added the "other" category; v2 added the feed categories (dough,
      // data, inventory, tasks, reminders, sales); v3 replaced the "only this
      // store" switch (`scope`) with the store selection (`storeCodes`).
      // Someone who had every type on (the default) should see new categories
      // too, not have them silently filtered out. An old `scope: "all"` is
      // dropped: it only ever meant "load everything", not a chosen set.
      version: 3,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<CalendarPrefsState> & { scope?: unknown };
        const v0: CategoryKey[] = ["birthday", "cleaning", "shift", "milestone", "maintenance", "meeting"];
        const v1: CategoryKey[] = [...v0, "other"];
        if (version < 1 && Array.isArray(p.filters)) {
          if (v0.every((k) => p.filters!.includes(k))) p.filters = [...p.filters, "other"];
        }
        if (version < 2 && Array.isArray(p.filters)) {
          if (v1.every((k) => p.filters!.includes(k))) p.filters = [...CATEGORY_KEYS];
        }
        delete p.scope;
        return p as CalendarPrefsState;
      },
      partialize: (s) => ({ filters: s.filters, seenDay: s.seenDay, storeCodes: s.storeCodes }),
      // Drop category keys that no longer exist after a taxonomy change, and
      // anything in the saved store list that isn't a store number.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CalendarPrefsState>;
        const codes = Array.isArray(p.storeCodes) ? p.storeCodes.filter(isStoreCode) : [];
        return {
          ...current,
          filters: Array.isArray(p.filters) ? CATEGORY_KEYS.filter((k) => p.filters!.includes(k)) : current.filters,
          seenDay: typeof p.seenDay === "string" ? p.seenDay : current.seenDay,
          storeCodes: codes.length ? codes : null,
        };
      },
    },
  ),
);
