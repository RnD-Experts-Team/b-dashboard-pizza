import type { CountRow, IngredientKey, StoredPlanRow } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import { toBaseUnit, type IngredientMap } from "./ingredient-map";
import { isOkWithinStep, targetQty, variance } from "./formulas";
import { addDaysIso, daysBetween } from "./dates";

/**
 * One cell of the 7 × 3 week grid. The states must stay distinct (rule 2):
 * a real count of 0 is `counted`; a count that never happened is `missing`,
 * and is never folded into a zero.
 *
 * `date` is the PLAN's date. The count a cell is scored against is dated the day before it, and is
 * judged against the BASE (the plan before its buffer), not the buffered `planned` figure.
 */
export type WeekCell =
  | {
      kind: "counted";
      date: string;
      key: IngredientKey;
      /** The date of the count this plan was scored against — the day before `date`. */
      countDate: string;
      planned: number;
      /** The stored buffer — display only, so a cell can show the number before it. */
      bufferPct: number;
      /** The target: the plan before its buffer. `variance` and `ok` are measured from this. */
      base: number;
      /**
       * What the day is judged on, in the base's unit: the morning count when one was entered (0 included),
       * otherwise the night count (÷ `divisor`). `variance` and `ok` are measured with it.
       */
      counted: number;
      /** The night-before count in the base's unit; null when nobody took it (only possible with a morning count). */
      night: number | null;
      /** The first-shift morning count of `date` in the base's unit (typed ÷ `morningDivisor`); null = not counted, never shown as 0. */
      morning: number | null;
      /** The morning count as typed, and what it was divided by (1 = not converted). */
      rawMorning: number | null;
      morningDivisor: number;
      /** The night count as inventory recorded it, and what it was divided by (1 = not converted). */
      rawCounted: number | null;
      divisor: number;
      variance: number;
      ok: boolean;
      edited: boolean;
      duplicates: number;
    }
  | { kind: "missing"; date: string; key: IngredientKey; planned: number; bufferPct: number }
  /** Planned for today or a later day — not counted YET. Not a gap, and not a zero. */
  | { kind: "awaiting"; date: string; key: IngredientKey; planned: number; bufferPct: number }
  /**
   * No confirmed plan for this day. If the night-before count exists and the day's base was
   * supplied, the count is judged against that base (`ok`/`variance`) and, like a planned cell,
   * scored. Without a base (or without a count) there is nothing to judge: it stays out of the score.
   */
  | {
      kind: "no-plan";
      date: string;
      key: IngredientKey;
      countDate: string;
      /** Morning count if entered, else the night count, as for a planned cell; null while there is neither. */
      counted: number | null;
      night: number | null;
      morning: number | null;
      rawMorning: number | null;
      morningDivisor: number;
      /** The night count as recorded by inventory, and the divisor it was converted with (1 = not converted). */
      rawCounted: number | null;
      divisor: number;
      base: number | null;
      variance: number | null;
      ok: boolean | null;
    }
  | { kind: "unavailable"; date: string; key: IngredientKey; planned: number | null; bufferPct: number | null };

export interface WeekCells {
  days: string[];
  cells: WeekCell[];
  cellsOk: number;
  /**
   * The cells that count toward the score: planned cells that were counted or are past due a count,
   * plus unplanned cells that were counted and judged against their base. A plan still `awaiting` its
   * count is not in it (so planning tomorrow doesn't lower today's score), and neither is an unplanned
   * day nobody counted. This is the score's denominator — not 21.
   */
  cellsScored: number;
  /** Past days that were planned but never counted — the real gaps. */
  missingCount: number;
  /** Planned days that can't have been counted yet (today or later). */
  awaitingCount: number;
  noPlanCount: number;
  /** Any plan row at all this week. */
  hasPlans: boolean;
}

/**
 * Index counts by `${date}|${ingredientKey}`. With `all_entries=false` the
 * inventory API already returns only the latest count per store/date, so an
 * absent key is exactly the "never counted" case `meta.missing` reports.
 */
