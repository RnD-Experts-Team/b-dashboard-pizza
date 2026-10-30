/* ────────────────────────────────────────────────────────────────────────── */
/*  What a caller can fill in before the payment dialog opens                */
/*                                                                            */
/*  The ticket page ("Record a payment" on Costs), the Storage page ("Record */
/*  stock → Parts bought") and the Unpaid work panel ("Pay this") open the   */
/*  same dialog. They say what they know; this turns it into a first draft. */
/*  `storeId` is the numeric stores.id — never the store number.             */
/* ────────────────────────────────────────────────────────────────────────── */

import {
  draftForPartsToStorage,
  emptyPaymentDraft,
  newLine,
  type PaidToChoice,
  type PaymentDraft,
  type PaymentLineDraft,
} from "@/lib/maintenance-payments/form-state";

export type PaymentPrefill = {
  technicianId?: number;
  supplierId?: number;
  /** Numeric stores.id. */
  storeId?: number;
  otherStore?: string;
  storageLocationId?: number;
  ticketIssueIds?: number[];
  /** Ready-made lines (e.g. from draftFromUnpaidWork). Win over everything below. */
  lines?: PaymentLineDraft[];
  /** One parts line going into storage (at storageLocationId when given). */
  partsIntoStorage?: boolean;
};

/** Who is paid, before the catalog has loaded (the name fills in later). */
export function paidToFromPrefill(prefill: PaymentPrefill | undefined): PaidToChoice | null {
  if (prefill?.technicianId) return { type: "technician", id: prefill.technicianId, name: "" };
  if (prefill?.supplierId) return { type: "supplier", id: prefill.supplierId, name: "" };
  return null;
}

/** The first draft for a new payment. */
export function draftFromPrefill(today: string, prefill: PaymentPrefill | undefined): PaymentDraft {
  const paidTo = paidToFromPrefill(prefill);
  if (prefill?.lines?.length) {
    return { ...emptyPaymentDraft(today), paidTo, lines: prefill.lines };
  }
  if (prefill?.partsIntoStorage) {
    return { ...draftForPartsToStorage(today, prefill.storageLocationId ?? null), paidTo };
  }
  const hasPlace = prefill?.storeId != null || Boolean(prefill?.otherStore) || (prefill?.ticketIssueIds?.length ?? 0) > 0;
  if (!hasPlace) return { ...emptyPaymentDraft(today), paidTo };
  return {
    ...emptyPaymentDraft(today),
    paidTo,
    lines: [
      newLine("fixed", {
        storeId: prefill?.storeId ?? null,
        otherStore: prefill?.otherStore ?? "",
        ticketIssueIds: prefill?.ticketIssueIds ?? [],
      }),
    ],
  };
}

/**
 * Fills in what the catalog knows about the person paid (name, hourly rate)
 * without counting as a change. Lines are left alone: a rate the person
 * cleared to retype must not snap back.
 */
export function hydratePaidTo(draft: PaymentDraft, known: PaidToChoice | null): PaymentDraft {
  if (!draft.paidTo || !known || known.type !== draft.paidTo.type || known.id !== draft.paidTo.id) return draft;
  return { ...draft, paidTo: { ...draft.paidTo, name: known.name, hourlyRate: known.hourlyRate ?? null } };
}

/**
 * A new person paid: their rate on hourly lines without a typed one, and the
 * previous technician's clocked time and purchases dropped (they cannot be
 * paid to someone else — the server would refuse them).
 */
export function changePaidTo(draft: PaymentDraft, next: PaidToChoice | null): PaymentDraft {
  const sameTech = draft.paidTo?.type === "technician" && next?.type === "technician" && draft.paidTo.id === next.id;
  const rate = next?.type === "technician" ? next.hourlyRate ?? "" : "";
  const prevRate = draft.paidTo?.type === "technician" ? draft.paidTo.hourlyRate ?? "" : "";
  return {
    ...draft,
    paidTo: next,
    lines: draft.lines.map((l) => {
      const keepRate = l.rate && l.rate !== prevRate;
      const withRate = l.type === "hourly" ? { ...l, rate: keepRate ? l.rate : rate } : l;
      return sameTech
        ? withRate
        : {
            ...withRate,
            tripSessionIds: [],
            technicianPurchaseIds: [],
            hours: withRate.hoursTyped ? withRate.hours : "",
          };
    }),
  };
}

/** Unsaved-changes check that ignores what loading the catalog filled in. */
export function draftSignature(draft: PaymentDraft): string {
  return JSON.stringify({
    ...draft,
    paidTo: draft.paidTo ? { type: draft.paidTo.type, id: draft.paidTo.id } : null,
    files: draft.files.map((f) => `${f.name}:${f.size}`),
    lines: draft.lines.map((l) => ({ ...l, uid: "" })),
  });
}
