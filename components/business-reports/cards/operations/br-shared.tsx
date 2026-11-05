"use client";

import { useMemo, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import { addDays, differenceInCalendarDays, format as formatDate, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { businessWeekStart, toBusinessWeek } from "@/lib/utils/business-week";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmt$Compact, fmtNum, weekLabel } from "@/components/business-reports/report-format";

/**
 * Small pieces shared by the Business Reports Operations, Finance and Quality
 * cards and their dialogs: per-store rows, "click a row to focus the store",
 * week labels and buckets, delta chips, compact tile values, the weekly trend
 * chart and the ranked share bars.
 */

export const PERCENT = 100;
export const NO_VALUE = "—";

/** Rows a card body lists before pointing at its dialog for the rest. */
export const CARD_LIST_LIMIT = 12;

const SCORE_GOOD = 80;
const SCORE_FAIR = 50;
const PP_EPSILON = 0.05;

const THOUSAND = 1_000;
const MILLION = 1_000_000;
const COMPACT_FROM = 100_000;
const MILLION_DIGITS = 2;

const DAYS_IN_WEEK = 7;
/** "2026-10-21" out of "2026-10-21 14:05:00" or an ISO instant. */
const DATE_LENGTH = 10;

const GOOD_TEXT = "text-emerald-600 dark:text-emerald-400";
const BAD_TEXT = "text-red-600 dark:text-red-400";

/** V1's three-band score colour (HNR+, Cleaning Review). */
export function scoreColor(score: number): string {
  if (score >= SCORE_GOOD) return GOOD_TEXT;
  if (score >= SCORE_FAIR) return "text-amber-600 dark:text-amber-400";
  return BAD_TEXT;
}

/** "3 records" / "1 record". */
export function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

/** Mean of the values that are present, or null when none are. */
export function meanOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

/** Counts that have to fit a narrow tile: "123.4K", "2.53M"; exact below 100K. */
export function fmtNumCompact(n: number | null | undefined): string {
  const v = n ?? 0;
  const abs = Math.abs(v);
  if (abs >= MILLION) return `${(v / MILLION).toFixed(MILLION_DIGITS)}M`;
  if (abs >= COMPACT_FROM) return `${(v / THOUSAND).toFixed(1)}K`;
  return fmtNum(v);
}

/** A narrow-tile money value: compact, with the exact amount on hover. */
export function Money({ value }: { value: number }) {
  return <span title={fmt$2(value)}>{fmt$Compact(value)}</span>;
}

/** A narrow-tile count: compact, with the exact count on hover. */
export function Count({ value }: { value: number }) {
  return <span title={fmtNum(value)}>{fmtNumCompact(value)}</span>;
}

/** Which way a change is good: "up" greens rises, "down" greens drops, "neutral" colours neither. */
export type GoodWhen = "up" | "down" | "neutral";

function deltaTone(d: number, goodWhen: GoodWhen): string {
  if (goodWhen === "neutral") return "text-foreground";
  const good = goodWhen === "up" ? d > 0 : d < 0;
  return good ? GOOD_TEXT : BAD_TEXT;
}

/** Point change (curr − prev) as "+1.5pp"; "—" without a previous week. */
export function PpDelta({
  curr,
  prev,
  goodWhen = "up",
}: {
  curr: number | null | undefined;
  prev?: number | null;
  goodWhen?: GoodWhen;
}) {
  if (prev === undefined || prev === null || curr === null || curr === undefined) {
    return <span className="text-muted-foreground">{NO_VALUE}</span>;
  }
  const d = curr - prev;
  if (Math.abs(d) < PP_EPSILON) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  return (
    <span className={cn("tabular-nums", deltaTone(d, goodWhen))}>
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}pp
    </span>
  );
}

/** Count change (curr − prev) as "+12" / "-5"; "—" without a previous week or with no change. */
export function CountDelta({
  curr,
  prev,
  goodWhen = "up",
  format = fmtNum,
}: {
  curr: number;
  prev?: number | null;
  goodWhen?: GoodWhen;
  format?: (n: number) => string;
}) {
  if (prev === undefined || prev === null || curr === prev) {
    return <span className="text-muted-foreground">{NO_VALUE}</span>;
  }
  const d = curr - prev;
  return (
    <span className={cn("tabular-nums", deltaTone(d, goodWhen))}>
      {d > 0 ? "+" : ""}
      {format(d)}
    </span>
  );
}

