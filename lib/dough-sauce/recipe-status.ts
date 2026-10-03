import type { Recipe } from "@/types/dough-sauce.types";

/**
 * Recipes are dated versions, never overwritten (contract §4.2). `current` applies today,
 * `ended` was replaced or closed, `upcoming` starts on a future date. Pure — no React, no i18n.
 */
export type RecipeStatus = "current" | "ended" | "upcoming";

/** `effective_to` is the LAST day a version applies, so a row ending today is still current. */
export function recipeStatus(r: Pick<Recipe, "effective_from" | "effective_to">, today: string): RecipeStatus {
  if (r.effective_from > today) return "upcoming";
  if (r.effective_to && r.effective_to < today) return "ended";
  return "current";
}
