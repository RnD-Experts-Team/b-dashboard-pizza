/**
 * Small date helpers for range-based report pages.
 * All formatting is local-time (no UTC offset shift) to match the
 * DatePicker's parse/format helpers.
 */

/** Format a local Date as "YYYY-MM-DD". */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
