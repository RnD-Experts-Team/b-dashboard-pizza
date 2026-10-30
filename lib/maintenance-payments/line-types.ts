/**
 * The payment line-type catalogue: which fields each type shows
 * (docs/MAINTENANCE-V2-UI.md §5 "Lines" — choosing a type reveals ONLY its
 * fields plus its one-sentence explanation from the vocabulary).
 *
 * Every line has exactly one place: a store (or a typed "other store"), or —
 * parts going into storage only — a storage location.
 */

import { PAYMENT_LINE_TYPES, type VocabEntry } from "@/lib/maintenance/vocabulary";
import type { PaymentLineType } from "@/types/maintenance-v2";

/** The draft fields a line card can show. */
export type LineField =
  | "place"
  | "description"
  | "amount"
  | "sessions"
  | "hours"
  | "rate"
  | "part"
  | "quantity"
  | "unitCost"
  | "boughtFrom"
  | "destination"
  | "storageLocation"
  | "storagePlace"
  | "serials"
  | "technicianPurchases"
  | "gasMode"
  | "miles"
  | "inspection"
  | "tickets";

export interface LineTypeSpec {
  type: PaymentLineType;
  vocab: VocabEntry<PaymentLineType>;
  /** Fields in the order the card shows them. */
  fields: readonly LineField[];
  /** Fields the server needs for this type (on top of the place). */
  required: readonly LineField[];
  /** How the amount comes about, for the preview. */
  amountFrom: "sent" | "hours_x_rate" | "quantity_x_unit_cost" | "sent_or_miles_x_rate";
}

export const LINE_TYPES = {
  hourly: {
    type: "hourly",
    vocab: PAYMENT_LINE_TYPES.hourly,
    fields: ["place", "sessions", "hours", "rate", "tickets", "description"],
    required: [],
    amountFrom: "hours_x_rate",
  },
  fixed: {
    type: "fixed",
    vocab: PAYMENT_LINE_TYPES.fixed,
    fields: ["place", "amount", "tickets", "description"],
    required: ["amount"],
    amountFrom: "sent",
  },
  inspection: {
    type: "inspection",
    vocab: PAYMENT_LINE_TYPES.inspection,
    fields: ["place", "amount", "tickets", "inspection", "description"],
    required: ["amount"],
    amountFrom: "sent",
  },
  parts: {
    type: "parts",
    vocab: PAYMENT_LINE_TYPES.parts,
    fields: [
      "part",
      "quantity",
      "unitCost",
      "boughtFrom",
      "destination",
      "storageLocation",
      "storagePlace",
      "place",
      "tickets",
      "serials",
      "technicianPurchases",
    ],
    required: ["part", "quantity", "unitCost", "destination"],
    amountFrom: "quantity_x_unit_cost",
  },
  gas: {
    type: "gas",
    vocab: PAYMENT_LINE_TYPES.gas,
    fields: ["place", "gasMode", "amount", "miles", "rate", "tickets", "description"],
    required: [],
    amountFrom: "sent_or_miles_x_rate",
  },
  other: {
    type: "other",
    vocab: PAYMENT_LINE_TYPES.other,
    fields: ["place", "description", "amount", "tickets"],
    required: ["description", "amount"],
    amountFrom: "sent",
  },
} as const satisfies Record<PaymentLineType, LineTypeSpec>;

export const LINE_TYPE_ORDER = ["hourly", "fixed", "inspection", "parts", "gas", "other"] as const satisfies readonly PaymentLineType[];

export function lineTypeSpec(type: PaymentLineType): LineTypeSpec {
  return LINE_TYPES[type];
}

export function lineShows(type: PaymentLineType, field: LineField): boolean {
  return (LINE_TYPES[type].fields as readonly LineField[]).includes(field);
}
