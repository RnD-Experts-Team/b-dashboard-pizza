import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
  subDays,
} from "date-fns";

/**
 * Business weeks run Tuesday → Monday. The week NUMBER is the ISO week of its
 * Tuesday (same as the DSPR "Week N" badge, which reads `week_start`).
 * Days are "YYYY-MM-DD" strings in the viewer's clock.
 */

const TUESDAY = 2;
const DAYS_IN_WEEK = 7;
const MONDAY_OFFSET = DAYS_IN_WEEK - 1;
/** Oldest week offered. Move this back if data ever predates it. */
const EARLIEST_DAY = "2015-01-01";

export interface BusinessWeek {
  /** The Tuesday, "YYYY-MM-DD" — also the option value. */
  start: string;
  /** The Monday, "YYYY-MM-DD". */
  end: string;
  number: number;
  /** ISO week-year of the Tuesday. */
  year: number;
  /** "Week 43 · 2026" */
  label: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** The Tuesday on or before `day`. */
export function businessWeekStart(day: string): string {
  const d = parseISO(day);
  return iso(subDays(d, (d.getDay() - TUESDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK));
}

/** The Monday that closes the week containing `day`. */
export function businessWeekEnd(day: string): string {
  return iso(addDays(parseISO(businessWeekStart(day)), MONDAY_OFFSET));
}

export function toBusinessWeek(weekStart: string): BusinessWeek {
  const s = parseISO(weekStart);
  const e = addDays(s, MONDAY_OFFSET);
  const number = getISOWeek(s);
  const year = getISOWeekYear(s);
  return { start: weekStart, end: iso(e), number, year, label: `Week ${number} · ${year}` };
}

/**
 * Newest first. Only weeks that have begun by `latestDay` are listed, so every
 * week offered has at least one selectable day.
 */
export function businessWeekOptions(latestDay: string): BusinessWeek[] {
  const newest = parseISO(businessWeekStart(latestDay));
  const count = Math.floor(differenceInCalendarDays(newest, parseISO(businessWeekStart(EARLIEST_DAY))) / DAYS_IN_WEEK) + 1;
  return Array.from({ length: Math.max(count, 1) }, (_, i) => toBusinessWeek(iso(subDays(newest, i * DAYS_IN_WEEK))));
}

const JAN_4TH = 4; // Jan 4 always falls in ISO week 1
const TWO_DIGIT_YEAR_BASE = 2000;
const MAX_TWO_DIGIT = 99;
const MIN_YEAR_DIGITS_VALUE = 100; // a lone number this big is a year, not a week

/** The business week for ISO week `number` of `year`, or null if that week doesn't exist (e.g. week 53 of a 52-week year). */
export function weekFromNumber(number: number, year: number): BusinessWeek | null {
  if (!Number.isInteger(number) || !Number.isInteger(year) || number < 1) return null;
  const tuesday = addDays(startOfISOWeek(new Date(year, 0, JAN_4TH)), 1 + (number - 1) * DAYS_IN_WEEK);
  return getISOWeek(tuesday) === number && getISOWeekYear(tuesday) === year ? toBusinessWeek(iso(tuesday)) : null;
}

/** Reads typed text into a week number and/or year: "43 2026", "43/26", "week 43", "2026". */
export function parseWeekQuery(query: string): { week?: number; year?: number } {
  // Digit runs only: "Week 43 / 2026" → [43, 2026]; "week" → [].
  const numbers = Array.from(query, (c) => (c >= "0" && c <= "9" ? c : " "))
    .join("")
    .split(" ")
    .filter(Boolean)
    .map(Number);
  const toYear = (n: number) => (n <= MAX_TWO_DIGIT ? n + TWO_DIGIT_YEAR_BASE : n);
  if (numbers.length === 0) return {};
  if (numbers.length === 1) {
    return numbers[0] >= MIN_YEAR_DIGITS_VALUE ? { year: numbers[0] } : { week: numbers[0] };
  }
  const [a, b] = numbers;
  return a >= MIN_YEAR_DIGITS_VALUE && b < MIN_YEAR_DIGITS_VALUE ? { week: b, year: a } : { week: a, year: toYear(b) };
}

/** Weeks matching typed text (week number and/or year prefix); everything when the text has no digits. */
export function filterWeeks(weeks: BusinessWeek[], query: string): BusinessWeek[] {
  const { week, year } = parseWeekQuery(query);
  return weeks.filter(
    (w) =>
      (week === undefined || String(w.number).startsWith(String(week))) &&
      (year === undefined || String(w.year).startsWith(String(year))),
  );
}

/** The week's Monday, or `latestDay` when the week is still running — whichever comes first. */
export function clampWeekEnd(week: BusinessWeek, latestDay: string): string {
  return week.end < latestDay ? week.end : latestDay;
}

/** Whether `start` → `end` is whole weeks (the end may be cut at `latestDay`). */
export function isWholeWeeks(start: string, end: string, latestDay: string): boolean {
  if (businessWeekStart(start) !== start) return false;
  return end === businessWeekEnd(end) || end === latestDay;
}
