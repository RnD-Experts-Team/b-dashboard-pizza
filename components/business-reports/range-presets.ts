import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { businessWeekStart } from "@/lib/utils/business-week";

/**
 * Quick ranges on the business calendar: Tue–Mon weeks, 4-week fiscal
 * periods, a fiscal year starting the Tuesday on/before Jan 1 (the Data
 * service's fiscalYearStart). Everything ends yesterday at the latest — the
 * newest complete business day.
 */

export type RangePresetKey =
  | "this-week"
  | "last-week"
  | "last-4-weeks"
  | "last-13-weeks"
  | "period-to-date"
  | "year-to-date"
  | "last-52-weeks";

export interface DateRange {
  start: string;
  end: string;
}

const DAYS_IN_WEEK = 7;
const WEEKS_IN_PERIOD = 4;
const MONDAY_OFFSET = 6;
const FOUR_WEEKS = 4;
const QUARTER_WEEKS = 13;
const YEAR_WEEKS = 52;

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function yesterday(today: Date): string {
  return iso(subDays(today, 1));
}

/** The Tuesday on/before Jan 1 of `year`. */
function fiscalYearStart(year: number): string {
  return businessWeekStart(`${year}-01-01`);
}

function fiscalYearStartOf(day: string): string {
  const year = parseISO(day).getFullYear();
  const next = fiscalYearStart(year + 1);
  if (day >= next) return next;
  const own = fiscalYearStart(year);
  return day >= own ? own : fiscalYearStart(year - 1);
}

/** The last `weeks` complete business weeks (ending on the most recent Monday ≤ yesterday). */
function lastCompleteWeeks(today: Date, weeks: number): DateRange {
  const end = yesterday(today);
  const thisWeekStart = businessWeekStart(end);
  const lastMonday = iso(addDays(parseISO(thisWeekStart), MONDAY_OFFSET)) === end
    ? end
    : iso(subDays(parseISO(thisWeekStart), 1));
  const start = iso(subDays(parseISO(lastMonday), weeks * DAYS_IN_WEEK - 1));
  return { start, end: lastMonday };
}

export const RANGE_PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "last-4-weeks", label: "Last 4 weeks" },
  { key: "period-to-date", label: "Period to date" },
  { key: "last-13-weeks", label: "Last 13 weeks" },
  { key: "year-to-date", label: "Year to date" },
  { key: "last-52-weeks", label: "Last 52 weeks" },
];

function periodToDate(today: Date): DateRange {
  const end = yesterday(today);
  const yearStart = fiscalYearStartOf(end);
  const weeksIn = Math.floor(differenceInCalendarDays(parseISO(end), parseISO(yearStart)) / DAYS_IN_WEEK);
  const periodStart = addDays(parseISO(yearStart), Math.floor(weeksIn / WEEKS_IN_PERIOD) * WEEKS_IN_PERIOD * DAYS_IN_WEEK);
  return { start: iso(periodStart), end };
}

const PRESET_RANGES: Record<RangePresetKey, (today: Date) => DateRange> = {
  "this-week": (today) => ({ start: businessWeekStart(yesterday(today)), end: yesterday(today) }),
  "last-week": (today) => lastCompleteWeeks(today, 1),
  "last-4-weeks": (today) => lastCompleteWeeks(today, FOUR_WEEKS),
  "last-13-weeks": (today) => lastCompleteWeeks(today, QUARTER_WEEKS),
  "last-52-weeks": (today) => lastCompleteWeeks(today, YEAR_WEEKS),
  "year-to-date": (today) => ({ start: fiscalYearStartOf(yesterday(today)), end: yesterday(today) }),
  "period-to-date": periodToDate,
};

export function presetRange(key: RangePresetKey, today: Date = new Date()): DateRange {
  return PRESET_RANGES[key](today);
}

/** Which preset (if any) a range equals — to highlight it. */
export function matchPreset(range: DateRange, today: Date = new Date()): RangePresetKey | null {
  return RANGE_PRESETS.find(({ key }) => {
    const p = presetRange(key, today);
    return p.start === range.start && p.end === range.end;
  })?.key ?? null;
}

/** Inclusive day count. */
export function rangeDays(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
}
