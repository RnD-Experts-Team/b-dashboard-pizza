/* ────────────────────────────────────────────────────────────────────────── */
/*  The payment dialog's form state (docs/MAINTENANCE-UI.md §5)           */
/*                                                                            */
/*  One scrolling form: paid to · date · lines (each with its own notes and  */
/*  attachments) · attachments and notes · running total. Pure functions     */
/*  over a plain draft, so the dialog can keep it in useState and every rule */
/*  is here:                                                                  */
/*                                                                            */
/*   - lines add / remove / update, change type (keeps what still applies)   */
/*   - hourly: picking clocked sessions fills the hours; typing hours flags  */
/*     "typed over" (sent as `hours`, the server sets hours_overridden)      */
/*   - rate defaults to the technician's hourly rate                         */
/*   - prefill from unpaid work ("Pay this") and from a ticket               */
/*   - read a saved payment back for Edit (how we paid, reference and       */
/*     invoice # are no longer asked for; an edit sends back what was saved) */
/*   - the wire body: only the fields each type uses                         */
/*   - client-side checks keyed exactly like the server's 422s               */
/*                                                                            */
/*  The server computes every amount; previewLineAmount mirrors it.          */
/* ────────────────────────────────────────────────────────────────────────── */

import { decimalOr0, minutesToHours, parseDecimal, roundCents, toMoneyString } from "@/lib/maintenance/money";
import { lineErrorKey, rootErrorKey, type FormErrors } from "@/lib/maintenance-payments/field-errors";
import {
  emptyExtras,
  extrasFromSaved,
  lineExtrasInput,
  paymentExtrasInput,
  type ExtrasDraft,
} from "@/lib/maintenance-payments/extras";
import { lineShows } from "@/lib/maintenance-payments/line-types";
import type {
  EditPaymentInput,
  PaidToType,
  PartsDestination,
  Payment,
  PaymentInput,
  PaymentLineInput,
  PaymentLineType,
  PlaceAddressLine,
  UnpaidWork,
} from "@/types/maintenance-system";

/* ── Shapes ──────────────────────────────────────────────────────────────── */

export type GasMode = "amount" | "miles";

export interface PaymentLineDraft {
  /** Client-only identity for React keys. */
  uid: string;
  type: PaymentLineType;
  /** The store's numeric `stores.id` (NOT the store number) — what `store_id` takes. */
  storeId: string | number | null;
  otherStore: string;
  /** Parts into storage only. */
  storageLocationId: number | null;
  place: PlaceAddressLine[];
  description: string;
  amount: string;
  /** hourly */
  tripSessionIds: number[];
  hours: string;
  /** The person typed the hours instead of taking the sessions' paid time. */
  hoursTyped: boolean;
  rate: string;
  /** parts */
  partId: number | null;
  quantity: string;
  unitCost: string;
  boughtFromSupplierId: number | null;
  destination: PartsDestination | null;
  serials: string[];
  technicianPurchaseIds: number[];
  /** gas */
  gasMode: GasMode;
  miles: string;
  /** inspection */
  issueInspectionId: number | null;
  ticketIssueIds: number[];
  /** The line's own notes and attachments. */
  extras: ExtrasDraft;
}

export interface PaidToChoice {
  type: PaidToType;
  id: number;
  name: string;
  /** Technicians: the default hourly rate. */
  hourlyRate?: string | null;
}

export interface PaymentDraft {
  paidTo: PaidToChoice | null;
  paidAt: string;
  /** How we paid, from the editable list (optional). */
  paymentMethodId: number | null;
  reference: string;
  invoiceNumber: string;
  /** The payment's notes and attachments. */
  extras: ExtrasDraft;
  lines: PaymentLineDraft[];
  /** Set when editing; sent back for the 409 check. */
  expectedUpdatedAt?: string;
}

/** What the preview needs beyond the draft. */
export interface PreviewContext {
  /** Paid minutes per clocked session id (from unpaid sessions). */
  sessionPaidMinutes?: Record<number, number>;
}

/* ── Construction ────────────────────────────────────────────────────────── */

