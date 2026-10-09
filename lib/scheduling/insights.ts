/**
 * The staffing guide's maths: which weeks to look at, and how the two history
 * feeds (sales from LC_PIZZA_DATA, people on the clock from OperationsPizza)
 * become one payload.
 *
 * Pure and dependency-free on purpose. The Next route uses it on the server,
 * and it is small enough to check by hand with Node.
 *
 * Both feeds already speak "store-local hour of the business day" with the
 * small hours after midnight on the previous date, so they join on
 * weekday + hour with no conversion.
 */

import type {
  InsightAnomaly,
  InsightDay,
  InsightHour,
  InsightPair,
  InsightStat,
  SchedulingInsights,
} from "@/types/scheduling.types";

/* ── The window ─────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addIsoDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/**
 * The weeks the history is taken from: the `weeks` complete business weeks
 * before the anchor, where the anchor is the EARLIER of the week on screen and
 * the current week.
 *
 *  - planning a future week  -> the last finished weeks (nothing newer exists);
 *  - looking at an old week  -> the weeks before it, what was known back then.
 *
 * `weekStart` must be a true week start (the grid's `week.start`), which is
 * what keeps the window aligned to whole business weeks.
 */
export function insightsWindow(
  weekStart: string,
  today: string,
  weeks = 4,
): { start: string; end: string } {
  const daysSince = Math.round((toUtc(today) - toUtc(weekStart)) / DAY_MS);
  const currentWeekStart = addIsoDays(weekStart, 7 * Math.floor(daysSince / 7));
  const anchor = weekStart <= currentWeekStart ? weekStart : currentWeekStart;

  return { start: addIsoDays(anchor, -7 * weeks), end: addIsoDays(anchor, -1) };
}

/* ── Raw feed shapes (snake_case, as the two services send them) ─────────── */

interface RawPair {
  avg: number;
  typical: number;
}

interface RawStat extends RawPair {
  low?: number;
  high?: number;
  samples?: number;
  typical_samples?: number;
  volatile?: boolean;
}

interface RawAnomaly {
  date: string;
  weekday: number;
  hour: number | null;
  metric: string;
  kind: "spike" | "dip";
  value: number;
  usual: number;
  ratio: number;
}

interface RawSalesHour {
  hour: number;
  sales: RawStat;
  orders: RawStat;
  delivery_sales?: RawPair;
  carryout_sales?: RawPair;
  drive_thru_sales?: RawPair;
  digital_sales?: RawPair;
}

interface RawSalesDay {
  weekday: number;
  name: string;
  days_sampled: number;
  dates: string[];
  skipped_dates: string[];
  daily: {
    sales: RawStat;
    orders: RawStat;
    customers?: RawPair;
    avg_ticket?: RawPair;
  };
  hours: RawSalesHour[];
}

export interface RawSalesInsights {
  weekdays: RawSalesDay[];
  anomalies: RawAnomaly[];
}

interface RawStaffingHour {
  hour: number;
  headcount: RawStat;
  scheduled_headcount?: RawPair;
  by_job?: Record<string, number>;
}

interface RawStaffingDay {
  weekday: number;
  name: string;
  days_sampled: number;
  dates: string[];
  skipped_dates: string[];
  daily: {
    labor_hours: RawStat;
    labor_cost?: RawPair;
    employees_worked?: RawPair;
  };
  hours: RawStaffingHour[];
}

export interface RawStaffingInsights {
  store?: { business_day_cutoff?: number };
  weekdays: RawStaffingDay[];
  anomalies: RawAnomaly[];
}

/* ── Merge ──────────────────────────────────────────────────────────────── */

const DEFAULT_CUTOFF = 5;
const DEFAULT_WEEK_ORDER = [2, 3, 4, 5, 6, 0, 1];

const stat = (s: RawStat | undefined): InsightStat | null =>
  s
    ? {
        avg: s.avg,
        typical: s.typical,
        low: s.low ?? s.avg,
        high: s.high ?? s.avg,
        samples: s.samples ?? 0,
        typicalSamples: s.typical_samples ?? 0,
        volatile: Boolean(s.volatile),
      }
    : null;

const pair = (p: RawPair | undefined): InsightPair | null =>
  p ? { avg: p.avg, typical: p.typical } : null;

function ratio(top: number | undefined, bottom: number | undefined): number | null {
  if (top === undefined || bottom === undefined || bottom <= 0) return null;
  return top / bottom;
}

function ratioPair(
  top: InsightPair | null | undefined,
  bottom: InsightPair | null | undefined,
): InsightPair | null {
  const avg = ratio(top?.avg, bottom?.avg);
  const typical = ratio(top?.typical, bottom?.typical);
  return avg === null || typical === null ? null : { avg, typical };
}

/** Position of an hour within the business day, which starts at the cutoff. */
export function businessHourIndex(hour: number, cutoff: number): number {
  return (hour - cutoff + 24) % 24;
}

/**
 * One payload from the two feeds. Either may be null (that service failed or
 * is unavailable) and the guide still renders from the other.
 */
