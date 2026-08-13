/**
 * Quantity formatting helpers for the inventory feature.
 *
 * Backend quantities arrive as strings like "1.0000" / "1.2000". Counts support
 * up to two decimal places (partial units, e.g. half a box), so both unit
 * counts and the U1 total render with exactly two decimals.
 */

type Numeric = string | number | null | undefined;

/** Unit count → two decimals ("1.0000" → "1.00", "1.5" → "1.50"). */
export function formatUnitQty(v: Numeric): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Total in unit 1 → always two decimals ("1.2000" → "1.20", "7" → "7.00"). */
export function formatTotal(v: Numeric): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