/** Base-36 keeps the client-only line ids short. */
const UID_RADIX = 36;
let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `line-${Date.now().toString(UID_RADIX)}-${uidCounter}`;
}

export function newLine(type: PaymentLineType, init: Partial<Omit<PaymentLineDraft, "uid" | "type">> = {}): PaymentLineDraft {
  return {
    uid: nextUid(),
    type,
    storeId: null,
    otherStore: "",
    storageLocationId: null,
    place: [],
    description: "",
    amount: "",
    tripSessionIds: [],
    hours: "",
    hoursTyped: false,
    rate: "",
    partId: null,
    quantity: "",
    unitCost: "",
    boughtFromSupplierId: null,
    destination: type === "parts" ? "ticket" : null,
    serials: [],
    technicianPurchaseIds: [],
    gasMode: "amount",
    miles: "",
    issueInspectionId: null,
    ticketIssueIds: [],
    extras: emptyExtras(),
    ...init,
  };
}

export function emptyPaymentDraft(today: string): PaymentDraft {
  return {
    paidTo: null,
    paidAt: today,
    paymentMethodId: null,
    reference: "",
    invoiceNumber: "",
    extras: emptyExtras(),
    lines: [newLine("fixed")],
  };
}

/* ── Editing ─────────────────────────────────────────────────────────────── */

export function addLine(draft: PaymentDraft, type: PaymentLineType = "fixed"): PaymentDraft {
  const last = draft.lines[draft.lines.length - 1];
  // A new line starts at the same store as the one above it: most payments are one store.
  const seed = last ? { storeId: last.storeId, otherStore: last.otherStore } : {};
  return { ...draft, lines: [...draft.lines, newLine(type, { ...seed, rate: draft.paidTo?.hourlyRate ?? "" })] };
}

export function removeLine(draft: PaymentDraft, uid: string): PaymentDraft {
  return { ...draft, lines: draft.lines.filter((l) => l.uid !== uid) };
}

export function updateLine(draft: PaymentDraft, uid: string, patch: Partial<PaymentLineDraft>): PaymentDraft {
  return { ...draft, lines: draft.lines.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) };
}

/** Line types that can pay back what the technician bought. */
export const PAYS_BACK: readonly PaymentLineType[] = ["parts", "other"];

/** Types whose amount is typed in (gas: when paid as an amount). */
const TYPED_AMOUNT: readonly PaymentLineType[] = ["fixed", "inspection", "other", "gas"];

/**
 * A new type keeps what still applies — the same line (its identity, so the
 * dialog finds it), where it was spent, its tickets, description, notes and
 * attachments, and a typed amount when the new type also takes one — and
 * clears the fields only the old type had.
 *
 * Parts going into storage have no store: back to a store-type line, the
 * store is chosen again. An hourly line starts at the technician's rate.
 */
export function changeLineType(line: PaymentLineDraft, type: PaymentLineType, defaultRate?: string | null): PaymentLineDraft {
  if (type === line.type) return line;
  const fromStorage = line.type === "parts" && line.destination === "storage";
  const keepAmount = TYPED_AMOUNT.includes(line.type) && TYPED_AMOUNT.includes(type) && !(line.type === "gas" && line.gasMode === "miles");
  const fresh = newLine(type, {
    storeId: fromStorage ? null : line.storeId,
    otherStore: fromStorage ? "" : line.otherStore,
    ticketIssueIds: line.ticketIssueIds,
    description: line.description,
    amount: keepAmount ? line.amount : "",
    rate: type === "hourly" ? defaultRate ?? "" : "",
    // Parts and Other lines both pay back the technician's purchases.
    technicianPurchaseIds: PAYS_BACK.includes(type) && PAYS_BACK.includes(line.type) ? line.technicianPurchaseIds : [],
    extras: line.extras,
  });
  return { ...fresh, uid: line.uid };
}

/** Choosing who is paid: hourly lines without a typed rate take the technician's. */
export function setPaidTo(draft: PaymentDraft, paidTo: PaidToChoice | null): PaymentDraft {
  const rate = paidTo?.type === "technician" ? paidTo.hourlyRate ?? "" : "";
  return {
    ...draft,
    paidTo,
    lines: draft.lines.map((l) => (l.type === "hourly" && !l.rate ? { ...l, rate } : l)),
  };
}

