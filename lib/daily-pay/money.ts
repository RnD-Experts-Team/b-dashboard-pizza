/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — money and hours formulas                                     */
/*                                                                            */
/*  DISPLAY AND PREVIEW ONLY. The server is authoritative for every figure    */
/*  it sends: prefer `payment.totalAmount` / `line.lineTotal` over anything   */
/*  computed here. These exist so the form can show a live preview before a   */
/*  save, and so a missing server figure degrades to a computed one rather    */
/*  than to a blank.                                                          */
/*                                                                            */
/*  The reference formulas, from the backend spec:                            */
/*                                                                            */
/*    payable hours = work + travel + parts_run      (break is NOT paid)      */
/*    line labour   = line lump_sum ?? payable hours × rate                   */
/*    line_total    = line labour + line gas + line money_owed                */
/*                    + reimbursable parts attributed to that store           */
/*                                                                            */
/*    total_amount  = (payment lump_sum ?? Σ line labour)                     */
/*                    + Σ (line gas + line money_owed)                        */
/*                    + payment gas + payment money_owed                      */
/*                    + reimbursable parts, counted ONCE at payment level     */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  DailyPayEntry,
  DailyPayGathered,
  DailyPayLine,
  DailyPayPayment,
} from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Integer-cents arithmetic                                                 */
/*                                                                            */
/*  Summing 49.99-class floats produces artifacts like 0.30000000000000004,   */
/*  and a preview that disagrees with the server by a cent gets filed as a    */
/*  bug. So: convert to cents, sum as integers, convert back at the boundary. */
/*  Never round in the middle of a sum — that compounds the error.            */
/* ────────────────────────────────────────────────────────────────────────── */

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

/** Sums the non-null members in cents. Returns null only when ALL are null. */
function sumMoney(values: (number | null | undefined)[]): number | null {
  let cents = 0;
  let seen = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    cents += toCents(v);
    seen = true;
  }
  return seen ? fromCents(cents) : null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hours                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The hours that actually get paid: work + travel + parts run.
 *
 * BREAK IS DELIBERATELY EXCLUDED — it is tracked but not paid. Adding
 * `breakHours` here would silently overpay every gathered line.
 */
export function payableHours(gathered: DailyPayGathered | null): number | null {
  if (!gathered) return null;
  const parts = [gathered.workHours, gathered.travelHours, gathered.partsRunHours];
  let total = 0;
  let seen = false;
  for (const v of parts) {
    if (v == null || !Number.isFinite(v)) continue;
    total += v;
    seen = true;
  }
  return seen ? total : null;
}

/**
 * The hours a line is actually paid on: an explicit override if there is one,
 * otherwise the gathered payable figure.
 */
export function effectiveHours(line: DailyPayLine): number | null {
  if (line.totalWorkingHours != null) return line.totalWorkingHours;
  return payableHours(line.gathered);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rates and labour                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A line's own rate wins, otherwise the payment's, otherwise zero.
 *
 * MUST use `??`, never `||`. A rate of 0 is a legitimate value — with `||` a
 * zero line rate would fall through to the payment's rate and pay out money
 * that should not be paid.
 */
export function resolveRate(line: DailyPayLine, payment: DailyPayPayment): number {
  return line.hourlyPaymentRate ?? payment.hourlyPaymentRate ?? 0;
}

/**
 * A line's labour cost. A LUMP SUM REPLACES hourly labour, it does not add to
 * it — hence `??` rather than a sum.
 */
export function lineLabour(line: DailyPayLine, payment: DailyPayPayment): number | null {
  if (line.lumpSum != null) return line.lumpSum;
  const hours = effectiveHours(line);
  if (hours == null) return null;
  return fromCents(Math.round(hours * resolveRate(line, payment) * 100));
}

/**
 * Preview of one line's total. Prefer `line.lineTotal` from the server.
 *
 * Note this deliberately omits reimbursable parts: the line-level figure is an
 * ATTRIBUTED subset of money already counted once at payment level, and adding
 * it here would let a caller double-count by summing line totals.
 */
export function lineTotalPreview(line: DailyPayLine, payment: DailyPayPayment): number | null {
  return sumMoney([lineLabour(line, payment), line.gas, line.moneyOwed]);
}

/**
 * Preview of a payment's payable total. Prefer `payment.totalAmount`.
 *
 * A payment-level lump sum replaces ALL of its lines' labour, so the two
 * branches are exclusive. Reimbursable parts are added ONCE, from the
 * payment's own gathered block — never by summing the lines.
 */
export function paymentTotalPreview(payment: DailyPayPayment): number | null {
  const lines = payment.lines ?? [];

  const labour =
    payment.lumpSum != null
      ? payment.lumpSum
      : sumMoney(lines.map((line) => lineLabour(line, payment)));

  return sumMoney([
    labour,
    sumMoney(lines.map((line) => line.gas)),
    sumMoney(lines.map((line) => line.moneyOwed)),
    payment.gas,
    payment.moneyOwed,
    payment.gathered?.reimbursableParts ?? null,
  ]);
}

/**
 * An entry's total: the server's figure when present, otherwise the sum across
 * payments.
 *
 * Returns null — not 0 — when `payments` is null, because null means the
 * relation was not loaded. Rendering "$0.00" there would tell the user an
 * entry is worth nothing.
 */
export function entryTotal(entry: DailyPayEntry): number | null {
  if (entry.totalAmount != null) return entry.totalAmount;
  if (entry.payments == null) return null;
  return sumMoney(
    entry.payments.map((p) => (p.totalAmount != null ? p.totalAmount : paymentTotalPreview(p)))
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Formatters — all render an em dash for null, never a zero                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function formatHours(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

/**
 * Rates arrive at 4 decimal places ("18.0000"). Trim to 2 unless the extra
 * digits are actually significant, so the UI reads "$18.00/h" not "$18.0000/h".
 */
export function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const twoDp = Number(value.toFixed(2));
  const text = twoDp === value ? value.toFixed(2) : value.toFixed(4);
  return `$${text}`;
}

/** "8.00 h × $18.00" — the labour basis, for a detail row. */
export function formatLabourBasis(line: DailyPayLine, payment: DailyPayPayment): string {
  if (line.lumpSum != null) return `${formatMoney(line.lumpSum)} lump sum`;
  const hours = effectiveHours(line);
  if (hours == null) return "—";
  return `${formatHours(hours)} h × ${formatRate(resolveRate(line, payment))}`;
}
