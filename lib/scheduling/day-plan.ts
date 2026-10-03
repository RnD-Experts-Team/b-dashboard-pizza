/**
 * The plan-against-history model behind the scheduling grid's plan row and the
 * week outlook: for each day on screen, what the last few weeks looked like and
 * how the plan being built compares, hour by hour.
 *
 * Everything the manager reads is decided here, once, so the grid cells and the
 * outlook band are plain renderers and can never disagree with each other.
 *
 * "Usual" is what past weeks really ran: people actually on the clock, not what
 * was scheduled. The plan is compared with that, so "short" means "fewer people
 * than you normally end up needing at this hour".
 *
 * Pure and dependency-free.
 */

import { plannedCoverage, minutesBetween, type CoverageShift } from "./hourly-coverage";
import { businessHourIndex } from "./insights";
import type {
  InsightAnomaly,
  InsightPair,
  SchedulingInsights,
} from "@/types/scheduling.types";

/** Which weeks the history counts: odd weeks left out, or every week. */
export type Basis = "typical" | "avg";

/** At least this many people under the usual is worth saying. */
const SHORT_AT = 0.75;
/** Over the usual by this many is worth saying; one spare person is normal. */
const EXTRA_AT = 1.5;

export type HourStatus = "short" | "ok" | "extra" | "closed";

export interface PlanHour {
  hour: number;
  /** People usually on the clock. Null when there is no staffing history. */
  usual: number | null;
  /** Fewest and most people on the clock in any one of the weeks. */
  usualRange: [number, number] | null;
  /** People usually SCHEDULED at this hour in past plans. */
  usualScheduled: number | null;
  /** People on the plan being built (fractional: a half hour counts half). */
  planned: number;
  status: HourStatus;
  /** Usual sales and orders in this hour, and the range across the weeks. */
  sales: number | null;
  salesRange: [number, number] | null;
  orders: number | null;
  /** Odd weeks at this weekday and hour. */
  odd: InsightAnomaly[];
}

export interface PlanGap {
  kind: "short" | "extra";
  /** First hour, 0-23. */
  from: number;
  /** Hour it ends at (exclusive), 0-23. */
  to: number;
  /** Fewest and most people short (or extra) across the range. */
  min: number;
  max: number;
}

export type DayState = "no-history" | "not-started" | "matches" | "gaps";

export interface DayPlan {
  dayIndex: number;
  date: string;
  weekday: number;
  name: string;
  /** Weeks that counted for this weekday, and weeks in the window. */
  sampled: number;
  weeksInWindow: number;
  expectedSales: number | null;
  usualHours: number | null;
  usualLaborCost: number | null;
  plannedHours: number;
  /** Aligned to the week's shared hour range, so columns line up by hour. */
  hours: PlanHour[];
  gaps: PlanGap[];
  /** Odd weeks flagged for this weekday (left out when basis is typical). */
  oddWeeks: number;
  state: DayState;
}

export interface WeekPlan {
  /** Hours shown in every day's strip, in business-day order. */
  hours: number[];
  /** People at full bar height, shared by every day so days compare by eye. */
  scale: number;
  days: DayPlan[];
  expectedSales: number | null;
  usualHours: number | null;
  usualLaborPct: number | null;
  plannedHours: number;
  /** Busiest days by expected sales, most first. */
  busiest: DayPlan[];
  /** The single busiest hour of the week, by people usually on the clock. */
  peak: { day: DayPlan; hour: number; people: number } | null;
  /** Odd dates worth knowing about, one line each, furthest off first. */
  keepInMind: OddDay[];
  window: { start: string; end: string };
  missing: { sales: boolean; staffing: boolean };
}

export interface PlanInputShift {
  shiftDate: string;
  startTime: string;
  durationMinutes: number;
}

export interface PlanInputDraft {
  dayIndex: number;
  startTime: string;
  endTime: string;
}

const pick = (p: InsightPair | null | undefined, basis: Basis): number | null =>
  p ? p[basis] : null;

function statusFor(usual: number | null, planned: number): HourStatus {
  if (usual === null) return planned > 0 ? "ok" : "closed";
  if (usual < 0.25 && planned === 0) return "closed";
  const diff = planned - usual;
  if (diff <= -SHORT_AT) return "short";
  if (diff >= EXTRA_AT) return "extra";
  return "ok";
}