/** Sum of the chosen sessions' paid time, in decimal hours. */
export function sessionHours(ids: readonly number[], ctx: PreviewContext): number {
  const minutes = ids.reduce((sum, id) => sum + (ctx.sessionPaidMinutes?.[id] ?? 0), 0);
  return minutesToHours(minutes);
}

/** Picking clocked sessions fills the hours — unless the person typed over them. */
export function setLineSessions(line: PaymentLineDraft, ids: number[], ctx: PreviewContext): PaymentLineDraft {
  return {
    ...line,
    tripSessionIds: ids,
    hours: line.hoursTyped ? line.hours : String(sessionHours(ids, ctx)),
  };
}

/** Typing the hours marks them "typed over". */
export function typeHours(line: PaymentLineDraft, hours: string): PaymentLineDraft {
  return { ...line, hours, hoursTyped: true };
}

/** Back to the sessions' paid time. */
export function resetHours(line: PaymentLineDraft, ctx: PreviewContext): PaymentLineDraft {
  return { ...line, hoursTyped: false, hours: String(sessionHours(line.tripSessionIds, ctx)) };
}

/* ── Preview ─────────────────────────────────────────────────────────────── */

function product(a: string, b: string): number | null {
  const x = parseDecimal(a);
  const y = parseDecimal(b);
  return x == null || y == null ? null : roundCents(x * y);
}

/** The line's amount as the server will compute it; null when it cannot be known yet. */
export function previewLineAmount(line: PaymentLineDraft, ctx: PreviewContext = {}): number | null {
  if (line.type === "hourly") {
    const hours = line.hoursTyped || !line.tripSessionIds.length ? line.hours : String(sessionHours(line.tripSessionIds, ctx));
    return product(hours, line.rate);
  }
  if (line.type === "parts") return product(line.quantity, line.unitCost);
  if (line.type === "gas" && line.gasMode === "miles") return product(line.miles, line.rate);
  return parseDecimal(line.amount);
}

/** The running total at the bottom of the dialog (lines not yet computable count as 0). */
export function previewTotal(draft: PaymentDraft, ctx: PreviewContext = {}): number {
  return roundCents(draft.lines.reduce((sum, l) => sum + (previewLineAmount(l, ctx) ?? 0), 0));
}

/* ── Prefill ─────────────────────────────────────────────────────────────── */

/** The store a set of ticket issues share, or null when they span stores. */
function sharedStore(storeNumbers: readonly (string | null)[]): string | null {
  const unique = Array.from(new Set(storeNumbers.filter((s): s is string => Boolean(s))));
  return unique.length === 1 ? unique[0] : null;
}

/**
 * "Pay this" from the Unpaid work panel: the technician, one hourly line per
 * store with the chosen sessions (all by default), and one line per purchase being
 * paid back (`technician_purchase_ids`): a parts line for a catalog part, an
 * Other line for anything else he bought (zip ties, a cleaner).
 */
