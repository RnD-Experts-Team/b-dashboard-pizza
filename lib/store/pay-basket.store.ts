"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The pay basket: work marked for payment, gathered up before a sheet is made.
 *
 * Asked for directly -- "maybe have it added to a sheet that gets ready to be
 * filled with us adding different tickets, with a view of its own so things
 * don't complicate each other".
 *
 * That is the right shape, because filling a pay sheet is the one job in this
 * system that is genuinely assembled over time: you learn what Ahmad did at
 * store 42 in the morning and what he did at store 7 in the afternoon hours
 * apart. Today the only way to record that is to open the Daily Pay dialog, add
 * a payment, add a line, then open a SECOND dialog inside it to pick the
 * issues -- for each store, from memory, having left the ticket behind.
 *
 * So the ticket says "pay for this" and the sheet gets made from what was
 * collected. Held in the browser, like `use-ticket-draft` already does for
 * half-filled ticket forms: it is free, it survives a refresh, and it is one
 * coordinator's working set rather than shared state. A real draft on the
 * backend is the upgrade if more than one person ever shares the job.
 */

export interface PayBasketItem {
  issueId: number;
  ticketId: number;
  /** store_number, or null for an "other store" ticket. */
  storeId: string | null;
  /** Free-text location, when the ticket has no replicated store. */
  otherStore: string | null;
  title: string;
  /** Who it is for, when the ticket already knows. Null means ask later. */
  technicianId: number | null;
  technicianName: string | null;
}

interface PayBasketState {
  items: PayBasketItem[];
  add: (item: PayBasketItem) => void;
  remove: (issueId: number) => void;
  toggle: (item: PayBasketItem) => void;
  has: (issueId: number) => boolean;
  clear: () => void;
  /**
   * Grouped the way a pay sheet is actually shaped: one payment per payee, one
   * line per store inside it. Issues whose technician is unknown are collected
   * under `null` so the view can ask once rather than per issue.
   */
  groupForSheet: () => Array<{
    technicianId: number | null;
    technicianName: string | null;
    stores: Array<{
      storeId: string | null;
      otherStore: string | null;
      issueIds: number[];
    }>;
  }>;
}

export const usePayBasketStore = create<PayBasketState>()(
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

      groupForSheet: () => {
        const byPayee = new Map<
          string,
          {
            technicianId: number | null;
            technicianName: string | null;
            stores: Map<string, { storeId: string | null; otherStore: string | null; issueIds: number[] }>;
          }
        >();

        for (const item of get().items) {
          const payeeKey = String(item.technicianId ?? "unknown");
          let payee = byPayee.get(payeeKey);
          if (!payee) {
            payee = {
              technicianId: item.technicianId,
              technicianName: item.technicianName,
              stores: new Map(),
            };
            byPayee.set(payeeKey, payee);
          }

          // A store line is keyed by the store, or by the free text when there
          // is none -- upstream requires exactly one of the two per line.
          const storeKey = item.storeId ?? `other:${item.otherStore ?? ""}`;
          const store = payee.stores.get(storeKey);
          if (store) store.issueIds.push(item.issueId);
          else
            payee.stores.set(storeKey, {
              storeId: item.storeId,
              otherStore: item.storeId ? null : item.otherStore,
              issueIds: [item.issueId],
            });
        }

        return Array.from(byPayee.values()).map((payee) => ({
          technicianId: payee.technicianId,
          technicianName: payee.technicianName,
          stores: Array.from(payee.stores.values()),
        }));
      },
    }),
    {
      name: "maintenance-pay-basket",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