function gapsFor(hours: PlanHour[]): PlanGap[] {
  const gaps: PlanGap[] = [];
  let current: PlanGap | null = null;

  for (const h of hours) {
    const kind = h.status === "short" || h.status === "extra" ? h.status : null;
    const people =
      kind === "short"
        ? Math.max(1, Math.round((h.usual ?? 0) - h.planned))
        : kind === "extra"
          ? Math.max(1, Math.round(h.planned - (h.usual ?? 0)))
          : 0;

    if (kind && current && current.kind === kind) {
      current.to = (h.hour + 1) % 24;
      current.min = Math.min(current.min, people);
      current.max = Math.max(current.max, people);
      continue;
    }

    if (current) gaps.push(current);
    current = kind ? { kind, from: h.hour, to: (h.hour + 1) % 24, min: people, max: people } : null;
  }
  if (current) gaps.push(current);

  // Shortages first, then the biggest.
  return gaps.sort(
    (a, b) =>
      (a.kind === "short" ? 0 : 1) - (b.kind === "short" ? 0 : 1) ||
      b.max - a.max,
  );
}

export function buildWeekPlan(
  insights: SchedulingInsights,
  week: { fullDates: string[]; weekStartDow: number; dayNames: string[] },
  shifts: PlanInputShift[],
  drafts: PlanInputDraft[],
  basis: Basis,
): WeekPlan {
  const cutoff = insights.businessDayCutoff;

  const coverageInput: CoverageShift[] = [
    ...shifts,
    ...drafts.map((d) => ({
      shiftDate: week.fullDates[d.dayIndex] ?? week.fullDates[0],
      startTime: d.startTime,
      durationMinutes: minutesBetween(d.startTime, d.endTime),
    })),
  ];
  const coverage = plannedCoverage(coverageInput, cutoff);

  // One hour range for the whole week, so 6 pm sits in the same place in every
  // column: from the earliest hour anything happens to the latest.
  const active = new Set<number>();
  for (const day of insights.weekdays) {
    for (const h of day.hours) {
      const usual = pick(h.headcount, basis) ?? 0;
      const sales = pick(h.sales, basis) ?? 0;
      if (usual >= 0.25 || sales > 0) active.add(h.hour);
    }
  }
  for (const date of week.fullDates) {
    coverage[date]?.forEach((v, hour) => {
      if (v > 0) active.add(hour);
    });
  }
  const ordered = [...active].map((h) => businessHourIndex(h, cutoff));
  const hours: number[] = [];
  if (ordered.length > 0) {
    const first = Math.min(...ordered);
    const last = Math.max(...ordered);
    for (let i = first; i <= last; i++) hours.push((i + cutoff) % 24);
  }

  let scale = 1;

  const days: DayPlan[] = week.fullDates.map((date, dayIndex) => {
    const weekday = (week.weekStartDow + dayIndex) % 7;
    const insight = insights.weekdays.find((d) => d.weekday === weekday);
    const byHour = new Map((insight?.hours ?? []).map((h) => [h.hour, h]));
    const slots = coverage[date];

    const planHours: PlanHour[] = hours.map((hour) => {
      const h = byHour.get(hour);
      const usual = insights.sources.staffing === "ok" && insight ? (pick(h?.headcount, basis) ?? 0) : null;
      const planned = slots ? slots[hour] : 0;
      scale = Math.max(scale, usual ?? 0, planned);
      return {
        hour,
        usual,
        usualRange: h?.headcount ? [h.headcount.low, h.headcount.high] : null,
        usualScheduled: h?.scheduled ?? null,
        planned,
        status: statusFor(usual, planned),
        sales: pick(h?.sales, basis),
        salesRange: h?.sales ? [h.sales.low, h.sales.high] : null,
        orders: pick(h?.orders, basis),
        odd: insights.anomalies.filter((a) => a.weekday === weekday && a.hour === hour),
      };
    });

    const plannedHours = slots ? slots.reduce((a, b) => a + b, 0) : 0;
    const expectedSales = pick(insight?.daily.sales, basis);
    const usualHours = pick(insight?.daily.laborHours, basis);
    const sampled = Math.max(insight?.daysSampled.sales ?? 0, insight?.daysSampled.staffing ?? 0);
    const hasHistory = sampled > 0;
    const gaps = hasHistory ? gapsFor(planHours) : [];

    return {
      dayIndex,
      date,
      weekday,
      name: week.dayNames[dayIndex] ?? insight?.name ?? "",
      sampled,
      weeksInWindow: insight?.weeksInWindow ?? 0,
      expectedSales: hasHistory ? expectedSales : null,
      usualHours: hasHistory ? usualHours : null,
      usualLaborCost: hasHistory ? pick(insight?.daily.laborCost, basis) : null,
      plannedHours,
      hours: planHours,
      gaps,
      oddWeeks: insights.anomalies.filter((a) => a.weekday === weekday).length,
      state: !hasHistory
        ? "no-history"
        : plannedHours === 0
          ? "not-started"
          : gaps.length === 0
            ? "matches"
            : "gaps",
    };
  });

  const sum = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    return present.length ? present.reduce((a, b) => a + b, 0) : null;
  };

  const expectedSales = sum(days.map((d) => d.expectedSales));
  const usualHours = sum(days.map((d) => d.usualHours));
  const costed = days.filter((d) => d.usualLaborCost !== null && d.expectedSales);
  const costSum = sum(costed.map((d) => d.usualLaborCost));
  const salesSum = sum(costed.map((d) => d.expectedSales));

  let peak: WeekPlan["peak"] = null;
  for (const day of days) {
    for (const h of day.hours) {
      if (h.usual !== null && (!peak || h.usual > peak.people)) {
        peak = { day, hour: h.hour, people: h.usual };
      }
    }
  }

  return {
    hours,
    scale: Math.ceil(scale),
    days,
    expectedSales,
    usualHours,
    usualLaborPct: costSum !== null && salesSum ? costSum / salesSum : null,
    plannedHours: days.reduce((a, d) => a + d.plannedHours, 0),
    busiest: days
      .filter((d) => d.expectedSales !== null)
      .sort((a, b) => (b.expectedSales ?? 0) - (a.expectedSales ?? 0))
      .slice(0, 2),
    peak,
    keepInMind: summarizeOddDays(insights.anomalies, cutoff),
    window: insights.window,
    missing: {
      sales: insights.sources.sales !== "ok",
      staffing: insights.sources.staffing !== "ok",
    },
  };
}