export function draftFromUnpaidWork(
  work: UnpaidWork,
  today: string,
  pick: { sessionIds?: number[]; purchaseIds?: number[] } = {},
  /** Store number → numeric stores.id (the wire wants the id); null when unknown. */
  resolveStoreId: (storeNumber: string) => number | null = () => null,
): PaymentDraft {
  const storeIdOf = (storeNumber: string | null | undefined) => (storeNumber ? resolveStoreId(storeNumber) : null);
  const rate = work.technician.hourlyRate ?? "";
  const sessions = work.sessions.filter((s) => !pick.sessionIds || pick.sessionIds.includes(s.id));
  const purchases = work.purchases.filter((p) => !pick.purchaseIds || pick.purchaseIds.includes(p.id));
  const ctx: PreviewContext = { sessionPaidMinutes: Object.fromEntries(sessions.map((s) => [s.id, s.durations.paid])) };

  // One hourly line per store: a line is spent at one store, so sessions at
  // different stores are split; a session spread over several stores (or none)
  // goes on a line whose store is left to choose.
  const byStore = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = sharedStore(s.ticketIssues.map((i) => i.storeNumber)) ?? "";
    byStore.set(key, [...(byStore.get(key) ?? []), s]);
  }
  const hourly = Array.from(byStore.entries()).map(([storeNumber, group]) => {
    const issues = group.flatMap((s) => s.ticketIssues).filter((i) => !storeNumber || i.storeNumber === storeNumber);
    return setLineSessions(
      newLine("hourly", {
        rate,
        storeId: storeIdOf(storeNumber || null),
        ticketIssueIds: Array.from(new Set(issues.map((i) => i.id))),
      }),
      group.map((s) => s.id),
      ctx,
    );
  });

  const partsLines = purchases.map((p) => {
    if (!p.part) {
      return newLine("other", {
        description: p.description,
        amount: toMoneyString(decimalOr0(p.totalCost)),
        storeId: storeIdOf(p.ticketIssue?.storeNumber),
        ticketIssueIds: p.ticketIssue ? [p.ticketIssue.id] : [],
        technicianPurchaseIds: [p.id],
      });
    }
    const quantity = parseDecimal(p.quantity) ?? 1;
    return newLine("parts", {
      partId: p.part?.id ?? null,
      description: p.description,
      quantity: String(quantity),
      unitCost: toMoneyString(decimalOr0(p.totalCost) / quantity),
      boughtFromSupplierId: p.supplier?.id ?? null,
      destination: "ticket",
      storeId: storeIdOf(p.ticketIssue?.storeNumber),
      ticketIssueIds: p.ticketIssue ? [p.ticketIssue.id] : [],
      serials: p.serialNumber ? [p.serialNumber] : [],
      technicianPurchaseIds: [p.id],
    });
  });

  const lines = [...hourly, ...partsLines];
  return {
    ...emptyPaymentDraft(today),
    paidTo: { type: "technician", id: work.technician.id, name: work.technician.name, hourlyRate: work.technician.hourlyRate ?? null },
    lines: lines.length ? lines : [newLine("hourly", { rate })],
  };
}

/** "Record a payment" from a ticket's Costs tab: that store and that issue on the first line. */
export function draftFromTicket(
  today: string,
  ticket: { storeId: number | null; otherStore?: string; ticketIssueId: number },
  type: PaymentLineType = "fixed",
): PaymentDraft {
  return {
    ...emptyPaymentDraft(today),
    lines: [newLine(type, { storeId: ticket.storeId, otherStore: ticket.otherStore ?? "", ticketIssueIds: [ticket.ticketIssueId] })],
  };
}

/** Storage "Record stock → Parts bought": one parts line going into storage. */
export function draftForPartsToStorage(today: string, storageLocationId: number | null = null): PaymentDraft {
  return {
    ...emptyPaymentDraft(today),
    lines: [newLine("parts", { destination: "storage", storageLocationId })],
  };
}

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));

/** A saved payment read back into the dialog for Edit. */
export function draftFromPayment(payment: Payment): PaymentDraft {
  return {
    paidTo: { type: payment.paidTo.type, id: payment.paidTo.id, name: payment.paidTo.name },
    paidAt: payment.paidAt,
    paymentMethodId: payment.paymentMethod?.id ?? null,
    reference: payment.reference ?? "",
    invoiceNumber: payment.invoiceNumber ?? "",
    extras: extrasFromSaved(payment.notes, payment.attachments),
    expectedUpdatedAt: payment.updatedAt,
    lines: payment.lines.map((l) =>
      newLine(l.type, {
        storeId: l.store?.id ?? null,
        otherStore: l.otherStore ?? "",
        storageLocationId: l.storageLocation?.id ?? null,
        // Parts into storage: the spot the part sits in there now (only the ids go back).
        place: (l.place ?? []).map((p) => ({ levelId: p.levelId, valueId: p.valueId })),
        description: l.description ?? "",
        amount: str(l.amount),
        tripSessionIds: l.tripSessions.map((s) => s.id),
        hours: str(l.hours),
        hoursTyped: Boolean(l.hoursOverridden),
        rate: str(l.rate),
        partId: l.part?.id ?? null,
        quantity: str(l.quantity),
        unitCost: str(l.unitCost),
        boughtFromSupplierId: l.boughtFrom?.id ?? null,
        destination: l.destination,
        serials: l.serials,
        technicianPurchaseIds: l.technicianPurchases.map((p) => p.id),
        gasMode: l.type === "gas" && l.miles ? "miles" : "amount",
        miles: str(l.miles),
        issueInspectionId: l.issueInspectionId,
        ticketIssueIds: l.ticketIssues.map((i) => i.id),
        extras: extrasFromSaved(l.notes, l.attachments),
      }),
    ),
  };
}

