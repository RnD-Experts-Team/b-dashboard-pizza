/**
 * Formatting helpers for the Business Reports page.
 *
 * (Originally this file also held Phase-A mock fixtures; the page now renders
 * live data via use-business-reports, so only these shared formatters remain.)
 *
 * Null-safe: upstream responses don't always populate every numeric field, so
 * a missing/NaN value renders as 0 rather than crashing.
 */

const num = (n: number | null | undefined): number =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;

export const fmt$ = (n: number | null | undefined) =>
  `$${Math.round(num(n)).toLocaleString("en-US")}`;
export const fmt$2 = (n: number | null | undefined) =>
  `$${num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtNum = (n: number | null | undefined) =>
  num(n).toLocaleString("en-US");
export const fmtPct = (n: number | null | undefined) =>
  `${num(n).toFixed(1)}%`;
