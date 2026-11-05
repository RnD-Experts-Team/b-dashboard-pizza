import type { DailyPlanBase, IngredientKey, Plan } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import type { EntryItem } from "@/types/inventory.types";
import { toBaseUnit, type IngredientMap } from "./ingredient-map";
import { gapOf, isOkWithinStep, targetQty, variance } from "./formulas";
import { BASE_SAME_DAY_FROM } from "./week-cells";

/**
 * How one dough/sauce ingredient in a SUBMITTED entry compares with the BASE of the day that count feeds. States
 * stay distinct (rule 2): an item that isn't in the entry is `not-counted`, never a count of 0.
 */
export type ComparisonRow =
  | {
      kind: "compared";
      key: IngredientKey;
      name: string;
      unit: string | null;
      /** The base the count is judged against — before the buffer. */
      target: number;
      /** The entry's count in the base's unit (the 10 OZ balls are divided by the server's divisor). */
      counted: number;
      /** The count as the entry holds it, and what it was divided by (1 = as is). */
      rawCounted: number;
      divisor: number;
      variance: number;
      /** Short by at least one step — the gap survives the rounding (see `gapOf`). */
      short: boolean;
      /** Over by at least one step. */
      over: boolean;
    }
  | { kind: "not-counted"; key: IngredientKey; target: number };

export interface EntryComparison {
  rows: ComparisonRow[];
  /** At least one of the three ingredients is in this entry — otherwise there is nothing to compare. */
  relevant: boolean;
  /** Ingredients counted below their base (by a whole step or more). */
  short: Extract<ComparisonRow, { kind: "compared" }>[];
}

/** True when the entry carries any of the three dough/sauce items. */
export function entryHasPlanItems(items: EntryItem[], map: IngredientMap): boolean {
  return items.some((i) => map.keyOf[i.item.ultimatrix_id] !== undefined);
}

/**
 * What each ingredient's count is judged against: the BASE of the day after the entry's date, before the buffer —
 * exactly what the Daily plan does with the night-before count. A confirmed plan's own line is used; before
 * confirming, the base the server computed for that day (none when no sales history was found).
 */
export function targetsFor(
  plan: Plan | null,
  base: DailyPlanBase | null,
  /** The day the base is for. From 2026-11-03 only the REAL base counts — a plan confirmed on the average never does. */
  day: string
): Partial<Record<IngredientKey, number>> {
  const out: Partial<Record<IngredientKey, number>> = {};
  for (const key of INGREDIENT_KEYS) {
    const line = plan?.confirmed && day < BASE_SAME_DAY_FROM ? plan.lines.find((l) => l.ingredient_key === key) : undefined;
    if (line) {
      out[key] = targetQty(line.planned_qty, line.buffer_pct, line.base_qty);
      continue;
    }
    const serverBase = base && base.days_found > 0 ? base.ingredients.find((i) => i.key === key)?.base : undefined;
    if (typeof serverBase === "number" && Number.isFinite(serverBase)) out[key] = targetQty(0, 0, serverBase);
  }
  return out;
}

/**
 * Compare an entry's counts with the base they feed. `total_in_unit_1` carries the unit conversion (§5); the 10 OZ
 * balls are then divided by the server's divisor so they meet a base that is in units of 12. The gap is shown the
 * way the Daily plan shows it: in whole steps, rounded down, and a shortfall under one step passes.
 */
export function buildEntryComparison(
  targets: Partial<Record<IngredientKey, number>>,
  items: EntryItem[],
  map: IngredientMap
): EntryComparison {
  const byKey = new Map<IngredientKey, EntryItem>();
  for (const it of items) {
    const key = map.keyOf[it.item.ultimatrix_id];
    if (key) byKey.set(key, it);
  }

  const rows: ComparisonRow[] = [];
  for (const key of INGREDIENT_KEYS) {
    const target = targets[key];
    if (target == null) continue;
    const item = byKey.get(key);
    const raw = item ? Number(item.total_in_unit_1) : NaN;
    if (!item || !Number.isFinite(raw)) {
      rows.push({ kind: "not-counted", key, target });
      continue;
    }
    const divisor = map.countDivisor[key] ?? 1;
    const counted = toBaseUnit(raw, divisor);
    const v = variance(counted, target);
    const ok = isOkWithinStep(key, v);
    rows.push({
      kind: "compared",
      key,
      name: item.item.name_en,
      unit: item.item.unit_1?.name ?? null,
      target,
      counted,
      rawCounted: raw,
      divisor,
      variance: v,
      short: !ok,
      over: v > 0 && gapOf(key, v) > 0,
    });
  }

  return {
    rows,
    relevant: byKey.size > 0,
    short: rows.filter((r): r is Extract<ComparisonRow, { kind: "compared" }> => r.kind === "compared" && r.short),
  };
}
