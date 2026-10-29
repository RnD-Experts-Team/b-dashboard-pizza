import type { Ingredient, IngredientKey } from "@/types/dough-sauce.types";

/**
 * The inventory and data systems share no ingredient key (contract §5). The
 * bridge should come from `ingredients[].inventory_ref`; these codes are only
 * a fallback — we were told they are temporary and will be corrected.
 */
const FALLBACK_REFS: Record<IngredientKey, string> = {
  dough_18oz: "0000",
  dough_10oz: "00001",
  sauce: "00002",
};

/**
 * Ingredients whose inventory COUNT is in raw portions while their base is in units of `divisor` (the 10 OZ
 * dough: counted in single balls, planned in units of 12). The count is divided by the divisor before it is
 * compared with a base. The sauce's count is already in containers, so it is not here.
 */
export const COUNT_DIVIDED_KEYS: IngredientKey[] = ["dough_10oz"];
/** Used only when the ingredients list carries no divisor. */
const FALLBACK_COUNT_DIVISOR = 12;

/**
 * The first-shift MORNING count is typed in raw balls for the 10 OZ dough, so it is divided by 12 before it meets the
 * base. The sauce is already typed in containers and the 18 OZ dough as typed — neither is divided (user, 2026-10-29:
 * the sauce is NOT ÷80, which overrides 2026-10-27).
 */
export const MORNING_DIVIDED_KEYS: IngredientKey[] = ["dough_10oz"];
const FALLBACK_MORNING_DIVISOR: Partial<Record<IngredientKey, number>> = { dough_10oz: 12 };

/** Raw count → the unit the base is in, rounded like the plan payload (4 decimals). */
export const toBaseUnit = (raw: number, divisor: number) =>
  divisor > 1 ? Math.round((raw / divisor) * 10_000) / 10_000 : raw;

export interface IngredientMap {
  /** ingredient key → ultimatrix id */
  refOf: Record<IngredientKey, string>;
  /** ultimatrix id → ingredient key */
  keyOf: Record<string, IngredientKey>;
  ultimatrixIds: string[];
  /** What a count of this ingredient is divided by before it meets a base. Absent = compared as is. */
  countDivisor: Partial<Record<IngredientKey, number>>;
  /** What a MORNING count of this ingredient is divided by before it is added to the night count. */
  morningDivisor: Partial<Record<IngredientKey, number>>;
}

export function buildIngredientMap(ingredients: Ingredient[] | null | undefined): IngredientMap {
  const refOf = { ...FALLBACK_REFS };
  const countDivisor: Partial<Record<IngredientKey, number>> = {};
  const morningDivisor: Partial<Record<IngredientKey, number>> = { ...FALLBACK_MORNING_DIVISOR };
  for (const key of COUNT_DIVIDED_KEYS) countDivisor[key] = FALLBACK_COUNT_DIVISOR;
  for (const ing of ingredients ?? []) {
    if (ing.inventory_ref && ing.key in refOf) refOf[ing.key] = ing.inventory_ref;
    if (COUNT_DIVIDED_KEYS.includes(ing.key) && ing.divisor && ing.divisor > 0) countDivisor[ing.key] = ing.divisor;
    if (MORNING_DIVIDED_KEYS.includes(ing.key) && ing.divisor && ing.divisor > 0) morningDivisor[ing.key] = ing.divisor;
  }
  const keyOf: Record<string, IngredientKey> = {};
  for (const [key, ref] of Object.entries(refOf) as [IngredientKey, string][]) keyOf[ref] = key;
  return { refOf, keyOf, ultimatrixIds: Object.values(refOf), countDivisor, morningDivisor };
}
