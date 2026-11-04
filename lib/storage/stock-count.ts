/**
 * Stock count sheet maths (docs/MAINTENANCE-UI.md §6 "Count sheet").
 *
 * The server owns the numbers it stores (difference, value_difference and
 * the totals) and recomputes `expected` when the count is applied; this is
 * the same arithmetic for the sheet while someone types, so the sticky bar
 * (counted 12/40 · missing $ · extra $) moves with every keystroke.
 *
 * Quantities and money arrive as decimal strings; everything here works in
 * numbers and rounds money to cents.
 */

import { parseDecimal, roundCents } from "@/lib/maintenance/money";
import type { StockCountLine } from "@/types/maintenance-system";

export type CountLineState = "not_counted" | "match" | "missing" | "extra";

export interface CountLineView {
  partId: number;
  expected: number;
  /** null = not counted yet. */
  counted: number | null;
  /** counted − expected (negative = missing). */
  difference: number | null;
  unitCost: number | null;
  /** difference × unit cost, in dollars. */
  valueDifference: number | null;
  state: CountLineState;
}

export interface CountTotalsView {
  countedLines: number;
  totalLines: number;
  missingQuantity: number;
  missingValue: number;
  extraQuantity: number;
  extraValue: number;
}

/** What someone typed per part: a number string, "" = cleared (not counted). */
export type CountEdits = Record<number, string>;

/** The line's part id: `part_id` is always sent, `part` can be null (a deleted part). */
export function partIdOf(line: Pick<StockCountLine, "partId" | "part">): number {
  return line.partId ?? line.part?.id ?? 0;
}

/** Parses a typed count. "" / non-numbers → null; negatives are not counts. */
export function parseCounted(raw: string | number | null | undefined): number | null {
  const n = parseDecimal(raw);
  return n == null || n < 0 ? null : n;
}

export function stateOf(difference: number | null): CountLineState {
  if (difference == null) return "not_counted";
  if (difference < 0) return "missing";
  if (difference > 0) return "extra";
  return "match";
}

/** One line as the sheet shows it, with the typed value (if any) applied. */
export function countLineView(line: StockCountLine, edits: CountEdits = {}): CountLineView {
  const expected = parseDecimal(line.expected) ?? 0;
  const typed = Object.prototype.hasOwnProperty.call(edits, partIdOf(line)) ? edits[partIdOf(line)] : undefined;
  const counted = typed !== undefined ? parseCounted(typed) : parseCounted(line.counted);
  const difference = counted == null ? null : counted - expected;
  const unitCost = parseDecimal(line.unitCost);
  const valueDifference = difference == null || unitCost == null ? null : roundCents(difference * unitCost);
  return { partId: partIdOf(line), expected, counted, difference, unitCost, valueDifference, state: stateOf(difference) };
}

/** The sticky bar: counted n/N, missing qty/$, extra qty/$. */
export function countTotals(views: CountLineView[]): CountTotalsView {
  return views.reduce<CountTotalsView>(
    (acc, v) => {
      const next = { ...acc, totalLines: acc.totalLines + 1 };
      if (v.counted != null) next.countedLines += 1;
      if (v.state === "missing" && v.difference != null) {
        next.missingQuantity += -v.difference;
        next.missingValue = roundCents(next.missingValue + Math.abs(v.valueDifference ?? 0));
      }
      if (v.state === "extra" && v.difference != null) {
        next.extraQuantity += v.difference;
        next.extraValue = roundCents(next.extraValue + (v.valueDifference ?? 0));
      }
      return next;
    },
    { countedLines: 0, totalLines: 0, missingQuantity: 0, missingValue: 0, extraQuantity: 0, extraValue: 0 },
  );
}

/** The PATCH body for "Save draft": only lines whose typed value differs from the server's. */
export function changedCountLines(lines: StockCountLine[], edits: CountEdits): { partId: number; counted: number | null }[] {
  return lines
    .filter((line) => Object.prototype.hasOwnProperty.call(edits, partIdOf(line)))
    .map((line) => ({ partId: partIdOf(line), counted: parseCounted(edits[partIdOf(line)]) }))
    .filter((row, i, rows) => {
      const original = parseCounted(lines.find((l) => partIdOf(l) === rows[i].partId)?.counted ?? null);
      return original !== row.counted;
    });
}

/** The lines "Apply count" will correct (the confirm dialog's summary). */
export function correctionsOf(views: CountLineView[]): CountLineView[] {
  return views.filter((v) => v.state === "missing" || v.state === "extra");
}
