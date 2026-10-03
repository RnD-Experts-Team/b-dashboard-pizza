/**
 * Dough & Sauce formulas — contract §6. Nothing on any server computes these;
 * if a figure is wrong, it is wrong here. The weights are constants by design
 * (there is no config endpoint): changing them is a coordinated change across
 * the contract, this file, and the Excel workbook people still check against.
 */

export const WEIGHTS = { variance: 0.6, stickers: 0.2, quality: 0.2 } as const;

/** 7 days × 3 ingredients. */
export const CELLS_PER_WEEK = 21;

/** §6.1 — the plan. Only ever for a NEW plan; a stored plan renders its own planned_qty (rule 4). */
export function plannedQty(base: number, bufferPct: number): number {
  return base * (1 + bufferPct / 100);
}

/** §6.2 */
export function variance(counted: number, planned: number): number {
  return counted - planned;
}

/** §6.3 / rule 5 — hitting the target exactly is a pass: `>=`, never `>`. */
export function isOk(v: number): boolean {
  return v >= 0;
}

export interface ScoreInput {
  cellsOk: number;
  stickers: "yes" | "no" | null | undefined;
  quality: "pass" | "fail" | null | undefined;
}

export interface ScoreBreakdown {
  variancePart: number;
  stickersPart: number;
  qualityPart: number;
  score: number;
}

/** §6.4 */
export function score({ cellsOk, stickers, quality }: ScoreInput): ScoreBreakdown {
  const variancePart = WEIGHTS.variance * (cellsOk / CELLS_PER_WEEK);
  const stickersPart = stickers === "yes" ? WEIGHTS.stickers : 0;
  const qualityPart = quality === "pass" ? WEIGHTS.quality : 0;
  return { variancePart, stickersPart, qualityPart, score: variancePart + stickersPart + qualityPart };
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