/* ── Wire body ───────────────────────────────────────────────────────────── */

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/** Exactly one place: storage (parts into storage), else store, else other store. */
function placeOf(line: PaymentLineDraft): Pick<PaymentLineInput, "storeId" | "otherStore" | "storageLocationId" | "place"> {
  if (line.type === "parts" && line.destination === "storage") {
    return { storageLocationId: line.storageLocationId, place: line.place.length ? line.place : undefined };
  }
  if (line.storeId != null && line.storeId !== "") return { storeId: Number(line.storeId) };
  return { otherStore: orNull(line.otherStore) };
}

function lineToInput(line: PaymentLineDraft, editing: boolean): PaymentLineInput {
  const base: PaymentLineInput = {
    type: line.type,
    ...placeOf(line),
    description: lineShows(line.type, "description") ? orNull(line.description) : undefined,
    ticketIssueIds: line.ticketIssueIds.length ? line.ticketIssueIds : undefined,
    ...lineExtrasInput(line.extras, editing),
  };
  const byType: Record<PaymentLineType, () => Partial<PaymentLineInput>> = {
    hourly: () => ({
      tripSessionIds: line.tripSessionIds,
      // Hours go only when typed over; otherwise the server sums the sessions.
      hours: line.hoursTyped || !line.tripSessionIds.length ? orNull(line.hours) : undefined,
      rate: orNull(line.rate),
    }),
    fixed: () => ({ amount: orNull(line.amount) }),
    inspection: () => ({ amount: orNull(line.amount), issueInspectionId: line.issueInspectionId ?? undefined }),
    parts: () => ({
      partId: line.partId,
      quantity: orNull(line.quantity),
      unitCost: orNull(line.unitCost),
      boughtFromSupplierId: line.boughtFromSupplierId ?? undefined,
      destination: line.destination,
      serials: line.serials.length ? line.serials : undefined,
      technicianPurchaseIds: line.technicianPurchaseIds.length ? line.technicianPurchaseIds : undefined,
      description: orNull(line.description) ?? undefined,
    }),
    gas: () => (line.gasMode === "miles" ? { miles: orNull(line.miles), rate: orNull(line.rate) } : { amount: orNull(line.amount) }),
    // An Other line also pays back purchases that are not catalog parts (zip ties, a cleaner).
    other: () => ({
      amount: orNull(line.amount),
      technicianPurchaseIds: line.technicianPurchaseIds.length ? line.technicianPurchaseIds : undefined,
    }),
  };
  return { ...base, ...byType[line.type]() };
}

function toInput(draft: PaymentDraft, editing: boolean): PaymentInput {
  const { removeNoteIds, removeAttachmentIds, ...extras } = paymentExtrasInput(draft.extras, editing);
  return {
    paidAt: draft.paidAt,
    technicianId: draft.paidTo?.type === "technician" ? draft.paidTo.id : undefined,
    supplierId: draft.paidTo?.type === "supplier" ? draft.paidTo.id : undefined,
    paymentMethodId: draft.paymentMethodId,
    // Not asked for any more; an edit sends back what an older payment saved (the edit replaces them).
    reference: orNull(draft.reference) ?? undefined,
    invoiceNumber: orNull(draft.invoiceNumber) ?? undefined,
    ...extras,
    ...(editing ? { removeNoteIds, removeAttachmentIds } : {}),
    lines: draft.lines.map((l) => lineToInput(l, editing)),
  };
}

export function draftToInput(draft: PaymentDraft): PaymentInput {
  return toInput(draft, false);
}

