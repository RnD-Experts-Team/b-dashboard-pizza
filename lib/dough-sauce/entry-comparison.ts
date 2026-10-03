import type { IngredientKey, Plan } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import type { EntryItem } from "@/types/inventory.types";
import type { IngredientMap } from "./ingredient-map";
import { isOk, variance } from "./formulas";

/**
 * How one dough/sauce ingredient in a SUBMITTED entry compares with the plan
 * the store confirmed for that day. States stay distinct (rule 2): an item that
 * isn't in the entry is `not-counted`, never a count of 0.
 */
export type ComparisonRow =
  | {
      kind: "compared";
      key: IngredientKey;
      name: string;
      unit: string | null;
      planned: number;
      base: number | null;
      bufferPct: number;
      counted: number;
      variance: number;
      /** variance ÷ planned — null when planned is 0. */
      variancePct: number | null;
      ok: boolean;
    }
  | { kind: "not-counted"; key: IngredientKey; planned: number; bufferPct: number };

export interface EntryComparison {
  rows: ComparisonRow[];
  /** At least one of the three ingredients is in this entry — otherwise there is nothing to compare. */
  relevant: boolean;
  /** Ingredients counted below their planned target. */
  short: Extract<ComparisonRow, { kind: "compared" }>[];
}

/** True when the entry carries any of the three dough/sauce items. */
export function entryHasPlanItems(items: EntryItem[], map: IngredientMap): boolean {
  return items.some((i) => map.keyOf[i.item.ultimatrix_id] !== undefined);
}

/**
 * Compare an entry's counts with a CONFIRMED plan. The stored `planned_qty` is
 * the target (rule 4) — never base × the current buffer. `total_in_unit_1`
 * carries the unit conversion, so it is the figure compared (§5).
 */
export function buildEntryComparison(plan: Plan, items: EntryItem[], map: IngredientMap): EntryComparison {
  const byKey = new Map<IngredientKey, EntryItem>();
  for (const it of items) {
    const key = map.keyOf[it.item.ultimatrix_id];
    if (key) byKey.set(key, it);
  }

  const rows: ComparisonRow[] = [];
  for (const key of INGREDIENT_KEYS) {
    const line = plan.lines.find((l) => l.ingredient_key === key);
    if (!line) continue;
    const item = byKey.get(key);
    if (!item) {
      rows.push({ kind: "not-counted", key, planned: line.planned_qty, bufferPct: line.buffer_pct });
      continue;
    }
    const counted = Number(item.total_in_unit_1);
    if (!Number.isFinite(counted)) {
      rows.push({ kind: "not-counted", key, planned: line.planned_qty, bufferPct: line.buffer_pct });
      continue;
    }
    const v = variance(counted, line.planned_qty);
    rows.push({
      kind: "compared",
      key,
      name: item.item.name_en,
      unit: item.item.unit_1?.name ?? null,
      planned: line.planned_qty,
      base: line.base_qty ?? null,
      bufferPct: line.buffer_pct,
      counted,
      variance: v,
      variancePct: line.planned_qty === 0 ? null : v / line.planned_qty,
      ok: isOk(v),
    });
  }

  return {
    rows,
    relevant: byKey.size > 0,
    short: rows.filter((r): r is Extract<ComparisonRow, { kind: "compared" }> => r.kind === "compared" && !r.ok),
  };
}
