import type { CountRow, IngredientKey, StoredPlanRow } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import type { IngredientMap } from "./ingredient-map";
import { isOk, variance } from "./formulas";
import { daysBetween } from "./dates";

/**
 * One cell of the 7 × 3 week grid. The states must stay distinct (rule 2):
 * a real count of 0 is `counted`; a count that never happened is `missing`,
 * and is never folded into a zero.
 */
export type WeekCell =
  | {
      kind: "counted";
      date: string;
      key: IngredientKey;
      planned: number;
      counted: number;
      variance: number;
      ok: boolean;
      edited: boolean;
      duplicates: number;
    }
  | { kind: "missing"; date: string; key: IngredientKey; planned: number }
  /** Planned for today or a later day — not counted YET. Not a gap, and not a zero. */
  | { kind: "awaiting"; date: string; key: IngredientKey; planned: number }
  | { kind: "no-plan"; date: string; key: IngredientKey; counted: number | null }
  | { kind: "unavailable"; date: string; key: IngredientKey; planned: number | null };

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
 * A plan for date D is compared against the count dated D. Counts are
 * submitted at night, so a planned day from `today` onward without a count is
 * `awaiting`, not `missing` — only a PAST day can have been skipped.
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
        cells.push({ kind: "unavailable", date, key, planned: plan?.planned_qty ?? null });
        continue;
      }
      const count = counts.get(id);
      if (!plan) {
        noPlanCount++;
        cells.push({ kind: "no-plan", date, key, counted: count ? count.total_in_unit_1 : null });
        continue;
      }
      if (!count) {
        if (date >= today) {
          awaitingCount++;
          cells.push({ kind: "awaiting", date, key, planned: plan.planned_qty });
        } else {
          missingCount++;
          cells.push({ kind: "missing", date, key, planned: plan.planned_qty });
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
        planned: plan.planned_qty,
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