/* ── Words ──────────────────────────────────────────────────────────────── */

/** 17 -> "5p", 0 -> "12a", 12 -> "12p". */
export function shortHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "a" : "p"}`;
}

/** 17..19 -> "5–7p"; 11..13 -> "11a–1p". */
export function hourRange(from: number, to: number): string {
  const sameHalf = (from < 12) === (to < 12) && to !== 0;
  const start = sameHalf ? String(from % 12 === 0 ? 12 : from % 12) : shortHour(from);
  return `${start}–${shortHour(to)}`;
}

/**
 * 17 -> "5 PM", 0 -> "12 AM", 12 -> "12 PM". The plain-spoken sibling of
 * `shortHour`, with the same uppercase-and-a-space form as the DSPR hourly
 * charts, for places that have the room to be easy to read.
 */
export function clockHour(hour: number): string {
  const h24 = ((hour % 24) + 24) % 24;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h} ${h24 < 12 ? "AM" : "PM"}`;
}

/** 17..19 -> "5–7 PM"; 11..13 -> "11 AM–1 PM". The first AM/PM is dropped when both ends share it. */
export function clockHourRange(from: number, to: number): string {
  const sameHalf = (from < 12) === (to < 12) && to !== 0;
  const start = sameHalf ? String(from % 12 === 0 ? 12 : from % 12) : clockHour(from);
  return `${start}–${clockHour(to)}`;
}

