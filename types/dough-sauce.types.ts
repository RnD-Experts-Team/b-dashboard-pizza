/**
 * Dough & Sauce — shapes mirror the Frontend Contract (2026-09-25) verbatim,
 * snake_case included. These carry the numbers every plan and score is built
 * from, so there is deliberately no renaming layer to get wrong.
 */

export type IngredientKey = "dough_18oz" | "dough_10oz" | "sauce";

export const INGREDIENT_KEYS: readonly IngredientKey[] = ["dough_18oz", "dough_10oz", "sauce"];

/* ── Accounting calendar (rule 1: never derive a week locally) ─────────── */

export interface Week {
  week_start: string;
  week_end: string;
  week_no: number;
  period_no?: number;
  week_in_period?: number;
  fiscal_year: number;
  label?: string;
  current?: boolean;
}

export interface WeekRef {
  week_start: string;
  week_end?: string;
  week_no: number;
  fiscal_year: number;
}

/* ── AuditApp §3 ────────────────────────────────────────────────────────── */

export interface PlanLine {
  ingredient_key: IngredientKey;
  buffer_pct: number;
  planned_qty: number;
  /** Derived server-side: planned ÷ (1 + buffer/100). */
  base_qty?: number;
}

/**
 * Who confirmed/judged. The contract shows a plain name ("Ahmed"), but the
 * live API may send a user object — accept both and read it through
 * `personName()` (components/dough-sauce/ds-ui.tsx), never render it raw.
 */
export type PersonRef =
  | string
  | number
  | { id?: number | string; name?: string | null; email?: string | null }
  | null;

/** §3.1 / §3.2 — `{ data: Plan }` envelope. */
export interface Plan {
  store_id: number;
  plan_date: string;
  confirmed: boolean;
  confirmed_at: string | null;
  confirmed_by: PersonRef;
  lines: PlanLine[];
  /** Null once confirmed. */
  default_buffers: Record<IngredientKey, number> | null;
  buffer_max_pct: number;
  weeks: Week[];
}

export interface ConfirmPlanPayload {
  plan_date: string;
  lines: { ingredient_key: IngredientKey; buffer_pct: number; planned_qty: number }[];
}

/** §3.3 daily shape */
export interface DailyPlansResponse {
  date: string;
  weeks: Week[];
  stores: {
    store_id: number;
    store: string;
    confirmed: boolean;
    confirmed_at: string | null;
    confirmed_by: PersonRef;
    lines: PlanLine[];
  }[];
  summary: { total: number; confirmed: number; pending: number };
}

export type StickersVerdict = "yes" | "no" | null;
export type QualityVerdict = "pass" | "fail" | null;

export interface Judgement {
  stickers_compliance: StickersVerdict;
  dough_quality: QualityVerdict;
  note: string | null;
  complete: boolean;
  judged_by: PersonRef;
  judged_at: string | null;
}

export interface StoredPlanRow {
  plan_date: string;
  ingredient_key: IngredientKey;
  buffer_pct: number;
  planned_qty: number;
}

/** §3.3 weekly shape */
export interface WeeklyPlansResponse {
  week: Week;
  previous_weeks: WeekRef[];
  weeks: Week[];
  stores: {
    store_id: number;
    store: string;
    days_confirmed: number;
    lines_total: number;
    plans: StoredPlanRow[];
    judgement: Judgement | null;
  }[];
  summary: {
    total: number;
    fully_confirmed: number;
    judged: number;
    pending_judgement: number;
    lines_expected: number;
  };
}

/** §3.4 */
export interface StoreWeekResponse {
  store_id: number;
  week: Week;
  previous_weeks: WeekRef[];
  weeks: Week[];
  plans: StoredPlanRow[];
  judgement: Judgement | null;
}

/** §3.5 */
export interface JudgementPayload {
  week_start: string;
  stickers_compliance: StickersVerdict;
  dough_quality: QualityVerdict;
  note: string | null;
}

/* ── LC_PIZZA_DATA §4 ───────────────────────────────────────────────────── */

export interface BaseIngredient {
  key: IngredientKey;
  name?: string;
  unit?: string;
  divisor: number;
  /** Positional against `source_dates`; a day with no sales is null, not 0. */
  values: (number | null)[];
  average: number | null;
  base: number;
}

export interface UnmappedItem {
  item_id: string;
  name: string;
  account: string;
  quantity: number;
}

/** §4.1 */
export interface DailyPlanBase {
  store: string;
  date: string;
  weekday: string;
  source_dates: string[];
  days_found: number;
  lookback: number;
  include_refunded: boolean;
  ingredients: BaseIngredient[];
  unmapped: UnmappedItem[];
}

export interface Ingredient {
  key: IngredientKey;
  name: string;
  unit?: string;
  divisor?: number;
  /** The inventory ultimatrix id this ingredient is counted under (§5). */
  inventory_ref?: string | null;
}

export interface Recipe {
  id: number;
  item_id: string;
  menu_item_name?: string | null;
  menu_item_account?: string | null;
  ingredient_key: IngredientKey;
  qty: number;
  effective_from: string;
  effective_to: string | null;
}

export interface CreateRecipePayload {
  item_id: string;
  menu_item_name: string;
  menu_item_account: string;
  lines: { ingredient_key: IngredientKey; qty: number }[];
  effective_from?: string;
}

export interface UpdateRecipePayload {
  qty: number;
  effective_from?: string;
}

export interface RecipeUpdateResult {
  closed: { id: number; qty: number; effective_to: string };
  opened: { id: number; qty: number; effective_from: string };
}

/* ── inventory §5 ───────────────────────────────────────────────────────── */

export interface CountRow {
  store: string;
  store_id: number;
  date: string;
  ultimatrix_id: string;
  item_name: string;
  count_unit_1: number;
  /** Read THIS — carries the unit conversion. */
  total_in_unit_1: number;
  unit_1: string;
  is_edited: boolean;
  entry_id: number;
  submitted_at: string;
  duplicate_entries: number;
}

export interface MissingCount {
  store: string;
  store_id: number;
  date: string;
  ultimatrix_id: string;
}

export interface CountsResponse {
  date_from: string;
  date_to: string;
  all_entries: boolean;
  data: CountRow[];
  meta: {
    rows: number;
    stores_with_data: number;
    /** All-stores route only — how many active stores the answer covers. */
    stores_total?: number;
    /** A store/date counted more than once; only the latest entry is returned. */
    dupes?: number;
    /** `null` when the request sent `include_missing=false`. */
    missing: MissingCount[] | null;
  };
}