/** Each row with the one before it (rows already chronological). */
export function withPrev<T>(rows: T[]): Array<{ row: T; prev: T | null }> {
  return rows.map((row, i) => ({ row, prev: i > 0 ? rows[i - 1] : null }));
}

export interface StoreRow<T> {
  store: string;
  name: string;
  data: T;
}

/** PagedTable `searchText` for store rows. */
export const storeSearch = (r: { name: string }): string => r.name;

/** A `by_store` block as table rows with display names. */
export function useStoreRows<T>(byStore: Record<string, T> | undefined | null): StoreRow<T>[] {
  const { storeName } = useReport();
  return useMemo(
    () => Object.entries(byStore ?? {}).map(([store, data]) => ({ store, name: storeName(store), data })),
    [byStore, storeName],
  );
}

/** With several stores loaded, a per-store row click reloads the page for that store. */
export function useStoreFocus<T extends { store: string }>(): {
  onRowClick?: (row: T) => void;
  footerNote?: string;
} {
  const { params, focusStore } = useReport();
  const many = params.stores.length > 1;
  return useMemo(
    () =>
      many
        ? { onRowClick: (row: T) => focusStore(row.store), footerNote: "click a row to focus the store" }
        : {},
    [many, focusStore],
  );
}

/* ── Weeks ───────────────────────────────────────────────────────────────── */

/**
 * week_start → "Wk 43" (the project-wide week number); "Wk 43 · 2026" when
 * the weeks span more than one year, so numbers never repeat ambiguously.
 */
export function useWeekLabel(weeks: Array<{ week_start: string }> | undefined): (weekStart: string) => string {
  return useMemo(() => {
    const years = new Set((weeks ?? []).map((w) => toBusinessWeek(w.week_start).year));
    const withYear = years.size > 1;
    return (weekStart: string) => weekLabel({ week_start: weekStart }, withYear);
  }, [weeks]);
}

/** The business week (its Tuesday) a record's date falls in; null for a missing or unreadable date. */
export function weekStartOf(date: string | null | undefined): string | null {
  if (!date) return null;
  const day = date.slice(0, DATE_LENGTH);
  return isValid(parseISO(day)) ? businessWeekStart(day) : null;
}

/** Every business week (its Tuesday) overlapping the loaded range, oldest first. */
export function useRangeWeeks(): Array<{ week_start: string }> {
  const { params } = useReport();
  return useMemo(() => {
    const first = weekStartOf(params.startDate);
    const last = weekStartOf(params.endDate);
    if (!first || !last) return [];
    const count = Math.floor(differenceInCalendarDays(parseISO(last), parseISO(first)) / DAYS_IN_WEEK) + 1;
    const start = parseISO(first);
    return Array.from({ length: Math.max(count, 0) }, (_, i) => ({
      week_start: formatDate(addDays(start, i * DAYS_IN_WEEK), "yyyy-MM-dd"),
    }));
  }, [params.startDate, params.endDate]);
}

/* ── Dialog pieces ───────────────────────────────────────────────────────── */

const CHART_HEIGHT = 300;
const LINE_WIDTH = 3;
const MARKER_SIZE = 4;
const BAR_RADIUS = 3;
const LABEL_ROTATE = -45;
const AXIS_FONT = "12px";
const BAND_OPACITY = 0.12;

export interface TrendSeries {
  name: string;
  data: Array<number | null>;
  color: string;
}

/**
 * The dialogs' weekly trend: one or more series over the week labels, as
 * lines or bars. `barColors` colours each bar on its own (one series only);
 * `band` shades a target range.
 */