export function mergeInsights(
  sales: RawSalesInsights | null,
  staffing: RawStaffingInsights | null,
  window: { start: string; end: string },
): SchedulingInsights {
  const cutoff = staffing?.store?.business_day_cutoff ?? DEFAULT_CUTOFF;

  const salesByDay = new Map((sales?.weekdays ?? []).map((d) => [d.weekday, d]));
  const staffByDay = new Map((staffing?.weekdays ?? []).map((d) => [d.weekday, d]));

  // The store's own week order comes from whichever feed has it; both list
  // weekdays in that order.
  const order = (staffing?.weekdays ?? sales?.weekdays ?? []).map((d) => d.weekday);
  const weekdayOrder = order.length === 7 ? order : DEFAULT_WEEK_ORDER;

  const weekdays: InsightDay[] = weekdayOrder.map((weekday) => {
    const s = salesByDay.get(weekday);
    const p = staffByDay.get(weekday);

    const salesHours = new Map((s?.hours ?? []).map((h) => [h.hour, h]));
    const staffHours = new Map((p?.hours ?? []).map((h) => [h.hour, h]));
    const hourSet = new Set<number>([...salesHours.keys(), ...staffHours.keys()]);

    const hours: InsightHour[] = [...hourSet]
      .sort((a, b) => businessHourIndex(a, cutoff) - businessHourIndex(b, cutoff))
      .map((hour) => {
        const sh = salesHours.get(hour);
        const ph = staffHours.get(hour);

        const salesStat = stat(sh?.sales);
        const headcount = stat(ph?.headcount);
        const scheduled = ph?.scheduled_headcount?.avg ?? null;

        return {
          hour,
          sales: salesStat,
          orders: stat(sh?.orders),
          headcount,
          scheduled,
          byJob: ph?.by_job ?? {},
          splh: ratioPair(salesStat, headcount),
          salesPerScheduled: scheduled && salesStat ? ratio(salesStat.avg, scheduled) : null,
          channels: sh
            ? {
                delivery: pair(sh.delivery_sales) ?? { avg: 0, typical: 0 },
                carryout: pair(sh.carryout_sales) ?? { avg: 0, typical: 0 },
                driveThru: pair(sh.drive_thru_sales) ?? { avg: 0, typical: 0 },
                digital: pair(sh.digital_sales) ?? { avg: 0, typical: 0 },
              }
            : null,
        };
      });

    const daySales = stat(s?.daily.sales);
    const laborCost = pair(p?.daily.labor_cost);

    return {
      weekday,
      name: s?.name ?? p?.name ?? "",
      daysSampled: { sales: s?.days_sampled ?? 0, staffing: p?.days_sampled ?? 0 },
      weeksInWindow: Math.max(
        (s?.dates.length ?? 0) + (s?.skipped_dates.length ?? 0),
        (p?.dates.length ?? 0) + (p?.skipped_dates.length ?? 0),
      ),
      dates: s?.dates ?? p?.dates ?? [],
      skippedDates: s?.skipped_dates ?? p?.skipped_dates ?? [],
      daily: {
        sales: daySales,
        orders: stat(s?.daily.orders),
        customers: pair(s?.daily.customers),
        avgTicket: pair(s?.daily.avg_ticket),
        laborHours: stat(p?.daily.labor_hours),
        laborCost,
        employeesWorked: pair(p?.daily.employees_worked),
        laborPct: ratioPair(laborCost, daySales),
      },
      hours,
    };
  });

  return {
    window,
    sources: { sales: sales ? "ok" : "error", staffing: staffing ? "ok" : "error" },
    businessDayCutoff: cutoff,
    weekdays,
    anomalies: mergeAnomalies(sales?.anomalies ?? [], staffing?.anomalies ?? []),
  };
}

/**
 * One list, newest first. A sales finding and a staffing finding on the same
 * date and hour are one story ("busy, and staffed up for it"), so the staffing
 * one is folded into the sales one rather than listed twice.
 */
export function mergeAnomalies(
  salesFindings: RawAnomaly[],
  staffingFindings: RawAnomaly[],
): InsightAnomaly[] {
  const key = (a: RawAnomaly) => `${a.date}|${a.hour ?? "day"}`;
  const salesMetric = (a: RawAnomaly) => a.metric === "sales" || a.metric === "daily_sales";

  const staffingByKey = new Map(staffingFindings.map((a) => [key(a), a]));
  const salesKeys = new Set(salesFindings.filter(salesMetric).map(key));

  const out: InsightAnomaly[] = [];

  for (const a of salesFindings) {
    const linked = staffingByKey.get(key(a));
    out.push({
      date: a.date,
      weekday: a.weekday,
      hour: a.hour,
      metric: a.metric as InsightAnomaly["metric"],
      kind: a.kind,
      value: a.value,
      usual: a.usual,
      ratio: a.ratio,
      ...(linked ? { staffing: { kind: linked.kind, value: linked.value, usual: linked.usual } } : {}),
    });
  }

  for (const a of staffingFindings) {
    if (salesKeys.has(key(a))) continue;
    out.push({
      date: a.date,
      weekday: a.weekday,
      hour: a.hour,
      metric: a.metric as InsightAnomaly["metric"],
      kind: a.kind,
      value: a.value,
      usual: a.usual,
      ratio: a.ratio,
    });
  }

  return out.sort(
    (x, y) => y.date.localeCompare(x.date) || (x.hour ?? -1) - (y.hour ?? -1),
  );
}
