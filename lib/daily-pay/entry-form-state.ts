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
export type LineLocationKind = "store" | "other";

/**
 * How a payee is paid. Chosen ONCE, on the payment, and every store line
 * follows it.
 *
 * The API has two independent lump sums (payment and line) and lets them be
 * mixed freely -- which is exactly how a payment-level lump sum came to
 * silently swallow line lump sums, and how a "fixed" company's hours kept
 * looking live on every store. The form collapses that into four shapes a
 * person can actually name:
 *
 *   hourly        each store: logged (or typed) hours × rate
 *   fixedDay      one price covers every store; lines carry no labour money,
 *                 so the price is NOT split across the stores
 *   fixedPerStore each store carries its own price, so each store's cost is right
 *   mixed         each store picks its own way -- hours or a fixed price. The
 *                 one shape where stores differ, so it is chosen on purpose
 *                 rather than drifted into by filling in the wrong field.
 *
 * Only `fixedDay` can never be mixed with anything: a day price replaces ALL
 * the stores' labour, so a store price beside it would silently not count.
 *
 * Switching shape never clears what was typed: the line fields keep their
 * values, and `formStateToInput` sends only what the chosen shape uses. So
 * flipping back and forth is safe, and nothing a person typed vanishes.
 */
export type PaymentPayShape = "hourly" | "fixedDay" | "fixedPerStore" | "mixed";

/** Shapes where hours × rate can be paid, so the rates mean something. */
export function shapeUsesRates(shape: PaymentPayShape): boolean {
  return shape === "hourly" || shape === "mixed";
}

/**
 * What a line's labour actually is under its payment's shape. The line's own
 * `labourMode` only matters on an hourly or mixed payment; the fixed shapes
 * override it.
 *
 * `coveredByDay` means the line carries no labour money at all -- the day's
 * price covers it. Typed hours are still sent as a record (they cannot change
 * the money), otherwise the hours are gathered.
 */
export type EffectiveLineLabour = LineLabourMode | "coveredByDay";

export function effectiveLineLabour(shape: PaymentPayShape, line: LineForm): EffectiveLineLabour {
  if (shape === "fixedDay") return "coveredByDay";
  if (shape === "fixedPerStore") return "lumpSum";
  return line.labourMode;
}

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
  payShape: PaymentPayShape;
  /** The day's price. Only sent when `payShape` is "fixedDay". */
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
    payShape: "hourly",
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

/**
 * Which shape a saved payment opens in.
 *
 * A payment lump sum wins, exactly as it does in the server's arithmetic --
 * any line lump sums beside it were already being ignored, and the form now
 * says so instead of showing them as if they counted.
 *
 * A payment where only SOME lines have a lump sum opens as "store by store",
 * which is exactly what it is -- every store keeps the way it was paid.
 */
function payShapeFor(payment: {
  lumpSum: number | null;
  lines: { lumpSum: number | null }[] | null;
}): PaymentPayShape {
  if (payment.lumpSum != null) return "fixedDay";
  const lines = payment.lines ?? [];
  const fixed = lines.filter((line) => line.lumpSum != null).length;
  if (lines.length > 0 && fixed === lines.length) return "fixedPerStore";
  if (fixed > 0) return "mixed";
  return "hourly";
}

