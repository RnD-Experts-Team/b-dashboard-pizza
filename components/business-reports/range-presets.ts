import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { businessWeekStart } from "@/lib/utils/business-week";

export interface DateRange {
  start: string;
  end: string;
}

const DAYS_IN_WEEK = 7;
const MONDAY_OFFSET = 6;
const DEFAULT_WEEKS = 4;

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * The last `weeks` complete Tue–Mon business weeks, ending on the most recent
 * Monday on or before yesterday — the page's starting range.
 */
export function lastCompleteWeeks(weeks: number = DEFAULT_WEEKS, today: Date = new Date()): DateRange {
  const yesterday = iso(subDays(today, 1));
  const thisWeekStart = businessWeekStart(yesterday);
  const lastMonday =
    iso(addDays(parseISO(thisWeekStart), MONDAY_OFFSET)) === yesterday
      ? yesterday
      : iso(subDays(parseISO(thisWeekStart), 1));
  return { start: iso(subDays(parseISO(lastMonday), weeks * DAYS_IN_WEEK - 1)), end: lastMonday };
}

/** Inclusive day count. */
export function rangeDays(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
}
