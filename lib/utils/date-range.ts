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

/** Current month-to-date range: first day of this month → today. */
export function monthToDateRange(today: Date = new Date()): {
  start: string;
  end: string;
} {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: formatIsoDate(start), end: formatIsoDate(today) };
}

/** Inclusive whole-day count between two YYYY-MM-DD strings (min 1). */
export function daysBetween(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}
