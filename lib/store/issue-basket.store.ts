"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The work basket: issues picked up from anywhere, acted on together.
 *
 * A technician's day is one trip across several stores and several tickets, and
 * the three things that genuinely need doing in bulk -- booking someone, logging
 * one visit, and moving statuses -- all cross ticket boundaries. The list shows
 * tickets, not issues, and fetching every ticket's issues just to draw a
 * checkbox beside each would cost a request per row.
 *
 * So the basket travels instead: tick issues as you come across them, then act
 * on the whole lot once. The upstream endpoints already accept many issue ids in
 * one call -- POST /assignments, POST /issues/status and the global
 * POST /attendance-entries all do -- so this is one request, not one per issue.
 *
 * Persisted because it is a working set, not a view: picking up four issues and
 * losing them to a refresh would be worse than not offering it.
 */

export interface BasketIssue {
  issueId: number;
  ticketId: number;
  /** store_number -- the route key writes bind on, not the numeric id. */
  storeId: string;
  /** Free-text location for a ticket with no replicated store. Carried so
   *  tipping the basket into pay does not lose where the work was. */
  otherStore: string | null;
  title: string;
  /** Shown in the basket so a ticket with four similar issues is still legible. */
  storeLabel: string;
  /** Who is owed, when the issue has exactly one technician. Carried so the
   *  pay basket gets a payee from here too, not only from the ticket page. */
  technicianId: number | null;
  technicianName: string | null;
}

interface IssueBasketState {
  items: BasketIssue[];
  add: (item: BasketIssue) => void;
  remove: (issueId: number) => void;
  toggle: (item: BasketIssue) => void;
  has: (issueId: number) => boolean;
  clear: () => void;
  /**
   * The stores represented. Attendance is filed per store -- one entry covers
   * many tickets of ONE store, because that is where the expense lands -- so a
   * basket spanning stores cannot be logged as a single visit, and the bar says
   * so rather than silently filing it against the wrong one.
   */
  storeIds: () => string[];
}

export const useIssueBasketStore = create<IssueBasketState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item) =>
        set((state) =>
          state.items.some((i) => i.issueId === item.issueId)
            ? state
            : { items: [...state.items, item] }
        ),

      remove: (issueId) =>
        set((state) => ({ items: state.items.filter((i) => i.issueId !== issueId) })),

      toggle: (item) =>
        set((state) =>
          state.items.some((i) => i.issueId === item.issueId)
            ? { items: state.items.filter((i) => i.issueId !== item.issueId) }
            : { items: [...state.items, item] }
        ),

      has: (issueId) => get().items.some((i) => i.issueId === issueId),

      clear: () => set({ items: [] }),

      storeIds: () => Array.from(new Set(get().items.map((i) => i.storeId))).filter(Boolean),
    }),
    {
      name: "maintenance-issue-basket",
      storage: createJSONStorage(() => localStorage),
      // Only the items. The functions are rebuilt on load.
      partialize: (state) => ({ items: state.items }),
    }
  )
);
