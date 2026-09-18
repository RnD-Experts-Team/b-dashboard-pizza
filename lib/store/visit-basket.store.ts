"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The visit basket: issues one technician covered on one trip.
 *
 * The twin of the pay basket, and deliberately the same shape and the same
 * gesture -- "Add to visit" sits beside "Pay for this" and behaves identically.
 * You collect as you go, then log the hours once across everything in it.
 *
 * This is what replaced the Log visit button. That button opened a dialog with
 * its own issue picker, so you had to leave the ticket, remember what you were
 * doing, and find the issues again from a list. Collecting them where you find
 * them is the same job with the searching removed.
 *
 * ONE ATTENDANCE ENTRY COVERS ONE STORE. A clock window is a paid segment
 * attributable to one store -- that is where its expense lands -- so a basket
 * spanning stores cannot be logged as a single visit, and the panel says so
 * rather than quietly filing it against the wrong one.
 */

export interface VisitBasketItem {
  issueId: number;
  ticketId: number;
  /** store_number, or null for an "other store" ticket. */
  storeId: string | null;
  otherStore: string | null;
  title: string;
}

interface VisitBasketState {
  items: VisitBasketItem[];
  add: (item: VisitBasketItem) => void;
  remove: (issueId: number) => void;
  toggle: (item: VisitBasketItem) => void;
  has: (issueId: number) => boolean;
  clear: () => void;
  /** The distinct stores represented. More than one means it cannot be a single
   *  visit -- see the note above. */
  stores: () => Array<{ storeId: string | null; otherStore: string | null }>;
}

export const useVisitBasketStore = create<VisitBasketState>()(
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

      stores: () => {
        const seen = new Map<string, { storeId: string | null; otherStore: string | null }>();
        for (const item of get().items) {
          const key = item.storeId ?? `other:${item.otherStore ?? ""}`;
          if (!seen.has(key)) {
            seen.set(key, { storeId: item.storeId, otherStore: item.otherStore });
          }
        }
        return Array.from(seen.values());
      },
    }),
    {
      name: "maintenance-visit-basket",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
