import type { IngredientKey } from "@/types/dough-sauce.types";

/**
 * The picture a kitchen reads ("536 Balls · 7.5 Trays · 10 Containers") shows each total rounded to
 * the NEAREST step it is made in: Round (18 OZ balls) to a whole ball, Crazy Bread and Sauce to the
 * nearest half. E.g. 536.48 → 536, 6.27 → 6.5, 7.43 → 7.5. The confirmed plan itself is untouched;
 * this only shapes the exported sheet.
 */
export const SHEET_STEP: Record<IngredientKey, number> = {
  dough_18oz: 1,
  dough_10oz: 0.5,
  sauce: 0.5,
};

export function sheetQty(key: IngredientKey, n: number): number {
  const step = SHEET_STEP[key];
  // Settle float noise first, so 6.2499999 and 6.25 land the same way.
  const settled = Math.round(n * 10_000) / 10_000;
  return Math.round(settled / step) * step;
}
