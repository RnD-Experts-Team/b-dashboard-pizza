import { formatIsoDate } from "@/lib/utils/date-range";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report periods — relative tokens and the resolved range.             */
/*                                                                            */
/*  Data resolves the period at run time (a schedule in its own time zone);  */
/*  the range here is for DISPLAY only, computed in the browser's local       */
/*  calendar. The business week runs Tuesday → Monday. Dates are plain        */
/*  "YYYY-MM-DD" strings; no time zone ever enters the arithmetic.            */
/* ────────────────────────────────────────────────────────────────────────── */

export const PERIOD_TOKENS = [
  "today",
  "yesterday",
  "last_7_days",
  "week_to_date",
  "last_week",
  "month_to_date",
  "last_month",
] as const;

type PeriodToken = (typeof PERIOD_TOKENS)[number];

export interface DateRange {
  from: string;
  to: string;
}

const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
/** JavaScript's getDay() for Tuesday — the first day of the business week. */
const TUESDAY = 2;

/** Whole days from `a` to `b` (negative when b is earlier; not inclusive, unlike lib/utils/date-range). */
export function signedDaysBetween(a: string, b: string): number {
  const ua = Date.UTC(...ymd(a));
  const ub = Date.UTC(...ymd(b));
  return Math.round((ub - ua) / MS_PER_DAY);
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The Tuesday on or before `d`. */
function businessWeekStart(d: Date): Date {
  const back = (d.getDay() - TUESDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(d, -back);
}

const range = (from: Date, to: Date): DateRange => ({ from: formatIsoDate(from), to: formatIsoDate(to) });

const RESOLVERS: Record<PeriodToken, (today: Date) => DateRange> = {
  today: (t) => range(t, t),
  yesterday: (t) => range(addDays(t, -1), addDays(t, -1)),
  // Seven full days ending yesterday.
  last_7_days: (t) => range(addDays(t, -DAYS_PER_WEEK), addDays(t, -1)),
  week_to_date: (t) => range(businessWeekStart(t), t),
  last_week: (t) => {
    const start = addDays(businessWeekStart(t), -DAYS_PER_WEEK);
    return range(start, addDays(start, DAYS_PER_WEEK - 1));
  },
  month_to_date: (t) => range(new Date(t.getFullYear(), t.getMonth(), 1), t),
  last_month: (t) => range(new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)),
};

type PeriodLike = { type: "relative"; token: PeriodToken } | { type: "fixed"; from: string; to: string };

/** The calendar range a period covers, as of `now` (browser-local). */
export function resolvePeriod(period: PeriodLike, now: Date = new Date()): DateRange {
  if (period.type === "fixed") return { from: period.from, to: period.to };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return RESOLVERS[period.token](today);
}

/** A snapshot dataset shows the current state (stock on hand, the roster): it ignores the period and has no `date` key. */
export const isSnapshot = (dataset: { dated?: boolean }): boolean => dataset.dated === false;

export const isPeriodToken = (v: string): v is PeriodToken => (PERIOD_TOKENS as readonly string[]).includes(v);
