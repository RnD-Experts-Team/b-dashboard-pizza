import type { PeriodType } from "@/types/cleaning.types";

/**
 * Period key options for the Evaluation + Reports selectors.
 *
 * The backend guide pins the exact list both screens must offer, so the
 * algorithm lives here rather than being re-derived per screen:
 *   - week: 9 options — the current ISO week ±4, oldest → newest
 *   - date: 15 options — today and the 14 days before it, oldest → newest
 * The current period is always the default selection (it sits mid-list, not
 * first or last).
 */

export interface PeriodOption {
  value: string;
  label: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` in local time (not UTC — `toISOString()` would shift the day). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * ISO-8601 week key, e.g. "2026-W30". A week belongs to the year of its
 * Thursday, and week 1 is the one containing that year's first Thursday.
 */
export function isoWeekKey(date: Date): string {
  // Shift to the Thursday of this week — that day's year is the ISO year.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dayNum + 3);
  const isoYear = d.getFullYear();

  // Week 1 is the week containing Jan 4th (equivalently, the first Thursday).
  const firstThursday = new Date(isoYear, 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);

  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${pad2(week)}`;
}

/** The key for the period containing today — the default selection. */
export function currentPeriodKey(type: PeriodType): string {
  const now = new Date();
  return type === "week" ? isoWeekKey(now) : dateKey(now);
}

export function buildPeriodOptions(type: PeriodType): PeriodOption[] {
  const now = new Date();

  if (type === "week") {
    // Current ISO week ±4 → 9 options, oldest first.
    return Array.from({ length: 9 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + (i - 4) * 7);
      const key = isoWeekKey(d);
      return { value: key, label: key };
    });
  }

  // Today and the 14 days before it → 15 options, oldest first.
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (14 - i));
    const key = dateKey(d);
    return { value: key, label: key };
  });
}