/** "$2.4k", "$860". */
export function compactMoney(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

export function gapText(g: PlanGap): string {
  const people = g.min === g.max ? `${g.max}` : `${g.min}–${g.max}`;
  return `${g.kind === "short" ? "Short" : "Extra"} ${people} · ${hourRange(g.from, g.to)}`;
}

/* ── Odd weeks, one line per date ───────────────────────────────────────── */

export interface OddDay {
  date: string;
  weekday: number;
  kind: "spike" | "dip" | "mixed";
  /** The whole story of that date in one sentence. */
  text: string;
  /** How far off the date was, for ranking. */
  score: number;
  /** The findings behind the sentence, so the date can be drawn rather than read. */
  items: InsightAnomaly[];
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-12" -> "Sat Sep 12", without passing through local-time Date parsing. */
export function isoDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DOW[dow]} ${MONTHS[m - 1]} ${d}`;
}

const wholeMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Consecutive business hours of the same kind become one range. */
function hourRuns(items: InsightAnomaly[], cutoff: number): InsightAnomaly[][] {
  const sorted = [...items].sort(
    (a, b) => businessHourIndex(a.hour ?? 0, cutoff) - businessHourIndex(b.hour ?? 0, cutoff),
  );
  const runs: InsightAnomaly[][] = [];
  for (const a of sorted) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      prev.kind === a.kind &&
      businessHourIndex(a.hour ?? 0, cutoff) === businessHourIndex(prev.hour ?? 0, cutoff) + 1
    ) {
      last.push(a);
    } else {
      runs.push([a]);
    }
  }
  return runs;
}

function runRange(run: InsightAnomaly[]): string {
  const from = run[0].hour ?? 0;
  const to = ((run[run.length - 1].hour ?? 0) + 1) % 24;
  return run.length === 1 ? clockHour(from) : clockHourRange(from, to);
}

/**
 * Every odd finding, grouped into one plain sentence per date and ranked by how
 * far off that date was. A busy Saturday that was odd in six separate hours is
 * one line, not six.
 */
export function summarizeOddDays(anomalies: InsightAnomaly[], cutoff: number): OddDay[] {
  const byDate = new Map<string, InsightAnomaly[]>();
  for (const a of anomalies) {
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  }

  const days: OddDay[] = [];

  for (const [date, items] of byDate) {
    const parts: string[] = [];
    let score = 0;
    const off = (a: InsightAnomaly) => Math.abs(a.ratio - 1);

    const daily = items.find((a) => a.metric === "daily_sales");
    if (daily) {
      parts.push(
        `${daily.kind === "spike" ? "busy" : "slow"} day, ${wholeMoney(daily.value)} in sales vs usually ${wholeMoney(daily.usual)}`,
      );
      score += off(daily) * 3;
    }

    // Furthest-off stretch first, so the two that are shown are the two that matter.
    const runOff = (run: InsightAnomaly[]) => Math.max(...run.map((a) => Math.abs(a.ratio - 1)));
    const salesRuns = hourRuns(items.filter((a) => a.metric === "sales" && a.hour !== null), cutoff)
      .sort((x, y) => runOff(y) - runOff(x));
    for (const run of salesRuns) {
      const spike = run[0].kind === "spike";
      const ratio = spike ? Math.max(...run.map((a) => a.ratio)) : Math.min(...run.map((a) => a.ratio));
      const extra = run
        .map((a) => (a.staffing ? a.staffing.value - a.staffing.usual : 0))
        .reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
      let text = spike
        ? `${runRange(run)} sales up to ${ratio.toFixed(1)}× usual`
        : `${runRange(run)} sales down to ${Math.round(ratio * 100)}% of usual`;
      if (Math.round(Math.abs(extra)) >= 1) {
        text += `, ${Math.round(Math.abs(extra))} ${extra > 0 ? "more" : "fewer"} people on`;
      }
      parts.push(text);
    }
    score += items.filter((a) => a.metric === "sales").reduce((s, a) => s + off(a), 0);

    const peopleRuns = hourRuns(items.filter((a) => a.metric === "headcount" && a.hour !== null), cutoff)
      .sort((x, y) => runOff(y) - runOff(x));
    for (const run of peopleRuns) {
      const most = run.reduce((m, a) => Math.max(m, Math.abs(a.value - a.usual)), 0);
      parts.push(
        `${runRange(run)} ${Math.max(1, Math.round(most))} ${run[0].kind === "spike" ? "more" : "fewer"} people on the clock than usual`,
      );
    }
    score += items.filter((a) => a.metric === "headcount").reduce((s, a) => s + off(a) * 0.5, 0);

    const labor = items.find((a) => a.metric === "labor_hours");
    if (labor) {
      parts.push(`${Math.round(labor.value)} labor hours vs usually ${Math.round(labor.usual)}`);
      score += off(labor) * 2;
    }

    const kinds = new Set(items.map((a) => a.kind));
    days.push({
      date,
      weekday: items[0].weekday,
      kind: kinds.size > 1 ? "mixed" : (items[0].kind as "spike" | "dip"),
      // Two things per date, the biggest first; the rest are counted, not listed.
      text: `${isoDateLabel(date)}: ${parts.slice(0, 2).join("; ")}${
        parts.length > 2 ? ` (+${parts.length - 2} more)` : ""
      }`,
      score,
      items,
    });
  }

  return days.sort((a, b) => b.score - a.score);
}
