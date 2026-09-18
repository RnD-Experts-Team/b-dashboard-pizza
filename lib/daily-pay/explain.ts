/**
 * The pay sheet, explained in a sentence.
 *
 * Daily Pay has four traps, and all four are the same trap: a number is on
 * screen doing something other than what it looks like it is doing.
 *
 *   1. A lump sum silently REPLACES hours × rate. Both stay visible, so people
 *      fill in hours and wonder why the total ignores them.
 *   2. "Money owed" sounds like the total. It is an extra on top.
 *   3. Hours arrive from attendance UNLESS somebody typed over them, and then
 *      Recalculate skips that line forever. Nothing on screen said which.
 *   4. Break time is collected, shown next to work, travel and parts run, and
 *      then excluded from the money.
 *
 * None of that is fixable by relabelling one field, because the problem is that
 * the relationship between the fields is invisible. So this produces the whole
 * calculation as an ordered list of plain lines that add up to the figure shown
 * -- every number on screen appears in it, and anything that does NOT count
 * says so in the same breath.
 *
 * DISPLAY ONLY. The server is authoritative; this mirrors `lib/daily-pay/money.ts`,
 * which mirrors the backend formula. Where a server figure exists, prefer it.
 */

import type { DailyPayLine, DailyPayPayment } from "@/types/daily-pay.types";
import {
  effectiveHours,
  formatHours,
  formatMoney,
  formatRate,
  lineLabour,
  payableHours,
  resolveRate,
} from "./money";

export interface ExplainLine {
  /** What this row is, in words. */
  label: string;
  /** The money it contributes, already formatted. Null for a row that adds nothing. */
  amount: string | null;
  /** How it was arrived at, when that is not obvious. */
  detail?: string;
  /**
   * `excluded` rows are shown but struck from the sum -- break time, and any
   * field a lump sum has overridden. Showing them greyed is the point: it is
   * how the rule gets learned instead of explained.
   */
  kind: "adds" | "excluded" | "total";
}

/** How this payee is being paid. The fork that removes trap 1 by construction. */
export type PayShape = "hourly" | "fixed";

/**
 * A payment is on a fixed amount when a lump sum is set at either level.
 * Derived, not stored: the API has no such field, and inferring it here means
 * an existing sheet opens in the right shape without a migration.
 */
export function payShapeOf(payment: DailyPayPayment): PayShape {
  if (payment.lumpSum != null) return "fixed";
  if ((payment.lines ?? []).some((l) => l.lumpSum != null)) return "fixed";
  return "hourly";
}

/**
 * One line's calculation, in order.
 *
 * The hours rows come first even when a lump sum is set -- struck through
 * rather than hidden, so someone who typed six hours can see exactly why the
 * total ignores them.
 */
export function explainLine(line: DailyPayLine, payment: DailyPayPayment): ExplainLine[] {
  const out: ExplainLine[] = [];
  const rate = resolveRate(line, payment);
  const hours = effectiveHours(line);
  const usingLumpSum = line.lumpSum != null;

  if (hours != null && hours > 0) {
    out.push({
      label: `${formatHours(hours)} of paid time`,
      detail: `work, travel and parts runs at ${formatRate(rate)} an hour`,
      amount: usingLumpSum ? null : formatMoney(hours * rate),
      // The heart of trap 1, made visible.
      kind: usingLumpSum ? "excluded" : "adds",
    });
  }

  // Break is the one bucket that is collected and never paid. It gets a row so
  // that fact is on screen rather than in someone's memory.
  const lineBreak = line.gathered?.breakHours ?? null;
  if (lineBreak != null && lineBreak > 0) {
    out.push({
      label: `${formatHours(lineBreak)} on break`,
      detail: "break time is not paid",
      amount: null,
      kind: "excluded",
    });
  }

  if (usingLumpSum) {
    out.push({
      label: "Fixed amount for this store",
      detail: "agreed up front, so the hours above do not count",
      amount: formatMoney(line.lumpSum),
      kind: "adds",
    });
  }

  if (line.gas != null && line.gas > 0) {
    out.push({ label: "Fuel", amount: formatMoney(line.gas), kind: "adds" });
  }

  // Trap 2: named so it reads as an addition, because that is what it is.
  if (line.moneyOwed != null && line.moneyOwed > 0) {
    out.push({
      label: "Extra owed",
      detail: "an amount on top, not the total",
      amount: formatMoney(line.moneyOwed),
      kind: "adds",
    });
  }

  const lineParts = line.gathered?.reimbursableParts ?? null;
  if (lineParts != null && lineParts > 0) {
    out.push({
      label: "Parts they paid for",
      detail: "reimbursed at what they were out of pocket after returns",
      amount: formatMoney(lineParts),
      kind: "adds",
    });
  }

  const total = lineLabour(line, payment);
  if (total != null || out.length > 0) {
    out.push({
      label: line.store?.storeNumber ?? line.otherStore ?? "This store",
      amount: formatMoney(line.lineTotal),
      kind: "total",
    });
  }

  return out;
}

