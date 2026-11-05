"use client";

import { useMemo, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { fmt$, fmt$Compact, fmtPct, laborColor } from "@/components/business-reports/report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  br-dialog-kit — the small pieces the Sales and Menu cards' ReportDialogs
 *  share: a weekly/bucketed trend chart (columns + an optional line on its
 *  own axis), a CSS bar list for rankings, compact money for narrow tiles,
 *  the "Final / Est." labor value, and the store column every By-store
 *  table starts with.
 * ────────────────────────────────────────────────────────────────────────── */

const CHART_HEIGHT = 320;
const BAR_RADIUS = 3;
const LINE_WIDTH = 3;
const MAX_TICKS = 16;
const LABEL_ROTATE = -45;
const COLUMN_OPACITY = 0.9;
const PERCENT = 100;
const MIN_BAR_PCT = 0.5;

/** Money that fits a narrow tile ("$102.8K"), the exact value on hover. */
export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span title={fmt$(value)} className={className}>
      {fmt$Compact(value)}
    </span>
  );
}

/** A labor % coloured by V1's bands, marked "Final" (Hiring) or "Est." (derived). */
export function LaborValue({ value, isFinal }: { value: number | null; isFinal: boolean }) {
  if (value === null || value <= 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="font-semibold" style={{ color: laborColor(value) }}>
        {fmtPct(value)}
      </span>
      <span
        className={cn(
          "rounded px-1.5 py-px text-xs font-semibold uppercase",
          isFinal
            ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isFinal ? "Final" : "Est."}
      </span>
    </span>
  );
}

/** The first column of every By-store table: number + name, sorted by it. */
export function storeColumn<T extends { store: string }>(storeName: (code: string) => string): PagedColumn<T> {
  return {
    key: "store",
    header: "Store",
    sortValue: (r) => storeName(r.store),
    render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
  };
}

/* ── Trend chart ─────────────────────────────────────────────────────────── */

export interface TrendSeries {
  name: string;
  data: number[];
  color: string;
}

/**
 * Columns per bucket (money on the left axis) with an optional line on its
 * own right axis. Callers keep it to ≤ ~120 categories.
 */
export function TrendChart({
  categories,
  bars,
  line,
  lineFormat,
  stacked = false,
  barFormat = fmt$,
  height = CHART_HEIGHT,
}: {
  categories: string[];
  bars: TrendSeries[];
  line?: TrendSeries;
  lineFormat?: (v: number) => string;
  stacked?: boolean;
  barFormat?: (v: number) => string;
  height?: number;
}) {
  const theme = useChartTheme();
  const series = useMemo(
    () => [
      ...bars.map((b) => ({ name: b.name, type: "column", data: b.data })),
      ...(line ? [{ name: line.name, type: "line", data: line.data }] : []),
    ],
    [bars, line],
  );

  const options = useMemo<ApexOptions>(() => {
    const lineFmt = lineFormat ?? barFormat;
    const firstBar = bars[0]?.name;
    return {
      chart: {
        type: "line",
        stacked,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: theme.label,
      },
      theme: { mode: theme.mode },
      colors: [...bars.map((b) => b.color), ...(line ? [line.color] : [])],
      plotOptions: { bar: { borderRadius: BAR_RADIUS, columnWidth: "65%" } },
      dataLabels: { enabled: false },
      stroke: { width: [...bars.map(() => 0), ...(line ? [LINE_WIDTH] : [])], curve: "smooth" },
      xaxis: {
        categories,
        tickAmount: Math.min(categories.length, MAX_TICKS),
        tickPlacement: "on",
        labels: {
          rotate: LABEL_ROTATE,
          hideOverlappingLabels: true,
          style: { fontSize: "12px", colors: theme.label },
        },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: [
        ...bars.map((b, i) => ({
          seriesName: firstBar,
          show: i === 0,
          min: 0,
          labels: { formatter: (v: number) => (v == null ? "" : fmt$Compact(v)), style: { fontSize: "12px", colors: theme.label } },
        })),
        ...(line
          ? [
              {
                seriesName: line.name,
                opposite: true,
                labels: {
                  formatter: (v: number) => (v == null ? "" : lineFmt(v)),
                  style: { fontSize: "12px", colors: theme.label },
                },
              },
            ]
          : []),
      ],
      legend: { position: "top", horizontalAlign: "left", fontSize: "12px", labels: { colors: theme.label } },
      grid: { borderColor: theme.grid },
      tooltip: {
        shared: true,
        intersect: false,
        theme: theme.mode,
        y: {
          formatter: (v: number, opts?: { seriesIndex?: number }) =>
            line && opts?.seriesIndex === bars.length ? lineFmt(v) : barFormat(v),
        },
      },
      fill: { opacity: [...bars.map(() => COLUMN_OPACITY), ...(line ? [1] : [])] },
    };
  }, [theme, categories, bars, line, lineFormat, barFormat, stacked]);

  return <ApexChart key={theme.key} options={options} series={series} type="line" height={height} />;
}

/* ── Bar list (rankings) ─────────────────────────────────────────────────── */

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  display: ReactNode;
  sub?: ReactNode;
  /** CSS colour of this row's bar (defaults to the list's). */
  color?: string;
  /** Tailwind text colour for the value. */
  tone?: string;
}

/** Horizontal bars sized by |value| against the largest, readable at dialog size. */
export function BarList({ rows, color, empty = "Nothing to show" }: { rows: BarRow[]; color: string; empty?: string }) {
  const max = useMemo(() => rows.reduce((m, r) => Math.max(m, Math.abs(r.value)), 0), [rows]);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className={cn("shrink-0 font-semibold tabular-nums", r.tone)}>
              {r.display}
              {r.sub && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? Math.max((Math.abs(r.value) / max) * PERCENT, MIN_BAR_PCT) : 0}%`,
                backgroundColor: r.color ?? color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
