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

export interface IngredientMap {
  /** ingredient key → ultimatrix id */
  refOf: Record<IngredientKey, string>;
  /** ultimatrix id → ingredient key */
  keyOf: Record<string, IngredientKey>;
  ultimatrixIds: string[];
}

export function buildIngredientMap(ingredients: Ingredient[] | null | undefined): IngredientMap {
  const refOf = { ...FALLBACK_REFS };
  for (const ing of ingredients ?? []) {
    if (ing.inventory_ref && ing.key in refOf) refOf[ing.key] = ing.inventory_ref;
  }
  const keyOf: Record<string, IngredientKey> = {};
  for (const [key, ref] of Object.entries(refOf) as [IngredientKey, string][]) keyOf[ref] = key;
  return { refOf, keyOf, ultimatrixIds: Object.values(refOf) };
}
