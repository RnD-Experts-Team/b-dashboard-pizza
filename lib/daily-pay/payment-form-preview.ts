/**
 * What a payment in the form will come to, before it is saved.
 *
 * `explain.ts` does this for a SAVED payment, from the server's frozen figures.
 * This does it for the form, where some of the money is not knowable yet: the
 * logged hours and the reimbursable parts are only gathered by the server on
 * save. Those rows are marked `pending` and said out loud, rather than being
 * counted as zero -- a preview that shows $0 for "not counted yet" is a preview
 * that lies.
 *
 * Every row says which of the three pay shapes put it there, and rows that do
 * NOT count (a store covered by the day's price, break time) are listed as
 * `excluded`, with the reason. That is the point: someone who has never been
 * trained can read the total and see why it is that number.
 *
 * DISPLAY ONLY. The server's `total_amount` is authoritative once saved.
 */

import { effectiveLineLabour, toNum, type LineForm, type PaymentForm } from "./entry-form-state";
import { formatHours, formatRate, payableHours } from "./money";

export interface PreviewRow {
  label: string;
  detail?: string;
  /** Null when the row adds nothing, or its amount is not known until save. */
  amount: number | null;
  /**
   * adds     -- counted in the total
   * pending  -- will count, but the server works the figure out on save
   * excluded -- shown so nobody wonders where it went, but not paid
   */
  kind: "adds" | "pending" | "excluded";
  /** For `pending` rows: waiting on the server's gather, or on the person. */
  waitingOn?: "save" | "you";
}

export interface PaymentFormPreview {
  rows: PreviewRow[];
  /** Sum of the `adds` rows. */
  known: number;
  /** True when any row is still `pending` -- the total is then a floor. */
  hasPending: boolean;
}

/** Integer cents, so the preview never disagrees with the server by 0.01. */
function cents(value: number): number {
  return Math.round(value * 100);
}

function sumStrings(values: string[]): number {
  return values.reduce((acc, v) => acc + cents(toNum(v) ?? 0), 0) / 100;
}

export function previewPaymentForm(
  payment: PaymentForm,
  storeLabel: (line: LineForm, index: number) => string
): PaymentFormPreview {
  const rows: PreviewRow[] = [];
  const shape = payment.payShape;
  const defaultRate = toNum(payment.hourlyPaymentRate);

  /* ── Labour: one branch per shape ─────────────────────────────────────── */

  if (shape === "fixedDay") {
    const day = toNum(payment.lumpSum);
    rows.push(
      day != null
        ? { label: "Price for the day", detail: "covers every store below", amount: day, kind: "adds" }
        : { label: "Price for the day", detail: "not entered yet", amount: null, kind: "pending", waitingOn: "you" }
    );
    payment.lines.forEach((line, j) => {
      rows.push({
        label: storeLabel(line, j),
        detail: "covered by the day's price — its hours are a record only",
        amount: null,
        kind: "excluded",
      });
    });
  }

  // "A price per store", and every store: hours or a price, per store. One
  // loop for all three, because under "store by store" a single payment has
  // both kinds of row.
  if (shape === "fixedPerStore" || shape === "hourly" || shape === "mixed") {
    payment.lines.forEach((line, j) => {
      const label = storeLabel(line, j);
      const labour = effectiveLineLabour(shape, line);

      if (labour === "lumpSum") {
        if (shape === "hourly") {
          // Defensive: switching to hourly resets fixed stores.
          rows.push({
            label,
            detail: "has a fixed price, which an hourly payment cannot use",
            amount: null,
            kind: "excluded",
          });
          return;
        }
        const price = toNum(line.lumpSum);
        rows.push(
          price != null
            ? { label, detail: "fixed price", amount: price, kind: "adds" }
            : { label, detail: "price not entered yet", amount: null, kind: "pending", waitingOn: "you" }
        );
        return;
      }

      const rate = toNum(line.hourlyPaymentRate) ?? defaultRate;
      const rateText =
        rate == null ? "no rate yet" : `${formatRate(rate)}/h${toNum(line.hourlyPaymentRate) != null ? " (its own rate)" : ""}`;

      const hours =
        labour === "hours" ? toNum(line.totalWorkingHours) : payableHours(line.gathered);

      if (hours == null) {
        rows.push({
          label,
          detail: `logged hours × ${rateText} — hours are counted when you save`,
          amount: null,
          kind: "pending",
          waitingOn: rate == null ? "you" : "save",
        });
        return;
      }

      if (rate == null) {
        rows.push({
          label,
          detail: `${formatHours(hours)} h × no rate yet`,
          amount: null,
          kind: "pending",
          waitingOn: "you",
        });
        return;
      }

      rows.push({
        label,
        detail:
          labour === "hours"
            ? `${formatHours(hours)} h typed in × ${rateText}`
            : `${formatHours(hours)} logged h × ${rateText} (as of the last save)`,
        amount: cents(hours * rate) / 100,
        kind: "adds",
      });
    });
  }

  /* ── On top, in every shape ───────────────────────────────────────────── */

  const gas = sumStrings([payment.gas, ...payment.lines.map((l) => l.gas)]);
  if (gas > 0) {
    rows.push({ label: "Gas", detail: "on top of the pay", amount: gas, kind: "adds" });
  }

  const owed = sumStrings([payment.moneyOwed, ...payment.lines.map((l) => l.moneyOwed)]);
  if (owed > 0) {
    rows.push({ label: "Additional owed", detail: "on top of the pay", amount: owed, kind: "adds" });
  }

  // Always listed, even at zero or unknown: "does this include the part they
  // bought?" is the question it answers. Not counted towards `hasPending`:
  // most payments have no parts, and a total that always read "so far" because
  // of a maybe would stop meaning anything.
  const parts = payment.gathered?.reimbursableParts ?? null;
  if (parts != null && parts > 0) {
    rows.push({
      label: "Parts they paid for",
      detail: "as of the last save — re-counted when you save",
      amount: parts,
      kind: "adds",
    });
  } else {
    rows.push({
      label: "Parts they paid for",
      detail: parts != null ? "none found on the last save" : "added automatically when you save, if any",
      amount: null,
      kind: parts != null ? "excluded" : "pending",
      waitingOn: "save",
    });
  }
  const partsRow = rows[rows.length - 1];

  // Only worth saying where some store is actually paid by the hour.
  const paidByTheHour = (line: LineForm) => {
    const labour = effectiveLineLabour(shape, line);
    return labour === "gather" || labour === "hours";
  };
  if (payment.lines.some(paidByTheHour)) {
    rows.push({
      label: "Break time",
      detail: "never paid",
      amount: null,
      kind: "excluded",
    });
  }

  const known =
    rows
      .filter((r) => r.kind === "adds" && r.amount != null)
      .reduce((acc, r) => acc + cents(r.amount ?? 0), 0) / 100;

  return { rows, known, hasPending: rows.some((r) => r.kind === "pending" && r !== partsRow) };
}