export function TrendChart({
  categories,
  series,
  kind = "line",
  format,
  barColors,
  band,
  stacked = false,
  height = CHART_HEIGHT,
}: {
  categories: string[];
  series: TrendSeries[];
  kind?: "line" | "bar";
  format: (v: number) => string;
  barColors?: string[];
  band?: { from: number; to: number; color: string };
  stacked?: boolean;
  height?: number;
}) {
  const theme = useChartTheme();
  const apexSeries = useMemo(() => series.map((s) => ({ name: s.name, data: s.data })), [series]);
  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: kind,
        stacked,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: theme.label,
      },
      theme: { mode: theme.mode },
      colors: barColors ?? series.map((s) => s.color),
      stroke: { curve: "smooth", width: kind === "line" ? LINE_WIDTH : 0 },
      markers: { size: kind === "line" ? MARKER_SIZE : 0 },
      plotOptions: { bar: { distributed: Boolean(barColors), borderRadius: BAR_RADIUS, columnWidth: "60%" } },
      dataLabels: { enabled: false },
      legend: {
        show: series.length > 1,
        position: "top",
        horizontalAlign: "left",
        fontSize: AXIS_FONT,
        labels: { colors: theme.label },
      },
      xaxis: {
        categories,
        labels: { rotate: LABEL_ROTATE, hideOverlappingLabels: true, style: { fontSize: AXIS_FONT, colors: theme.label } },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => (typeof v === "number" ? format(v) : NO_VALUE),
          style: { fontSize: AXIS_FONT, colors: theme.label },
        },
      },
      grid: { borderColor: theme.grid },
      annotations: band
        ? { yaxis: [{ y: band.from, y2: band.to, fillColor: band.color, opacity: BAND_OPACITY, borderColor: "transparent" }] }
        : {},
      tooltip: {
        theme: theme.mode,
        y: { formatter: (v: number) => (typeof v === "number" ? format(v) : NO_VALUE) },
      },
    }),
    [kind, stacked, theme.label, theme.mode, theme.axis, theme.grid, barColors, series, categories, format, band],
  );
  if (categories.length === 0) return <DialogEmpty>No weeks in this range.</DialogEmpty>;
  return <ApexChart key={theme.key} type={kind} height={height} options={options} series={apexSeries} />;
}

export interface ShareRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown instead of the formatted count. */
  display?: ReactNode;
  /** Bar colour (defaults to the list's colour). */
  color?: string;
  title?: string;
}

const SHARE_SIZES = {
  sm: { row: "gap-2 py-0.5", label: "text-[11px]", value: "text-[11px]", share: "text-[10px] w-9", bar: "h-1.5 w-16" },
  lg: { row: "gap-3 py-1.5", label: "text-sm", value: "text-sm", share: "text-xs w-12", bar: "h-2.5 w-40" },
} as const;

/** A ranked list: label, a share-of-total bar, the count and its share. */
export function ShareBars({
  rows,
  color,
  total,
  size = "sm",
  limit,
}: {
  rows: ShareRow[];
  color: string;
  /** Defaults to the sum of the rows. */
  total?: number;
  size?: keyof typeof SHARE_SIZES;
  limit?: number;
}) {
  const cls = SHARE_SIZES[size];
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <div>
      {shown.map((r) => {
        const pct = sum > 0 ? (r.value / sum) * PERCENT : 0;
        return (
          <div key={r.key} className={cn("flex items-center border-b border-border/40 last:border-0", cls.row)} title={r.title}>
            <span className={cn("min-w-0 flex-1 truncate font-medium", cls.label)}>{r.label}</span>
            <span className={cn("shrink-0 overflow-hidden rounded-full bg-muted", cls.bar)}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.min(PERCENT, pct)}%`, backgroundColor: r.color ?? color }}
              />
            </span>
            <span className={cn("shrink-0 text-end font-semibold tabular-nums", cls.value)}>{r.display ?? fmtNum(r.value)}</span>
            <span className={cn("shrink-0 text-end tabular-nums text-muted-foreground", cls.share)}>{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** Empty state inside a dialog tab. */
export function DialogEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** A short explanatory line under a dialog block. */
export function DialogNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export interface ScoreRow {
  key: string;
  label: ReactNode;
  /** 0–100. */
  score: number;
  /** Small text after the score ("12/14 passed"). */
  sub?: ReactNode;
  title?: string;
}

/** A dialog list of 0–100 scores: label, a bar as wide as the score, the score in its V1 colour band. */
export function ScoreBars({ rows, color }: { rows: ScoreRow[]; color: string }) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 border-b border-border/40 py-1.5 last:border-0" title={r.title}>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
          <span className="h-2.5 w-40 shrink-0 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.min(PERCENT, Math.max(0, r.score))}%`, backgroundColor: color }}
            />
          </span>
          <span className={cn("w-16 shrink-0 text-end text-sm font-semibold tabular-nums", scoreColor(r.score))}>
            {r.score.toFixed(1)}%
          </span>
          {r.sub !== undefined && <span className="w-28 shrink-0 text-end text-xs tabular-nums text-muted-foreground">{r.sub}</span>}
        </div>
      ))}
    </div>
  );
}
