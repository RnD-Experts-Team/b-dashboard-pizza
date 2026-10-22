/**
 * Dough & Sauce formulas — contract §6. Nothing on any server computes these;
 * if a figure is wrong, it is wrong here. The weights are constants by design
 * (there is no config endpoint): changing them is a coordinated change across
 * the contract, this file, and the Excel workbook people still check against.
 */

import type { IngredientKey } from "@/types/dough-sauce.types";

export const WEIGHTS ={ variance: 0.5, planning: 0.1, stickers: 0.2, quality: 0.2 } as const;

/** 7 days × 3 ingredients — the most a week can hold. The score divides by the cells actually planned. */
export const CELLS_PER_WEEK = 21;

/** §6.1 — the plan. Only ever for a NEW plan; a stored plan renders its own planned_qty (rule 4). */
export function plannedQty(base: number, bufferPct: number): number {
  return base * (1 + bufferPct / 100);
}

/**
 * The number before the buffer, recovered from a stored plan (the base is not stored — it is
 * derived from `planned_qty` and `buffer_pct`).
 */
export function baseQty(planned: number, bufferPct: number): number {
  return planned / (1 + bufferPct / 100);
}

/** 4-decimal precision, the same as the plan payload. Kept here so this file stays free of UI imports. */
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * What a count is judged against: the BASE, before the buffer. The buffer is a production margin
 * on top of the plan, not what inventory is held to (e.g. 388, not 481.12).
 *
 * Uses the server's `base_qty` when the plan line carries one, otherwise derives it from the stored
 * plan. Always rounded: 336 ÷ 1.12 is 299.99999999999994 in floating point, and a count exactly on the
 * base must not read "Over by 0".
 */
export function targetQty(planned: number, bufferPct: number, serverBase?: number | null): number {
  const base = typeof serverBase === "number" && Number.isFinite(serverBase) ? serverBase : baseQty(planned, bufferPct);
  return round4(base);
}

/** §6.2 — `target` is the base (see `targetQty`). */
export function variance(counted: number, target: number): number {
  return counted - target;
}

/** §6.3 / rule 5 — hitting the target exactly is a pass: `>=`, never `>`. */
export function isOk(v: number): boolean {
  return v >= 0;
}

/**
 * How far a count is from its base, as people read it: in plain steps, always rounded DOWN — whole numbers for the
 * sauce and the 18 OZ, halves for the 10 OZ (2.64 → 2.5, 0.8 → 0.5, 0.6 of a container → 0). Used by every screen
 * that shows "short by / over by", so they agree.
 */
export const GAP_STEP: Record<IngredientKey, number> = { sauce: 1, dough_18oz: 1, dough_10oz: 0.5 };
export const gapOf = (key: IngredientKey, v: number): number =>
  Math.floor(Math.abs(v) / GAP_STEP[key] + 1e-9) * GAP_STEP[key];

/**
 * A count passes when it meets the base OR falls short by less than one step (its gap rounds to 0). The cell, the
 * "on target" tally and the score all use this call, so what is drawn is what is scored.
 */
export const isOkWithinStep = (key: IngredientKey, v: number): boolean => isOk(v) || gapOf(key, v) === 0;

/**
 * The planning share is all or nothing: every day of the week has a confirmed plan (the report's Plan
 * column reads 7/7). 6/7 earns nothing — a week is either fully planned or it is not.
 */
export function isPlanComplete(daysConfirmed: number, dayCount: number): boolean {
  return dayCount > 0 && daysConfirmed >= dayCount;
}

export interface ScoreInput {
  cellsOk: number;
  /** The cells that were judged — planned and due a count, or unplanned and counted — the denominator. Not 21. */
  cellsScored: number;
  /** See `isPlanComplete`. */
  planComplete: boolean;
  stickers: "yes" | "no" | null | undefined;
  quality: "pass" | "fail" | null | undefined;
}

export interface ScoreBreakdown {
  variancePart: number;
  planningPart: number;
  stickersPart: number;
  qualityPart: number;
  score: number;
}

/**
 * §6.4 — only cells that can be judged are scored: planned cells, plus unplanned days that were counted
 * (judged against that day's base). With 2 planned days and nothing else counted the variance part is
 * over 6 cells, not 21. No scorable cell at all means no variance part (never a division by zero).
 */
export function score({ cellsOk, cellsScored, planComplete, stickers, quality }: ScoreInput): ScoreBreakdown {
  const variancePart = cellsScored > 0 ? WEIGHTS.variance * (cellsOk / cellsScored) : 0;
  const planningPart = planComplete ? WEIGHTS.planning : 0;
  const stickersPart = stickers === "yes" ? WEIGHTS.stickers : 0;
  const qualityPart = quality === "pass" ? WEIGHTS.quality : 0;
  return {
    variancePart,
    planningPart,
    stickersPart,
    qualityPart,
    score: variancePart + planningPart + stickersPart + qualityPart,
  };
}

/**
 * §6.5 — score minus the average of the previous weeks' scores. Weeks with no
 * computable score are skipped rather than counted as 0 (rule 2); with none
 * at all there is no progress to report.
 */
export function progress(current: number, previous: (number | null)[]): number | null {
  const known = previous.filter((s): s is number => s != null);
  if (known.length === 0) return null;
  return current - known.reduce((a, b) => a + b, 0) / known.length;
}

/** Scores that differ only by float noise (0.6 × 7/21 vs 0.2) are the same score. */
const sameScore = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** §6.6 — rank by score, descending. Ties share a rank (1, 2, 2, 4). */
export function rankBy<T>(rows: T[], getScore: (row: T) => number): Map<T, number> {
  const sorted = [...rows].sort((a, b) => getScore(b) - getScore(a));
  const ranks = new Map<T, number>();
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    ranks.set(row, i > 0 && sameScore(getScore(prev), getScore(row)) ? ranks.get(prev)! : i + 1);
  });
  return ranks;
}
