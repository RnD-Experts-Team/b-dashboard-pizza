/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — entry form state machine                                     */
/*                                                                            */
/*  Pure, non-React, no JSX. Every rule with money consequences lives here so */
/*  it can be read end-to-end without wading through markup:                  */
/*                                                                            */
/*   - gather vs override hours (and why 0 is an override, not "unset")       */
/*   - lump sum being mutually exclusive with hourly labour                   */
/*   - store_id vs other_store                                               */
/*   - one payee per sheet                                                    */
/*   - never dropping a payment or a line, so server 422 indexes still line up*/
/*                                                                            */
/*  Form state is all STRINGS, so number inputs can be genuinely empty.       */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  DailyPayEntry,
  DailyPayEntryInput,
  DailyPayGathered,
  DailyPayLabourInput,
  DailyPayLineInput,
  DailyPayNoteInput,
  DailyPayPaymentInput,
  DailyPayPaymentLabourInput,
} from "@/types/daily-pay.types";
import { paymentKey, lineKey, type DailyPayFormErrors } from "./field-errors";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shapes                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type LineLabourMode = "gather" | "hours" | "lumpSum";
export type PaymentLabourMode = "sumLines" | "lumpSum";
export type LineLocationKind = "store" | "other";

export interface NoteForm {
  body: string;
  type: string;
  files: File[];
  /**
   * Edit-mode prefill only: the id of the note this row came from.
   *
   * The /edit endpoint replaces the whole entry and accepts only NEW notes, so
   * a prefilled note has to be re-sent by body to survive — which duplicates
   * it and loses its attachments. Tracked here so the UI can at least say so.
   * See the `keep` flag and OPEN QUESTION in the dialog.
   */
  existingId: number | null;
  /** False ⇒ this prefilled note is not re-sent (and so disappears). */
  keep: boolean;
}

export interface LineForm {
  locationKind: LineLocationKind;
  storeId: string;
  otherStore: string;
  labourMode: LineLabourMode;
  totalWorkingHours: string;
  lumpSum: string;
  hourlyPaymentRate: string;
  gas: string;
  moneyOwed: string;
  ticketIssueIds: number[];
  notes: NoteForm[];
  files: File[];
  /** Edit mode only: the frozen figures shown behind the hours placeholder. */
  gathered: DailyPayGathered | null;
}

export interface PaymentForm {
  technicianId: string;
  labourMode: PaymentLabourMode;
  lumpSum: string;
  hourlyPaymentRate: string;
  gas: string;
  moneyOwed: string;
  notes: NoteForm[];
  files: File[];
  lines: LineForm[];
  gathered: DailyPayGathered | null;
}

