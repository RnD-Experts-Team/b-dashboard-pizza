import { addDays, differenceInCalendarDays } from "date-fns";

/**
 * The Little Caesars fiscal calendar: Tuesday–Monday weeks, 13 periods of 4
 * weeks, 52 weeks a year. Pure — no React, no Intl.
 *
 * Every fiscal year is exactly 364 days, so each one starts on the Tuesday right
 * after the last one ends and the start drifts a day earlier each year (two after
 * a leap year). There is no 53rd week. This matches the accounting calendar the
 * backend serves (`GET /api/cleaning/periods?type=week`, checked for every year
 * from 2016 to 2041) and the printed 2026 sheet: Week 1 = Tue Dec 30 2025 – Mon
 * Jan 5 2026, Week 52 = Dec 22 – 28 2026, so Tue Dec 29 2026 is Week 1 of 2027.
 *
 * The anchor is a Tuesday and a year is a whole number of weeks, so fiscal weeks
 * always line up with the calendar's weeks (`WEEK_START` in `dates.ts`).
 */
const ANCHOR_YEAR = 2026;
/** Week 1 of fiscal 2026 begins here (local midnight). */
const ANCHOR = new Date(2025, 11, 30);

export const WEEKS_PER_PERIOD = 4;
export const PERIODS_PER_YEAR = 13;
export const WEEKS_PER_YEAR = WEEKS_PER_PERIOD * PERIODS_PER_YEAR; // 52
const YEAR_DAYS = WEEKS_PER_YEAR * 7; // 364

export interface FiscalWeek {
  /** The fiscal year, named after the calendar year holding most of its weeks. */
  year: number;
  /** 1–52. */
  week: number;
  /** 1–13. */
  period: number;
  /** 1–4. */
  weekInPeriod: number;
  /** The Tuesday the week starts on (local midnight). */
  start: Date;
  /** The Monday it ends on (local midnight). */
  end: Date;
}

/** The Tuesday a fiscal year's Week 1 starts on. */
export function fiscalYearStart(year: number): Date {
  return addDays(ANCHOR, (year - ANCHOR_YEAR) * YEAR_DAYS);
}

/** The fiscal week (and period) a day falls in. */
export function fiscalWeekOf(d: Date): FiscalWeek {
  const days = differenceInCalendarDays(d, ANCHOR);
  const yearIndex = Math.floor(days / YEAR_DAYS);
  const dayInYear = days - yearIndex * YEAR_DAYS;
  const week = Math.floor(dayInYear / 7) + 1;
  const period = Math.ceil(week / WEEKS_PER_PERIOD);
  const start = addDays(ANCHOR, yearIndex * YEAR_DAYS + (week - 1) * 7);
  return {
    year: ANCHOR_YEAR + yearIndex,
    week,
    period,
    weekInPeriod: week - (period - 1) * WEEKS_PER_PERIOD,
    start,
    end: addDays(start, 6),
  };
}

/** First and last day (Tuesday … Monday) of a fiscal period. */
export function fiscalPeriodRange(year: number, period: number): { start: Date; end: Date } {
  const start = addDays(fiscalYearStart(year), (period - 1) * WEEKS_PER_PERIOD * 7);
  return { start, end: addDays(start, WEEKS_PER_PERIOD * 7 - 1) };
}
