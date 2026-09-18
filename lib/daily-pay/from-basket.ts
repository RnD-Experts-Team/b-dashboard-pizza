/**
 * Turning the pay basket into a pay sheet.
 *
 * The basket knows what work is owed for and who did it. That is exactly the
 * three-level shape a sheet already has -- entry, then one payment per payee,
 * then one line per store -- so building the form from it is a regrouping, not
 * a conversion.
 *
 * What this saves is the worst interaction in the feature: opening the entry
 * dialog, adding a payment, adding a line, then opening a SECOND dialog inside
 * it to pick issues, per store, from memory, having left the ticket behind.
 * With the basket the issues arrive already linked and the inner dialog has
 * nothing left to do.
 *
 * Nothing is saved by this. It fills the form and the coordinator reviews it --
 * the same discipline as everywhere else in this redesign: automate the
 * typing, never the decision.
 *
 * Pure: no React, no service calls.
 */

import type { PayBasketItem } from "@/lib/store/pay-basket.store";
import {
  emptyEntryFormState,
  emptyLine,
  emptyPayment,
  todayIso,
  type EntryFormState,
  type LineForm,
  type PaymentForm,
} from "./entry-form-state";

export interface BasketGroup {
  technicianId: number | null;
  technicianName: string | null;
  stores: Array<{
    storeId: string | null;
    otherStore: string | null;
    issueIds: number[];
  }>;
}

/**
 * @param groups  From `usePayBasketStore.groupForSheet()`.
 * @param stores  The store list the form's select is built from. Needed
 *                because the basket carries the STORE NUMBER (what tickets
 *                and routes bind on) while the line select is keyed by the
 *                internal numeric id -- so without this translation the
 *                prefilled store matched no option and showed blank.
 * @param date    The workday. Defaults to today; the caller should let the user
 *                change it, because a visit is often entered the morning after.
 */
export function entryFormFromBasket(
  groups: BasketGroup[],
  stores: ReadonlyArray<{ id: number; storeNumber: string }>,
  date: string = todayIso()
): EntryFormState {
  const base = emptyEntryFormState();
  const idByNumber = new Map(stores.map((s) => [s.storeNumber, String(s.id)]));

  const payments: PaymentForm[] = groups.map((group) => {
    const payment = emptyPayment();
    // Left blank when the basket does not know the payee -- an issue can be
    // picked up for payment before anyone has been attached to it. Blank makes
    // the form ask; a guess would be worse than a gap.
    payment.technicianId = group.technicianId != null ? String(group.technicianId) : "";

    payment.lines = group.stores.map((store) => {
      const line: LineForm = emptyLine();
      const resolved = store.storeId ? idByNumber.get(store.storeId) : undefined;
      if (resolved) {
        line.locationKind = "store";
        line.storeId = resolved;
      } else {
        // No replicated store, OR a store number the select does not offer
        // (retired, or not in this user's list). Either way the location is
        // kept as text rather than silently dropped -- a blank store on a pay
        // line is a question, a wrong one is somebody else's money.
        line.locationKind = "other";
        line.otherStore = store.otherStore ?? store.storeId ?? "";
      }
      line.ticketIssueIds = store.issueIds;
      // Hours deliberately left empty. Sending any value marks the line
      // `hoursOverridden` upstream and Recalculate will skip it forever --
      // including a typed 0, which counts as an override, not as "unset".
      // Empty means the gather fills them from the attendance already logged,
      // which is the whole point of having logged it.
      return line;
    });

    // A payee with nothing attached still needs one line to be valid upstream.
    if (payment.lines.length === 0) payment.lines = [emptyLine()];

    return payment;
  });

  return {
    ...base,
    date,
    payments: payments.length > 0 ? payments : base.payments,
  };
}

/** How many issues, payees and stores the basket will produce. For the
 *  "you are about to make a sheet with…" line, so nothing is a surprise. */
export function describeBasket(items: PayBasketItem[]): {
  issues: number;
  payees: number;
  stores: number;
  unknownPayees: number;
} {
  const payees = new Set<string>();
  const stores = new Set<string>();
  let unknownPayees = 0;

  for (const item of items) {
    if (item.technicianId == null) unknownPayees += 1;
    payees.add(String(item.technicianId ?? "unknown"));
    stores.add(item.storeId ?? `other:${item.otherStore ?? ""}`);
  }

  return {
    issues: items.length,
    payees: payees.size,
    stores: stores.size,
    unknownPayees,
  };
}
