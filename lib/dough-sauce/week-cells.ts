import type { CountRow, IngredientKey, StoredPlanRow } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import type { IngredientMap } from "./ingredient-map";
import { isOk, variance } from "./formulas";
import { addDaysIso, daysBetween } from "./dates";

/**
 * One cell of the 7 × 3 week grid. The states must stay distinct (rule 2):
 * a real count of 0 is `counted`; a count that never happened is `missing`,
 * and is never folded into a zero.
 *
 * `date` is the PLAN's date. The count a cell is scored against is dated the day before it.
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
      counted: number;
      variance: number;
      ok: boolean;
      edited: boolean;
      duplicates: number;
    }
  | { kind: "missing"; date: string; key: IngredientKey; planned: number; bufferPct: number }
  /** Planned for today or a later day — not counted YET. Not a gap, and not a zero. */
  | { kind: "awaiting"; date: string; key: IngredientKey; planned: number; bufferPct: number }
  | { kind: "no-plan"; date: string; key: IngredientKey; counted: number | null }
  | { kind: "unavailable"; date: string; key: IngredientKey; planned: number | null; bufferPct: number | null };

export interface WeekCells {
  days: string[];
  cells: WeekCell[];
  cellsOk: number;
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
 * Build a store-week grid. `counts` null means the inventory system was
 * unreachable — every cell shows as unavailable, never as zero (§9).
 *
 * A plan for date D is compared against the count dated D − 1: the inventory
 * taken on the night of the 12th is what has to meet the plan for the 13th.
 * Counts are submitted at night, so a plan whose count is dated `today` or
 * later is `awaiting`, not `missing` — only a count date already past can have
 * been skipped. `counts` therefore has to cover the day before `weekStart`.
 */
export function buildWeekCells(
  weekStart: string,
  weekEnd: string,
  plans: StoredPlanRow[],
  counts: Map<string, CountRow> | null,
  today: string
): WeekCells {
  const days = daysBetween(weekStart, weekEnd);
  const planByCell = new Map<string, StoredPlanRow>();
  // Rule 4 — the stored planned_qty is the target, never base × current buffer.
  for (const p of plans) planByCell.set(`${p.plan_date}|${p.ingredient_key}`, p);

  const cells: WeekCell[] = [];
  let cellsOk = 0;
  let missingCount = 0;
  let awaitingCount = 0;
  let noPlanCount = 0;

  for (const date of days) {
    for (const key of INGREDIENT_KEYS) {
      const id = `${date}|${key}`;
      const plan = planByCell.get(id);
      if (counts === null) {
        cells.push({
          kind: "unavailable",
          date,
          key,
          planned: plan?.planned_qty ?? null,
          bufferPct: plan?.buffer_pct ?? null,
        });
        continue;
      }
      // The night-before count, not the one dated `date` (see above).
      const countDate = addDaysIso(date, -1);
      const count = counts.get(`${countDate}|${key}`);
      if (!plan) {
        noPlanCount++;
        cells.push({ kind: "no-plan", date, key, counted: count ? count.total_in_unit_1 : null });
        continue;
      }
      if (!count) {
        if (countDate >= today) {
          awaitingCount++;
          cells.push({ kind: "awaiting", date, key, planned: plan.planned_qty, bufferPct: plan.buffer_pct });
        } else {
          missingCount++;
          cells.push({ kind: "missing", date, key, planned: plan.planned_qty, bufferPct: plan.buffer_pct });
        }
        continue;
      }
      const v = variance(count.total_in_unit_1, plan.planned_qty);
      const ok = isOk(v);
      if (ok) cellsOk++;
      cells.push({
        kind: "counted",
        date,
        key,
        countDate,
        planned: plan.planned_qty,
        bufferPct: plan.buffer_pct,
        counted: count.total_in_unit_1,
        variance: v,
        ok,
        edited: count.is_edited,
        duplicates: count.duplicate_entries,
      });
    }
  }

  return { days, cells, cellsOk, missingCount, awaitingCount, noPlanCount, hasPlans: plans.length > 0 };
}
