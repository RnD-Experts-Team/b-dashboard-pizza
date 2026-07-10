/**
 * Quantity formatting helpers for the inventory feature.
 *
 * Backend quantities arrive as strings like "1.0000" / "1.2000". Units are
 * always whole (no fractional counts), so we render them as plain integers;
 * the U1 total is a computed value that we render with exactly two decimals.
 */

type Numeric = string | number | null | undefined;

/** Unit count → whole integer with no decimal point ("1.0000" → "1"). */
export function formatUnitQty(v: Numeric): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toString();
}

/** Total in unit 1 → always two decimals ("1.2000" → "1.20", "7" → "7.00"). */
export function formatTotal(v: Numeric): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