export function indexCounts(rows: CountRow[], map: IngredientMap): Map<string, CountRow> {
  const out = new Map<string, CountRow>();
  for (const row of rows) {
    const key = map.keyOf[row.ultimatrix_id];
    if (key) out.set(`${row.date}|${key}`, row);
  }
  return out;
}

/**
 * The days of a store-week that have NO plan but whose night-before count exists: the days whose base
 * has to be looked up before the count can be judged — and scored.
 */
export function unplannedCountedDays(
  weekStart: string,
  weekEnd: string,
  plans: StoredPlanRow[],
  counts: Map<string, CountRow>
): string[] {
  const planned = new Set(plans.map((p) => p.plan_date));
  return daysBetween(weekStart, weekEnd).filter(
    (date) => !planned.has(date) && INGREDIENT_KEYS.some((k) => counts.has(`${addDaysIso(date, -1)}|${k}`))
  );
}

/**
 * Every (day, needsBase) of a store-week whose `daily-plans` answer has to be read before its cells can be judged:
 * unplanned counted days need the base AND the morning count; planned days up to today need only the morning
 * count (the morning count of a later day can't exist yet).
 */
export function lookupDays(
  weekStart: string,
  weekEnd: string,
  plans: StoredPlanRow[],
  counts: Map<string, CountRow>,
  today: string
): { date: string; needsBase: boolean }[] {
  const planned = new Set(plans.map((p) => p.plan_date));
  const unplanned = new Set(unplannedCountedDays(weekStart, weekEnd, plans, counts));
  return daysBetween(weekStart, weekEnd)
    .filter((date) => unplanned.has(date) || (planned.has(date) && date <= today))
    .map((date) => ({ date, needsBase: unplanned.has(date) }));
}

/**
 * Build a store-week grid. `counts` null means the inventory system was
 * unreachable — every cell shows as unavailable, never as zero (§9).
 *
 * A plan for date D is compared against the count dated D − 1: the inventory
 * taken on the night of the 12th is what has to meet the plan for the 13th.
 * Counts are submitted at night, so a plan whose count is dated `today` or
 * later is `awaiting`, not `missing` — only a count date already past can have
 * been skipped. `counts` therefore has to cover the day before `weekStart`.
 *
 * The count is judged against the plan's BASE (before its buffer), derived from the stored
 * `planned_qty` and `buffer_pct` — the buffer is a production margin, not the inventory target.
 *
 * `countDivisor` converts a count that inventory records in raw portions (the 10 OZ dough, in single balls)
 * into the unit the base is in (units of 12) BEFORE it is compared — otherwise a raw 10 would "beat" a base of 5.7.
 *
 * `bases` (optional, keyed `${date}|${ingredientKey}`) carries the base of days that have NO plan, so a
 * count taken for such a day is still judged: it shows ✓/✕ and enters `cellsOk` / `cellsScored` like a
 * planned cell. Until the base is supplied the cell stays "–" and unscored.
 *
 * What a day is judged on: the first-shift MORNING count of the plan's own day when one was entered — a real 0
 * included, typed in raw portions so ÷ `morningDivisor` (12 for the 10 OZ dough only; the sauce and the 18 OZ are as typed) — and it REPLACES the
 * night count; when nobody answered, the night-before count (÷ `countDivisor`) is used. `mornings` (keyed
 * `${date}|${ingredientKey}`) holds only answers; a missing entry = not counted. A morning count also stands in for a
 * night count nobody took.
 */