export function draftToEditInput(draft: PaymentDraft): EditPaymentInput {
  return { ...toInput(draft, true), expectedUpdatedAt: draft.expectedUpdatedAt ?? "" };
}

/* ── Client-side checks (same keys as the server's 422) ─────────────────── */

type Check = { when: boolean; key: string; message: string };

function lineChecks(line: PaymentLineDraft, i: number): Check[] {
  const blank = (s: string) => !s.trim();
  const hasPlace =
    line.type === "parts" && line.destination === "storage"
      ? line.storageLocationId != null
      : (line.storeId != null && line.storeId !== "") || !blank(line.otherStore);
  return [
    { when: !hasPlace, key: lineErrorKey(i, line.type === "parts" && line.destination === "storage" ? "storageLocationId" : "storeId"), message: "Choose where this was for." },
    { when: ["fixed", "inspection", "other"].includes(line.type) && blank(line.amount), key: lineErrorKey(i, "amount"), message: "Enter the amount." },
    { when: line.type === "other" && blank(line.description), key: lineErrorKey(i, "description"), message: "Say what this was for." },
    { when: line.type === "hourly" && !line.tripSessionIds.length && blank(line.hours), key: lineErrorKey(i, "hours"), message: "Pick clocked time or type the hours." },
    { when: line.type === "hourly" && blank(line.rate), key: lineErrorKey(i, "rate"), message: "Enter the hourly rate." },
    { when: line.type === "parts" && line.partId == null, key: lineErrorKey(i, "partId"), message: "Choose the part." },
    { when: line.type === "parts" && blank(line.quantity), key: lineErrorKey(i, "quantity"), message: "Enter how many." },
    { when: line.type === "parts" && blank(line.unitCost), key: lineErrorKey(i, "unitCost"), message: "Enter the price of one." },
    {
      when: line.type === "parts" && line.destination === "ticket" && !line.ticketIssueIds.length,
      key: lineErrorKey(i, "ticketIssueIds"),
      message: "Choose the ticket these parts went to.",
    },
    { when: line.type === "gas" && line.gasMode === "amount" && blank(line.amount), key: lineErrorKey(i, "amount"), message: "Enter the amount." },
    { when: line.type === "gas" && line.gasMode === "miles" && (blank(line.miles) || blank(line.rate)), key: lineErrorKey(i, "miles"), message: "Enter the miles and the rate per mile." },
  ];
}

/**
 * What the form can tell before saving. `serialsNeeded(partId)` says whether
 * a part tracks serials (then one serial per unit is required).
 */
export function validateDraft(draft: PaymentDraft, serialsNeeded: (partId: number) => boolean = () => false): FormErrors {
  const serialChecks: Check[] = draft.lines.map((l, i) => {
    const qty = parseDecimal(l.quantity) ?? 0;
    return {
      when: l.type === "parts" && l.partId != null && serialsNeeded(l.partId) && l.serials.filter((s) => s.trim()).length !== qty,
      key: lineErrorKey(i, "serials"),
      message: "Enter one serial number for each unit.",
    };
  });
  const checks: Check[] = [
    { when: !draft.paidTo, key: rootErrorKey(draft.paidTo?.type === "supplier" ? "supplierId" : "technicianId"), message: "Choose who was paid." },
    { when: !draft.paidAt, key: rootErrorKey("paidAt"), message: "Enter the date." },
    { when: !draft.lines.length, key: "lines", message: "Add at least one line." },
    ...draft.lines.flatMap(lineChecks),
    ...serialChecks,
  ];
  const fields = checks
    .filter((c) => c.when)
    .reduce<Record<string, string>>((acc, c) => (acc[c.key] ? acc : { ...acc, [c.key]: c.message }), {});
  return { fields, form: [] };
}

/**
 * Root keys that have a control, in form order (for focusing the first
 * invalid one). reference / invoice_number have no field any more:
 * an error on them falls into the banner at the top.
 */
export const PAYMENT_ROOT_FIELDS = [
  "technician_id",
  "supplier_id",
  "paid_at",
  "payment_method_id",
  "lines",
  "files",
  "notes",
  "remove_note_ids",
  "remove_attachment_ids",
] as const;