/**
 * The whole payment, ending in the one figure that is actually owed.
 *
 * `totalAmount` and `linesTotal` are genuinely different numbers upstream --
 * line-level reimbursable parts are inside `linesTotal` but are not re-added to
 * `totalAmount`, because the payment-level frozen figure already covers them.
 * Showing both invites the wrong one to be read as the answer, so only
 * `totalAmount` is presented, and it is labelled as what we owe.
 */
export function explainPayment(payment: DailyPayPayment): ExplainLine[] {
  const out: ExplainLine[] = [];
  const shape = payShapeOf(payment);

  if (shape === "fixed" && payment.lumpSum != null) {
    out.push({
      label: "Fixed amount for the day",
      detail: "agreed up front, so the hours do not count",
      amount: formatMoney(payment.lumpSum),
      kind: "adds",
    });
  } else {
    for (const line of payment.lines ?? []) {
      const labour = lineLabour(line, payment);
      if (labour == null || labour === 0) continue;
      out.push({
        label: line.store?.storeNumber ?? line.otherStore ?? "Store",
        detail:
          line.lumpSum != null
            ? "fixed amount for that store"
            : `${formatHours(effectiveHours(line))} at ${formatRate(resolveRate(line, payment))}`,
        amount: formatMoney(labour),
        kind: "adds",
      });
    }
  }

  const extraGas =
    (payment.gas ?? 0) + (payment.lines ?? []).reduce((sum, l) => sum + (l.gas ?? 0), 0);
  if (extraGas > 0) {
    out.push({ label: "Fuel", amount: formatMoney(extraGas), kind: "adds" });
  }

  const extraOwed =
    (payment.moneyOwed ?? 0) +
    (payment.lines ?? []).reduce((sum, l) => sum + (l.moneyOwed ?? 0), 0);
  if (extraOwed > 0) {
    out.push({
      label: "Extra owed",
      detail: "an amount on top, not the total",
      amount: formatMoney(extraOwed),
      kind: "adds",
    });
  }

  const paymentParts = payment.gathered?.reimbursableParts ?? null;
  if (paymentParts != null && paymentParts > 0) {
    out.push({
      label: "Parts they paid for",
      detail: "counted once across every store",
      amount: formatMoney(paymentParts),
      kind: "adds",
    });
  }

  const breakHours = payment.gathered?.breakHours ?? 0;
  if (breakHours > 0) {
    out.push({
      label: `${formatHours(breakHours)} on break`,
      detail: "break time is not paid",
      amount: null,
      kind: "excluded",
    });
  }

  out.push({
    label: `We owe ${payment.technician?.name ?? "them"}`,
    amount: formatMoney(payment.totalAmount),
    kind: "total",
  });

  return out;
}

/**
 * Whether a line's hours are live or frozen by hand.
 *
 * Trap 3. `hoursOverridden` means somebody typed the hours, and Recalculate
 * will skip that line from then on -- silently, today. The UI has to say which
 * it is, because "recalculate did nothing" is otherwise indistinguishable from
 * "recalculate found nothing to change".
 */
export function hoursSource(line: DailyPayLine): {
  isOverridden: boolean;
  label: string;
  detail: string;
} {
  if (line.hoursOverridden) {
    return {
      isOverridden: true,
      label: "Typed by hand",
      detail: "Recalculating will leave these alone. Clear them to go back to the logged hours.",
    };
  }
  return {
    isOverridden: false,
    label: "From the logged hours",
    detail: "Taken from the attendance recorded against these issues, and kept up to date.",
  };
}

/** Everything that was gathered, whether it is paid or not, for the strip that
 *  shows where the hours came from. Break is listed with the rest and marked
 *  unpaid, rather than left out -- leaving it out is how people end up thinking
 *  it was forgotten. */
export function gatheredBuckets(payment: DailyPayPayment): Array<{
  label: string;
  hours: number | null;
  paid: boolean;
}> {
  const g = payment.gathered;
  return [
    { label: "Worked", hours: g?.workHours ?? null, paid: true },
    { label: "Travelled", hours: g?.travelHours ?? null, paid: true },
    { label: "Parts runs", hours: g?.partsRunHours ?? null, paid: true },
    // Listed WITH the paid buckets and marked unpaid, rather than left out.
    // Omitting it is how people end up thinking it was forgotten.
    { label: "On break", hours: g?.breakHours ?? null, paid: false },
  ];
}

/** Total paid hours, for the headline. Mirrors `payableHours`. */
export function paidHoursOf(payment: DailyPayPayment): number | null {
  return payableHours(payment.gathered);
}
