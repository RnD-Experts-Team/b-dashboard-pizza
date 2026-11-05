import { format, isValid, parseISO } from "date-fns";
import { toBusinessWeek } from "@/lib/utils/business-week";
import type { ReportWeek } from "@/types/business-reports.types";

/**
 * Business Reports formatting and bucketing. Number formats come from the V1
 * kit (`components/dspr/wbr-format.tsx`) and the labor colour bands from the V1
 * Labor card, so both pages read the same.
 */
export {
  fmt$,
  fmt$2,
  fmtNum,
  fmtNumD,
  fmtPct,
  fmtPct2,
  fmtDate,
  pctChangeOrNull,
  Delta,
} from "@/components/dspr/wbr-format";
export { LABOR_ZONES, laborColor, laborLabel } from "@/components/dashboard-v1/cards/v1-labor";

const PERCENT = 100;

/**
 * Null-safe text compare for sorts. Upstream rows (hooks forms, HR events,
 * metric labels) can carry null dates/labels; those sort as empty text
 * instead of crashing the page.
 */
export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "");
}

const THOUSAND = 1_000;
const MILLION = 1_000_000;
const EXACT_BELOW = 10_000;
const MILLION_DIGITS = 2;

/**
 * Money that has to fit a small tile: "$102.8K", "$2.53M" (put the exact value
 * in the tile's title). Under $10K it stays exact.
 */
export function fmt$Compact(n: number | null | undefined): string {
  const v = n ?? 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= MILLION) return `${sign}$${(abs / MILLION).toFixed(MILLION_DIGITS)}M`;
  if (abs >= EXACT_BELOW) return `${sign}$${(abs / THOUSAND).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

/** Per-store-day average, or 0 when nothing was recorded. */
export function perStoreDay(value: number, storeDays: number): number {
  return storeDays > 0 ? value / storeDays : 0;
}

/** Share of a total, in %. */
export function share(part: number, total: number): number {
  return total > 0 ? (part / total) * PERCENT : 0;
}

/** Percentage-point difference (current − previous), or null without a previous. */
export function ppDelta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || curr === null || curr === undefined) return null;
  return curr - prev;
}

/* ── Time buckets ────────────────────────────────────────────────────────── */

export type Granularity = "day" | "week" | "period" | "quarter" | "year";

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "period", label: "Period" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const DAILY_UP_TO_DAYS = 62;
const WEEKLY_UP_TO_DAYS = 731;

/** Days up to ~2 months, weeks up to 2 years, then fiscal periods. */
export function defaultGranularity(days: number): Granularity {
  if (days <= DAILY_UP_TO_DAYS) return "day";
  if (days <= WEEKLY_UP_TO_DAYS) return "week";
  return "period";
}

/** "Oct 21"; "—" for a missing or unreadable date (upstream rows can carry null). */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d") : "—";
}

export function fmtRange(start: string, end: string): string {
  return start === end ? fmtDay(start) : `${fmtDay(start)} → ${fmtDay(end)}`;
}

/**
 * The week NUMBER the whole project uses for a Tue–Mon business week: the ISO
 * week of its Tuesday (V1's "Week N" badge, the screens/maintenance week
 * pickers) — not the fiscal week the Data payload also carries.
 */
export function weekNumber(weekStart: string): number {
  return toBusinessWeek(weekStart).number;
}

/** "Wk 43" for a week (by its Tuesday); `withYear` adds " · 2026". */
export function weekLabel(w: { week_start: string }, withYear = false): string {
  const week = toBusinessWeek(w.week_start);
  return withYear ? `Wk ${week.number} · ${week.year}` : `Wk ${week.number}`;
}

export interface Bucket<T> {
  key: string;
  label: string;
  start: string;
  end: string;
  rows: T[];
}

/**
 * Groups business weeks into fiscal periods / quarters / years (the same
 * calendar V1's Sales History uses). "week" keeps one bucket per week.
 */
export function bucketWeeks<T extends ReportWeek>(weeks: T[], by: Exclude<Granularity, "day">): Bucket<T>[] {
  const keyOf = (w: T): [string, string] => {
    if (by === "week") return [w.week_start, weekLabel(w)];
    if (by === "period") return [`${w.fiscal_year}-P${w.period_number}`, `P${w.period_number} · ${w.fiscal_year}`];
    if (by === "quarter") return [`${w.fiscal_year}-Q${w.quarter_number}`, `Q${w.quarter_number} · ${w.fiscal_year}`];
    return [String(w.fiscal_year), `FY ${w.fiscal_year}`];
  };

  return weeks.reduce<Bucket<T>[]>((buckets, w) => {
    const [key, label] = keyOf(w);
    const last = buckets[buckets.length - 1];
    if (last && last.key === key) {
      last.rows.push(w);
      last.end = w.end;
      return buckets;
    }
    return [...buckets, { key, label, start: w.start, end: w.end, rows: [w] }];
  }, []);
}

/** Sums the given numeric keys over rows. */
export function sumKeys<T, K extends keyof T>(rows: T[], keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(
    keys.map((k) => [k, rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)]),
  ) as Record<K, number>;
}
