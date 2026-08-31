/**
 * Week identity for the scheduling grid.
 *
 * The business week is keyed by a `weekStart` ISO date string ("YYYY-MM-DD"),
 * never by a relative offset integer. The old `getWeekDates(offset)` resolved
 * against `new Date()` on every render, so leaving the tab open across a
 * week-start midnight silently re-pointed every cached week at a different
 * calendar week.
 *
 * Which weekday the week starts on is a PER-STORE setting (`week_start_dow`,
 * 0=Sun..6=Sat) that the API returns. The server also snaps whatever date it is
 * given to the true week start, so the client only ever needs a provisional
 * value for the first render — send the date the user is looking at and render
 * from the `week` object the server returns.
 */

import { addDays, format, parseISO } from "date-fns";
import type { WeekInfo } from "@/types/scheduling.types";

/**
 * Fallback business-week start used before a store's settings have loaded.
 * 2 = Tuesday, which is what this chain's business week has historically been.
 */
export const DEFAULT_WEEK_START_DOW = 2;

const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Today as "YYYY-MM-DD" in the viewer's local timezone. */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Shift an ISO date string by whole days. */
export function shiftIsoDate(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/**
 * Snap a date back to the most recent start of its business week.
 *
 * Only a provisional client-side guess — the server is authoritative and
 * returns the true start in `week.start`.
 */
export function snapToWeekStart(iso: string, weekStartDow: number): string {
  const date = parseISO(iso);
  const distance = (date.getDay() - weekStartDow + 7) % 7;
  return format(addDays(date, -distance), "yyyy-MM-dd");
}

/**
 * Day labels for the 7 grid columns, rotated so index 0 is the store's week start.
 *
 * A store whose week starts Sunday must not be labelled Tuesday-first, which is
 * what the old frozen `DAYS_OF_WEEK` array did.
 */
export function dayLabelsFor(weekStartDow: number): {
  long: string[];
  short: string[];
} {
  const rotate = (source: readonly string[]) =>
    Array.from({ length: 7 }, (_, i) => source[(weekStartDow + i) % 7]);
  return { long: rotate(DAY_NAMES_LONG), short: rotate(DAY_NAMES_SHORT) };
}

/** "Aug 4 – Aug 10, 2026" */
function weekLabel(start: Date, end: Date): string {
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}, ${format(end, "yyyy")}`;
}

/**
 * Build a `WeekInfo` locally from a week-start date.
 *
 * Used for the provisional first render and by the parked views. Once a week
 * payload has loaded, prefer `weekInfoFromPayload` so the server's snapped
 * start and label win.
 */
export function buildWeekInfo(
  weekStart: string,
  weekStartDow: number = DEFAULT_WEEK_START_DOW,
): WeekInfo {
  const start = parseISO(snapToWeekStart(weekStart, weekStartDow));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = dates[6];
  const labels = dayLabelsFor(weekStartDow);

  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    label: weekLabel(start, end),
    dayDates: dates.map((d) => format(d, "d")),
    fullDates: dates.map((d) => format(d, "yyyy-MM-dd")),
    weekStartDow,
    dayNames: labels.long,
    dayNamesShort: labels.short,
  };
}

/**
 * The absolute date for a grid column.
 *
 * Always resolve a clicked `dayIndex` through the week payload rather than
 * computing a date — the server already did the calendar maths.
 */
export function dateForDayIndex(week: WeekInfo, dayIndex: number): string {
  return week.fullDates[dayIndex] ?? week.start;
}

/**
 * Convert a grid `dayIndex` to the canonical `0=Sun..6=Sat` day number.
 *
 * The ONE place the API departs from `day_index`: `POST /availability-overrides`
 * takes `day_of_week` on the canonical basis. Getting this wrong blocks the
 * wrong weekday, which nobody notices until someone is scheduled into their
 * unavailability.
 */
export function dayIndexToDayOfWeek(dayIndex: number, weekStartDow: number): number {
  return (dayIndex + weekStartDow) % 7;
}

/** Index of today within the given week, or -1 if today falls outside it. */
export function todayIndexIn(week: WeekInfo): number {
  return week.fullDates.indexOf(todayIso());
}