export interface EntryFormState {
  date: string;
  payments: PaymentForm[];
  /** Edit mode only: the `updated_at` this form was prefilled from. */
  expectedUpdatedAt: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constructors                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyNote(): NoteForm {
  return { body: "", type: "", files: [], existingId: null, keep: true };
}

export function emptyLine(): LineForm {
  return {
    locationKind: "store",
    storeId: "",
    otherStore: "",
    // Default to "gather": leaving hours out is the behaviour the backend is
    // designed around, and the one that stays correct as attendance is edited.
    labourMode: "gather",
    totalWorkingHours: "",
    lumpSum: "",
    hourlyPaymentRate: "",
    gas: "",
    moneyOwed: "",
    ticketIssueIds: [],
    notes: [],
    files: [],
    gathered: null,
  };
}

export function emptyPayment(): PaymentForm {
  return {
    technicianId: "",
    labourMode: "sumLines",
    lumpSum: "",
    hourlyPaymentRate: "",
    gas: "",
    moneyOwed: "",
    notes: [],
    files: [],
    lines: [emptyLine()],
    gathered: null,
  };
}

export function emptyEntryFormState(): EntryFormState {
  return { date: todayIso(), payments: [emptyPayment()], expectedUpdatedAt: null };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Parsing helpers                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/** Trimmed-empty ⇒ null. Non-numeric ⇒ null (callers validate separately). */
export function toNum(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** True when the string holds something that is not a finite number. */
function isMalformedNumber(value: string): boolean {
  const t = value.trim();
  return t !== "" && !Number.isFinite(Number(t));
}

function numToString(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Prefill (edit mode)                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Chooses the labour mode a prefilled line should open in.
 *
 * THE MOST DANGEROUS RULE IN THE PREFILL. A line saved as "gather" comes back
 * from the API carrying a real `totalWorkingHours` — the gathered figure. If
 * that value were loaded into the hours INPUT, the next save would send it and
 * silently convert a self-updating gathered line into a permanent override.
 *
 * So the mode is driven by `hoursOverridden`, never by the presence of a value,
 * and a gathered line shows its figure as a PLACEHOLDER only.
 */
function labourModeFor(line: {
  lumpSum: number | null;
  hoursOverridden: boolean;
}): LineLabourMode {
  if (line.lumpSum != null) return "lumpSum";
  return line.hoursOverridden ? "hours" : "gather";
}

export function entryToFormState(entry: DailyPayEntry): EntryFormState {
  const payments = entry.payments ?? [];

  return {
    date: entry.date,
    expectedUpdatedAt: entry.updatedAt,
    payments: payments.length
      ? payments.map((payment) => ({
          technicianId: String(payment.technicianId),
          labourMode: payment.lumpSum != null ? "lumpSum" : "sumLines",
          lumpSum: numToString(payment.lumpSum),
          hourlyPaymentRate: numToString(payment.hourlyPaymentRate),
          gas: numToString(payment.gas),
          moneyOwed: numToString(payment.moneyOwed),
          notes: (payment.notes ?? []).map((note) => ({
            body: note.body,
            type: note.type ?? "",
            files: [],
            existingId: note.id,
            keep: true,
          })),
          files: [],
          gathered: payment.gathered,
          lines: (payment.lines ?? []).length
            ? (payment.lines ?? []).map((line) => {
                const labourMode = labourModeFor(line);
                return {
                  locationKind: line.storeId != null ? "store" : "other",
                  storeId: line.storeId != null ? String(line.storeId) : "",
                  otherStore: line.otherStore ?? "",
                  labourMode,
                  // Only populated when this really IS an override. A gathered
                  // line keeps an empty input and shows the figure as a hint.
                  totalWorkingHours:
                    labourMode === "hours" ? numToString(line.totalWorkingHours) : "",
                  lumpSum: numToString(line.lumpSum),
                  hourlyPaymentRate: numToString(line.hourlyPaymentRate),
                  gas: numToString(line.gas),
                  moneyOwed: numToString(line.moneyOwed),
                  ticketIssueIds: (line.ticketIssues ?? []).map((ti) => ti.id),
                  notes: (line.notes ?? []).map((note) => ({
                    body: note.body,
                    type: note.type ?? "",
                    files: [],
                    existingId: note.id,
                    keep: true,
                  })),
                  files: [],
                  gathered: line.gathered,
                } satisfies LineForm;
              })
            : [emptyLine()],
        }))
      : [emptyPayment()],
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Duplicate payee detection                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Technician ids appearing on more than one payment.
 *
 * A payee appears ONCE per sheet — all their stores go on the one payment, and
 * a duplicate is a 422 on payments.N.technician_id. Detection is needed as well
 * as prevention because edit-mode prefill and payee changes both reach this
 * state without passing through a dropdown.
 */
export function duplicatePayeeIds(payments: PaymentForm[]): Set<number> {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const payment of payments) {
    const id = toNum(payment.technicianId);
    if (id == null) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return duplicates;
}

/** Payee ids already used by a payment OTHER than the one at `exceptIndex`. */
export function payeeIdsInUse(payments: PaymentForm[], exceptIndex: number): Set<number> {
  const ids = new Set<number>();
  payments.forEach((payment, i) => {
    if (i === exceptIndex) return;
    const id = toNum(payment.technicianId);
    if (id != null) ids.add(id);
  });
  return ids;
}

/** Issue ids selected on a SIBLING line of the same payment. */
export function siblingIssueIds(payment: PaymentForm, exceptLineIndex: number): number[] {
  const ids: number[] = [];
  payment.lines.forEach((line, j) => {
    if (j === exceptLineIndex) return;
    ids.push(...line.ticketIssueIds);
  });
  return ids;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Validates the form, returning errors keyed by the SAME dotted paths the
 * server uses. That is what lets client and server errors render through one
 * code path and one set of field lookups.
 */
export function validateFormState(state: EntryFormState): DailyPayFormErrors {
  const fields: Record<string, string> = {};
  const form: string[] = [];

  if (!state.date.trim()) {
    fields.date = "Workday date is required.";
  }
  if (state.payments.length === 0) {
    form.push("At least one payment is required.");
  }

  const duplicates = duplicatePayeeIds(state.payments);

  state.payments.forEach((payment, i) => {
    const technicianId = toNum(payment.technicianId);
    if (technicianId == null) {
      fields[paymentKey(i, "technician_id")] = "Payee is required.";
    } else if (duplicates.has(technicianId)) {
      fields[paymentKey(i, "technician_id")] =
        "This payee is already on this sheet. Put all their stores on the one payment.";
    }

    if (payment.labourMode === "lumpSum" && toNum(payment.lumpSum) == null) {
      fields[paymentKey(i, "lump_sum")] = "Enter a lump sum, or switch back to per-store labour.";
    }
    for (const [field, value] of [
      ["hourly_payment_rate", payment.hourlyPaymentRate],
      ["gas", payment.gas],
      ["money_owed", payment.moneyOwed],
    ] as const) {
      if (isMalformedNumber(value)) fields[paymentKey(i, field)] = "Enter a valid number.";
    }

    if (payment.lines.length === 0) {
      // Deliberately an error the user fixes rather than something we compact
      // away — see formStateToInput.
      fields[paymentKey(i, "lines")] = "Add at least one store line.";
    }

    payment.lines.forEach((line, j) => {
      if (line.locationKind === "store") {
        if (toNum(line.storeId) == null) {
          fields[lineKey(i, j, "store_id")] = "Store is required.";
        }
      } else if (!line.otherStore.trim()) {
        fields[lineKey(i, j, "other_store")] = "Location name is required.";
      }

      // An "hours" mode with nothing typed is an ERROR, never a silent fall
      // back to "gather" — that would be the exact "I typed a 0 and it got
      // gathered instead" bug.
      if (line.labourMode === "hours" && toNum(line.totalWorkingHours) == null) {
        fields[lineKey(i, j, "total_working_hours")] =
          "Enter the hours to override with, or switch back to gathered.";
      }
      if (line.labourMode === "lumpSum" && toNum(line.lumpSum) == null) {
        fields[lineKey(i, j, "lump_sum")] = "Enter a lump sum, or switch back to hours.";
      }
      for (const [field, value] of [
        ["hourly_payment_rate", line.hourlyPaymentRate],
        ["gas", line.gas],
        ["money_owed", line.moneyOwed],
      ] as const) {
        if (isMalformedNumber(value)) fields[lineKey(i, j, field)] = "Enter a valid number.";
      }
    });
  });

  return { fields, form };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Form state → request payload                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Notes ARE compacted (blank bodies and un-kept prefills dropped), unlike
 * payments and lines. Acceptable because note-level 422s are rare and the
 * compaction is visible to the user, but it does mean note indexes in a server
 * error will not line up with the rows on screen.
 */
function buildNotes(notes: NoteForm[]): DailyPayNoteInput[] | undefined {
  const built = notes
    .filter((note) => note.keep && note.body.trim())
    .map((note) => ({
      body: note.body.trim(),
      // Preserve the type so a migrated `legacy_invoices` note stays typed
      // rather than reappearing as an ordinary user note.
      type: note.type.trim() || undefined,
      files: note.files,
    }));
  return built.length ? built : undefined;
}

function buildLineLabour(line: LineForm): DailyPayLabourInput {
  if (line.labourMode === "lumpSum") {
    // Validation guarantees this parses; the ?? 0 is only to satisfy the type.
    return { kind: "lumpSum", lumpSum: toNum(line.lumpSum) ?? 0 };
  }
  if (line.labourMode === "hours") {
    return { kind: "hours", totalWorkingHours: toNum(line.totalWorkingHours) ?? 0 };
  }
  return { kind: "gather" };
}

function buildPaymentLabour(payment: PaymentForm): DailyPayPaymentLabourInput {
  if (payment.labourMode === "lumpSum") {
    return { kind: "lumpSum", lumpSum: toNum(payment.lumpSum) ?? 0 };
  }
  return { kind: "sumLines" };
}

/**
 * Maps validated form state onto the request payload.
 *
 * CRITICAL: this never drops a payment or a line. Server error keys are
 * positional (`payments.2.lines.0.store_id`), so compacting here would make
 * those indexes point at UI rows that are not where the server thinks they are.
 * Empty payments and lines are validation errors, not something to tidy away.
 *
 * Call only after `validateFormState` returns no errors.
 */
export function formStateToInput(
  state: EntryFormState,
  options?: { includeExpectedUpdatedAt?: boolean }
): DailyPayEntryInput {
  const payments: DailyPayPaymentInput[] = state.payments.map((payment) => ({
    technicianId: toNum(payment.technicianId) ?? 0,
    labour: buildPaymentLabour(payment),
    // A payment-level lump sum replaces all of its lines' labour, so an hourly
    // rate alongside it is meaningless — drop it rather than send a value the
    // server will ignore.
    hourlyPaymentRate:
      payment.labourMode === "lumpSum" ? null : toNum(payment.hourlyPaymentRate),
    gas: toNum(payment.gas),
    moneyOwed: toNum(payment.moneyOwed),
    notes: buildNotes(payment.notes),
    files: payment.files.length ? payment.files : undefined,
    lines: payment.lines.map((line): DailyPayLineInput => ({
      location:
        line.locationKind === "store"
          ? { kind: "store", storeId: toNum(line.storeId) ?? 0 }
          : { kind: "other", otherStore: line.otherStore.trim() },
      labour: buildLineLabour(line),
      hourlyPaymentRate:
        line.labourMode === "lumpSum" ? null : toNum(line.hourlyPaymentRate),
      gas: toNum(line.gas),
      moneyOwed: toNum(line.moneyOwed),
      ticketIssueIds: line.ticketIssueIds.length ? line.ticketIssueIds : undefined,
      notes: buildNotes(line.notes),
      files: line.files.length ? line.files : undefined,
    })),
  }));

  return {
    date: state.date.trim(),
    payments,
    ...(options?.includeExpectedUpdatedAt && state.expectedUpdatedAt
      ? { expectedUpdatedAt: state.expectedUpdatedAt }
      : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Immutable update helpers (used by the dialog's reducer-ish setters)       */
/* ────────────────────────────────────────────────────────────────────────── */

export function patchPayment(
  payments: PaymentForm[],
  index: number,
  patch: Partial<PaymentForm>
): PaymentForm[] {
  return payments.map((p, i) => (i === index ? { ...p, ...patch } : p));
}

export function patchLine(
  payments: PaymentForm[],
  paymentIndex: number,
  lineIndex: number,
  patch: Partial<LineForm>
): PaymentForm[] {
  return payments.map((p, i) =>
    i === paymentIndex
      ? { ...p, lines: p.lines.map((l, j) => (j === lineIndex ? { ...l, ...patch } : l)) }
      : p
  );
}

/**
 * Moves every line from `fromIndex` onto the first payment sharing its payee,
 * then removes the now-empty payment. Backs the "Merge into the existing
 * payment" action on a duplicate-payee error.
 */
export function mergePaymentIntoFirstWithSamePayee(
  payments: PaymentForm[],
  fromIndex: number
): PaymentForm[] {
  const source = payments[fromIndex];
  if (!source) return payments;
  const payeeId = toNum(source.technicianId);
  if (payeeId == null) return payments;

  const targetIndex = payments.findIndex(
    (p, i) => i !== fromIndex && toNum(p.technicianId) === payeeId
  );
  if (targetIndex === -1) return payments;

  return payments
    .map((p, i) =>
      i === targetIndex ? { ...p, lines: [...p.lines, ...source.lines] } : p
    )
    .filter((_, i) => i !== fromIndex);
}
