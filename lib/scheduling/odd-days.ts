import type { InsightAnomaly } from "@/types/scheduling.types";
import type { OddDay, PlanHour, WeekPlan } from "@/lib/scheduling/day-plan";

/**
 * Pure logic behind the odd-days charts: the calendar of the history window,
 * and the chart for one odd date. No React, so none of it depends on how it is
 * drawn.
 *
 * Dates are "YYYY-MM-DD" strings and every calculation goes through UTC. Feeding
 * a bare date to `new Date()` reads it as UTC midnight but prints it in local
 * time, which lands a day early west of Greenwich.
 */

/* ── Dates ──────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const utc = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "2026-09-01" plus 3 is "2026-09-04". */
export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** 0 is Sunday through 6 is Saturday, as in the insights. */
export function weekdayOf(iso: string): number {
  return new Date(utc(iso)).getUTCDay();
}

const monthAbbr = (iso: string): string => MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";

/* ── The calendar ───────────────────────────────────────────────────────── */

export interface CalendarCell {
  date: string;
  /** Day of the month. */
  day: number;
  /** Month abbreviation, on the first cell and on the 1st, so a window that crosses months says so. */
  month: string | null;
  odd: OddDay | null;
  /**
   * How far off the day was against the furthest-off day in the window, from a
   * little (0.2, so the bar is always visible) to 1. Null on a normal day.
   */
  share: number | null;
}

export interface OddCalendar {
  /** One per weekday, in the store's week order. */
  columns: { weekday: number; name: string }[];
  /** Rows of weeks, each one cell per column. Null where the window does not reach. */
  cells: (CalendarCell | null)[][];
}

/**
 * Every date of the history window laid out as weeks. Columns follow the order
 * of `plan.days` (the store's week), and a new row starts whenever the weekday
 * column wraps, so a window that does not begin on the first day of the week
 * still lines up, with blanks at either end.
 */
export function buildOddCalendar(plan: WeekPlan, odd: OddDay[]): OddCalendar {
  const byDate = new Map(odd.map((o) => [o.date, o] as const));
  const max = odd.reduce((m, o) => Math.max(m, o.score), 0);
  const columns = plan.days.map((d) => ({ weekday: d.weekday, name: d.name }));
  const columnOf = new Map(columns.map((c, i) => [c.weekday, i] as const));
  const cells: (CalendarCell | null)[][] = [];

  const span = daysBetween(plan.window.start, plan.window.end);
  let previous = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= span; i++) {
    const date = addDays(plan.window.start, i);
    const col = columnOf.get(weekdayOf(date));
    if (col === undefined) continue;

    // A column at or before the last one means a new week began.
    if (col <= previous) cells.push(Array.from({ length: columns.length }, () => null));
    previous = col;

    const found = byDate.get(date) ?? null;

    cells[cells.length - 1][col] = {
      date,
      day: Number(date.slice(8, 10)),
      month: i === 0 || date.endsWith("-01") ? monthAbbr(date) : null,
      odd: found,
      share: found ? (max > 0 ? Math.min(1, Math.max(0.2, found.score / max)) : 1) : null,
    };
  }

  return { columns, cells };
}

/** How many days of the window fall under each kind, counted off the cells themselves so the legend always matches the grid. */
export function kindTotals(calendar: OddCalendar): Record<"spike" | "dip" | "mixed" | "normal", number> {
  const totals = { spike: 0, dip: 0, mixed: 0, normal: 0 };
  for (const row of calendar.cells) {
    for (const cell of row) {
      if (!cell) continue;
      totals[cell.odd ? cell.odd.kind : "normal"] += 1;
    }
  }
  return totals;
}

/* ── One odd date, as charts ────────────────────────────────────────────── */

export interface DayBar {
  hour: number;
  /** What that hour usually shows. Null when there is no history for it. */
  usual: number | null;
  /** That date's own figure, only at the hours that were flagged. */
  actual: number | null;
  kind: "spike" | "dip" | null;
}

/** A whole-day figure that was flagged: the day against its usual. */
export interface DayMeasure {
  value: number;
  usual: number;
  kind: "spike" | "dip";
}

export interface DayChart {
  /** Sales per hour, or null when there is nothing to draw. */
  sales: DayBar[] | null;
  /** People on the clock per hour, or null when there is nothing to draw. */
  people: DayBar[] | null;
  /** Tallest value in each series, so its bars can be scaled together. */
  salesMax: number;
  peopleMax: number;
  daily: DayMeasure | null;
  labor: DayMeasure | null;
}

function series(
  plan: WeekPlan,
  base: WeekPlan["days"][number] | undefined,
  flagged: Map<number, InsightAnomaly>,
  usualOf: (h: PlanHour) => number | null,
): { bars: DayBar[] | null; max: number } {
  const bars = plan.hours.map((hour, i): DayBar => {
    const f = flagged.get(hour);
    const baseline = base?.hours[i] ? usualOf(base.hours[i]) : null;
    return {
      hour,
      usual: f ? f.usual : baseline,
      actual: f ? f.value : null,
      kind: f ? f.kind : null,
    };
  });
  const any = bars.some((b) => b.usual !== null || b.actual !== null);
  const max = Math.max(1, ...bars.flatMap((b) => [b.usual ?? 0, b.actual ?? 0]));
  return { bars: any ? bars : null, max };
}

const measure = (a: InsightAnomaly | undefined): DayMeasure | null =>
  a ? { value: a.value, usual: a.usual, kind: a.kind } : null;

/**
 * The hour-by-hour picture of one odd date. Hours that were flagged carry the
 * finding's own figures; the rest show only what that weekday usually looks
 * like (from the plan's own days), so the flagged hours stand out against it.
 */
export function buildDayChart(plan: WeekPlan, odd: OddDay): DayChart {
  const base = plan.days.find((d) => d.weekday === odd.weekday);

  const flaggedSales = new Map<number, InsightAnomaly>();
  const flaggedPeople = new Map<number, InsightAnomaly>();
  for (const a of odd.items) {
    if (a.hour === null) continue;
    if (a.metric === "sales") flaggedSales.set(a.hour, a);
    else if (a.metric === "headcount") flaggedPeople.set(a.hour, a);
  }

  const sales = series(plan, base, flaggedSales, (h) => h.sales);
  const people = series(plan, base, flaggedPeople, (h) => h.usual);

  return {
    sales: sales.bars,
    people: people.bars,
    salesMax: sales.max,
    peopleMax: people.max,
    daily: measure(odd.items.find((a) => a.metric === "daily_sales")),
    labor: measure(odd.items.find((a) => a.metric === "labor_hours")),
  };
}
