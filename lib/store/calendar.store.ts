"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CATEGORY_KEYS, type CalendarScope, type CategoryKey } from "@/lib/calendar/types";

/**
 * Calendar UI preferences — only what should survive a reload.
 *
 * View and date are NOT here: they live in the page URL (`?view=&date=`) so
 * the topbar can deep-link and the back button works. The search query is
 * page-local state and never persisted.
 */
interface CalendarPrefsState {
  /** Visible event categories. All of them = no filter. */
  filters: CategoryKey[];
  /** "YYYY-MM-DD" the topbar badge was last cleared ("Mark all seen"). */
  seenDay: string | null;
  scope: CalendarScope;
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
  setScope: (scope: CalendarScope) => void;
  bumpRevision: () => void;
}

export const useCalendarStore = create<CalendarPrefsState>()(
  persist(
    (set) => ({
      filters: [...CATEGORY_KEYS],
      seenDay: null,
      scope: "store",
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
      setScope: (scope) => set({ scope }),
      bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
    }),
    {
      name: "calendar-prefs",
      storage: createJSONStorage(() => localStorage),
      // v1 added the "other" category. Someone who had every type on (the
      // default) should see it too, not have it silently filtered out.
      version: 1,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<CalendarPrefsState>;
        if (version < 1 && Array.isArray(p.filters)) {
          const before = CATEGORY_KEYS.filter((k) => k !== "other");
          if (before.every((k) => p.filters!.includes(k))) p.filters = [...p.filters, "other"];
        }
        return p as CalendarPrefsState;
      },
      partialize: (s) => ({ filters: s.filters, seenDay: s.seenDay, scope: s.scope }),
      // Drop category keys that no longer exist after a taxonomy change.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CalendarPrefsState>;
        return {
          ...current,
          ...p,
          filters: Array.isArray(p.filters)
            ? CATEGORY_KEYS.filter((k) => p.filters!.includes(k))
            : current.filters,
          scope: p.scope === "all" ? "all" : "store",
        };
      },
    },
  ),
);