export function entryToFormState(entry: DailyPayEntry): EntryFormState {
  const payments = entry.payments ?? [];

  return {
    date: entry.date,
    expectedUpdatedAt: entry.updatedAt,
    payments: payments.length
      ? payments.map((payment) => ({
          technicianId: String(payment.technicianId),
          payShape: payShapeFor(payment),
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

    const shape = payment.payShape;

    if (shape === "fixedDay" && toNum(payment.lumpSum) == null) {
      fields[paymentKey(i, "lump_sum")] = "Enter the price for the day.";
    }

    // Trap: a store paid by the hour with no rate of its own and no default to
    // fall back on is paid $0 for its hours -- silently, today. Typing 0 on
    // purpose is still allowed; leaving it blank is not.
    if (shapeUsesRates(shape) && toNum(payment.hourlyPaymentRate) == null) {
      const unrated = payment.lines
        .map((line, j) => ({ line, j }))
        .filter(
          ({ line }) =>
            line.labourMode !== "lumpSum" && toNum(line.hourlyPaymentRate) == null
        );
      if (unrated.length > 0) {
        const names = unrated.map(({ j }) => `store ${j + 1}`);
        const which =
          names.length === 1
            ? names[0]
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
        fields[paymentKey(i, "hourly_payment_rate")] = names.length === 1
          ? `Enter a default rate — ${which} has no rate of its own and would be paid $0 for its hours.`
          : `Enter a default rate — ${which} have no rate of their own and would be paid $0 for their hours.`;
      }
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
      const labour = effectiveLineLabour(shape, line);

      // A day-priced line is not validated for hours: they cannot change the
      // money, the control is locked, and an error there could not be fixed.
      if (labour === "hours" && toNum(line.totalWorkingHours) == null) {
        fields[lineKey(i, j, "total_working_hours")] =
          "Enter the hours to override with, or switch back to gathered.";
      }
      if (labour === "lumpSum" && shape !== "hourly" && toNum(line.lumpSum) == null) {
        fields[lineKey(i, j, "lump_sum")] = "Enter the price for this store.";
      }
      // Defensive: switching to hourly resets fixed stores, and a mixed saved
      // sheet opens as "store by store", so this should not be reachable.
      if (shape === "hourly" && line.labourMode === "lumpSum") {
        fields[lineKey(i, j, "lump_sum")] =
          "This store has a fixed price, but the payment is paid by the hour. Switch this store to its hours, or change the payment to “Store by store”.";
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

function buildLineLabour(shape: PaymentPayShape, line: LineForm): DailyPayLabourInput {
  const labour = effectiveLineLabour(shape, line);

  if (labour === "lumpSum") {
    // Validation guarantees this parses; the ?? 0 is only to satisfy the type.
    return { kind: "lumpSum", lumpSum: toNum(line.lumpSum) ?? 0 };
  }
  if (labour === "hours") {
    return { kind: "hours", totalWorkingHours: toNum(line.totalWorkingHours) ?? 0 };
  }
  if (labour === "coveredByDay") {
    // Never a lump sum -- the day's price is the only labour money. Hours typed
    // earlier are kept as the record; they cannot move the total.
    const typed = line.labourMode === "hours" ? toNum(line.totalWorkingHours) : null;
    return typed != null ? { kind: "hours", totalWorkingHours: typed } : { kind: "gather" };
  }
  return { kind: "gather" };
}

function buildPaymentLabour(payment: PaymentForm): DailyPayPaymentLabourInput {
  if (payment.payShape === "fixedDay") {
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
    // Rates only mean anything where hours are paid. On a fixed payment they
    // are dropped rather than sent: a stray rate would put an hours × rate
    // figure on a store's line total that was never actually paid.
    hourlyPaymentRate: shapeUsesRates(payment.payShape)
      ? toNum(payment.hourlyPaymentRate)
      : null,
    gas: toNum(payment.gas),
    moneyOwed: toNum(payment.moneyOwed),
    notes: buildNotes(payment.notes),
    files: payment.files.length ? payment.files : undefined,
    lines: payment.lines.map((line): DailyPayLineInput => ({
      location:
        line.locationKind === "store"
          ? { kind: "store", storeId: toNum(line.storeId) ?? 0 }
          : { kind: "other", otherStore: line.otherStore.trim() },
      labour: buildLineLabour(payment.payShape, line),
      hourlyPaymentRate:
        shapeUsesRates(payment.payShape) && line.labourMode !== "lumpSum"
          ? toNum(line.hourlyPaymentRate)
          : null,
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
 * The patch for changing how a payee is paid.
 *
 * Nothing typed is cleared, so switching back restores it. Two conveniences,
 * both only into an EMPTY field so they can never overwrite a figure:
 *   - to "one price for the day": prefill with the stores' prices added up
 *   - to "a price per store" with one store: prefill it with the day's price
 * Going to hourly resets any store set to a fixed price back to its logged
 * hours -- a fixed store cannot sit on an hourly payment. Going from "a price
 * per store" to "store by store" keeps every store that has a price on its
 * price, so nothing typed silently turns into hours.
 *
 * `lumpSum` and `hourlyPaymentRate` are always in the patch, even unchanged,
 * so the dialog clears any error still showing on them from the old shape.
 */
export function switchPayShape(payment: PaymentForm, payShape: PaymentPayShape): Partial<PaymentForm> {
  let lumpSum = payment.lumpSum;
  let lines = payment.lines;

  if (payShape === "fixedDay" && toNum(lumpSum) == null) {
    const prices = lines.map((line) => toNum(line.lumpSum)).filter((v): v is number => v != null);
    if (prices.length > 0) {
      lumpSum = String(prices.reduce((cents, v) => cents + Math.round(v * 100), 0) / 100);
    }
  }

  if (payShape === "fixedPerStore" && lines.length === 1 && toNum(lines[0].lumpSum) == null) {
    const day = toNum(payment.lumpSum);
    if (day != null) lines = [{ ...lines[0], lumpSum: String(day) }];
  }

  if (payShape === "hourly") {
    lines = lines.map((line) =>
      line.labourMode === "lumpSum" ? { ...line, labourMode: "gather" as const } : line
    );
  }

  if (payShape === "mixed" && payment.payShape === "fixedPerStore") {
    lines = lines.map((line) =>
      toNum(line.lumpSum) != null ? { ...line, labourMode: "lumpSum" as const } : line
    );
  }

  return { payShape, lumpSum, hourlyPaymentRate: payment.hourlyPaymentRate, lines };
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