export function buildWeekCells(
  weekStart: string,
  weekEnd: string,
  plans: StoredPlanRow[],
  counts: Map<string, CountRow> | null,
  today: string,
  bases?: Map<string, number>,
  countDivisor?: IngredientMap["countDivisor"],
  mornings?: Map<string, number>,
  morningDivisors?: IngredientMap["morningDivisor"]
): WeekCells {
  const days = daysBetween(weekStart, weekEnd);
  const planByCell = new Map<string, StoredPlanRow>();
  for (const p of plans) planByCell.set(`${p.plan_date}|${p.ingredient_key}`, p);

  const cells: WeekCell[] = [];
  let cellsOk = 0;
  let cellsScored = 0;
  let missingCount = 0;
  let awaitingCount = 0;
  let noPlanCount = 0;

  for (const date of days) {
    // The night-before count, not the one dated `date` (see above).
    const countDate = addDaysIso(date, -1);
    for (const key of INGREDIENT_KEYS) {
      const id = `${date}|${key}`;
      const plan = planByCell.get(id);
      if (counts === null) {
        // Inventory is down: nothing can be judged, but a plan already past due is still a planned cell.
        if (plan && countDate < today) cellsScored++;
        cells.push({
          kind: "unavailable",
          date,
          key,
          planned: plan?.planned_qty ?? null,
          bufferPct: plan?.buffer_pct ?? null,
        });
        continue;
      }
      const count = counts.get(`${countDate}|${key}`);
      if (!plan) {
        noPlanCount++;
        const divisor = countDivisor?.[key] ?? 1;
        const rawCounted = count ? count.total_in_unit_1 : null;
        const night = rawCounted != null ? toBaseUnit(rawCounted, divisor) : null;
        const rawMorning = mornings?.get(id) ?? null;
        const morningDivisor = morningDivisors?.[key] ?? 1;
        const morning = rawMorning != null ? toBaseUnit(rawMorning, morningDivisor) : null;
        const counted = morning ?? night;
        const base = bases?.get(id) ?? null;
        const v = counted != null && base != null ? variance(counted, base) : null;
        const ok = v != null ? isOkWithinStep(key, v) : null;
        // A counted day with a base is judged exactly like a planned one — it must not slip out of the score.
        if (ok != null) {
          cellsScored++;
          if (ok) cellsOk++;
        }
        cells.push({ kind: "no-plan", date, key, countDate, counted, night, morning, rawMorning, morningDivisor, rawCounted, divisor, base, variance: v, ok });
        continue;
      }
      const rawMorning = mornings?.get(id) ?? null;
      if (!count && rawMorning == null) {
        if (countDate >= today) {
          awaitingCount++;
          cells.push({ kind: "awaiting", date, key, planned: plan.planned_qty, bufferPct: plan.buffer_pct });
        } else {
          missingCount++;
          cellsScored++;
          cells.push({ kind: "missing", date, key, planned: plan.planned_qty, bufferPct: plan.buffer_pct });
        }
        continue;
      }
      const base = targetQty(plan.planned_qty, plan.buffer_pct);
      const divisor = countDivisor?.[key] ?? 1;
      const night = count ? toBaseUnit(count.total_in_unit_1, divisor) : null;
      const morningDivisor = morningDivisors?.[key] ?? 1;
      const morning = rawMorning != null ? toBaseUnit(rawMorning, morningDivisor) : null;
      // Either the morning count or the night count exists here (the guard above). A morning answer wins.
      const counted = (morning ?? night)!;
      const v = variance(counted, base);
      const ok = isOkWithinStep(key, v);
      cellsScored++;
      if (ok) cellsOk++;
      cells.push({
        kind: "counted",
        date,
        key,
        countDate,
        planned: plan.planned_qty,
        bufferPct: plan.buffer_pct,
        base,
        counted,
        night,
        morning,
        rawMorning,
        morningDivisor,
        rawCounted: count ? count.total_in_unit_1 : null,
        divisor,
        variance: v,
        ok,
        edited: count?.is_edited ?? false,
        duplicates: count?.duplicate_entries ?? 0,
      });
    }
  }

  return { days, cells, cellsOk, cellsScored, missingCount, awaitingCount, noPlanCount, hasPlans: plans.length > 0 };
}
