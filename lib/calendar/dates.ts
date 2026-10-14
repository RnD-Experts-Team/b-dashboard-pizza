import {
  addDays as fnsAddDays,
  addMonths as fnsAddMonths,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek as fnsStartOfWeek,
} from "date-fns";
import type { CalendarView, DateRange } from "./types";

/**
 * Pure calendar date math. No React, no Intl — formatting lives in
 * `components/calendar/use-calendar-format.ts` because it follows the locale.
 *
 * First day of the week: 1 = Monday. (The scheduling grid starts on Tuesday —
 * that is a payroll week, not a calendar week.)
 */
export const WEEK_START = 1 as const;
export const MINUTE = 60_000;
export const DAY = 86_400_000;

export { isSameDay, isSameMonth, startOfDay, startOfMonth };

export const addDays = fnsAddDays;
/** Clamps the day (Jan 31 + 1 month → Feb 28/29). */
export const addMonths = fnsAddMonths;

export function startOfWeek(d: Date): Date {
  return fnsStartOfWeek(d, { weekStartsOn: WEEK_START });
}

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromKey(key: string): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

/** A valid "YYYY-MM-DD" (used to validate `?date=`). */
export function isDayKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(fromKey(value));
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Days from the week containing the 1st to the week containing the last day. */
export function monthGrid(d: Date): Date[] {
  const first = startOfMonth(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let c = startOfWeek(first); c <= end; c = addDays(c, 1)) days.push(c);
  return days;
}

/** Always 6 weeks — mini calendars keep a constant height while paging. */
export function monthGrid42(d: Date): Date[] {
  const start = startOfWeek(startOfMonth(d));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The [from, to) range a view needs events for. */
export function viewRange(view: CalendarView, cursor: Date): DateRange {
  if (view === "day") {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "month") {
    const grid = monthGrid(cursor);
    return { from: grid[0], to: addDays(grid[grid.length - 1], 1) };
  }
  return {
    from: new Date(cursor.getFullYear(), 0, 1),
    to: new Date(cursor.getFullYear() + 1, 0, 1),
  };
}

/** Move the cursor one "page" in a view. */
export function step(view: CalendarView, cursor: Date, dir: 1 | -1): Date {
  if (view === "day") return addDays(cursor, dir);
  if (view === "week") return addDays(cursor, 7 * dir);
  if (view === "month") return addMonths(cursor, dir);
  return addMonths(cursor, 12 * dir);
}

export function sameRange(view: CalendarView, a: Date, b: Date): boolean {
  return +viewRange(view, a).from === +viewRange(view, b).from;
}

export function rangeContains(range: DateRange, d: Date): boolean {
  return d >= range.from && d < range.to;
}

/**
 * Where a new event starts by default: the next half hour when `day` is today
 * (never past 23:00), otherwise 09:00 on that day.
 */
export function suggestedStart(day: Date, now: number): Date {
  const nowDate = new Date(now);
  if (!isSameDay(day, nowDate)) {
    const d = startOfDay(day);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const step30 = 30 * MINUTE;
  const next = new Date(Math.ceil(now / step30) * step30);
  if (!isSameDay(next, nowDate) || next.getHours() >= 23) {
    const late = startOfDay(nowDate);
    late.setHours(23, 0, 0, 0);
    return late;
  }
  return next;
}
