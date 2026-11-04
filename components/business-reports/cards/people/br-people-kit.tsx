"use client";

import type { ReactNode } from "react";
import { isValid, parseISO } from "date-fns";
import type { ApexOptions } from "apexcharts";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { buildTooltipCustom } from "@/components/labor/labor-chart";
import { DASH } from "@/components/labor/labor-format";
import type { useChartTheme } from "@/components/business-reports/chart";
import { fmtDay } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  Shared bits for the Business Reports "People & Labor" cards: the people
 *  colour ramp, Apex option builders (V1 look, literal colours from
 *  useChartTheme) and a few tiny render helpers. Number formatting comes
 *  from components/labor/labor-format.ts (null → "—", never 0).
 * ────────────────────────────────────────────────────────────────────────── */

export const PEOPLE = CATEGORIES.people;
export const PEOPLE_COLORS = PEOPLE.chartColors;

/** Height shared by the cards that sit in one row (headcount, tenure, turnover…). */
export const ROW_CARD_HEIGHT = 340;
/** Two decimals, for scores and averages. */
export const TWO_DP = 2;
/** Rows previewed inside a card body before "see all" takes over. */
export const PREVIEW_ROWS = 6;

const AXIS_FONT = "10px";
const LINE_WIDTH = 2.5;
const MARKER_SIZE = 4;
const MARKER_HOVER_SIZE = 6;
const BAR_RADIUS = 3;
/** Keeps long week axes readable. */
const MAX_X_TICKS = 12;

type ChartTheme = ReturnType<typeof useChartTheme>;

/** The common Apex base every people chart starts from. */
export function peopleChartBase(theme: ChartTheme, formatValue: (v: number) => string): ApexOptions {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      background: "transparent",
      animations: { enabled: false },
      foreColor: theme.label,
    },
    theme: { mode: theme.mode },
    grid: { borderColor: theme.grid, strokeDashArray: MARKER_SIZE },
    dataLabels: { enabled: false },
    legend: { show: false },
    colors: [PEOPLE_COLORS[0]],
    xaxis: {
      labels: { style: { colors: theme.label, fontSize: AXIS_FONT } },
      axisBorder: { color: theme.axis },
      axisTicks: { color: theme.axis },
    },
    yaxis: {
      labels: { style: { colors: theme.label, fontSize: AXIS_FONT }, formatter: formatValue },
    },
    tooltip: { custom: buildTooltipCustom({ isDark: theme.isDark, formatValue }) },
  };
}

/** A single smooth people-coloured line over category labels. */
export function peopleLineOptions(
  theme: ChartTheme,
  categories: string[],
  formatValue: (v: number) => string,
): ApexOptions {
  const base = peopleChartBase(theme, formatValue);
  return {
    ...base,
    chart: { ...base.chart, type: "line" },
    stroke: { curve: "smooth", width: LINE_WIDTH },
    markers: { size: MARKER_SIZE, strokeWidth: 1, hover: { size: MARKER_HOVER_SIZE } },
    xaxis: { ...base.xaxis, categories, tickAmount: Math.min(categories.length, MAX_X_TICKS) },
  };
}

/** People-coloured bars (columns, or horizontal for category lists). */
export function peopleBarOptions(
  theme: ChartTheme,
  categories: string[],
  formatValue: (v: number) => string,
  horizontal: boolean,
): ApexOptions {
  const base = peopleChartBase(theme, formatValue);
  return {
    ...base,
    chart: { ...base.chart, type: "bar" },
    plotOptions: { bar: { horizontal, borderRadius: BAR_RADIUS, barHeight: "70%", columnWidth: "55%" } },
    dataLabels: {
      enabled: true,
      formatter: (v: number) => formatValue(v),
      style: { fontSize: AXIS_FONT, colors: ["#fff"] },
    },
    xaxis: { ...base.xaxis, categories },
  };
}

/** "Oct 21" — or the raw value when it isn't an ISO date. */
export function safeDay(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return isValid(parseISO(iso)) ? fmtDay(iso) : iso;
}

/** An employee's display name — upstream names can be null. */
export function employeeName(name: string | null | undefined, id: number | null | undefined): string {
  if (name) return name;
  return id === null || id === undefined ? "Unknown" : `Employee #${id}`;
}

/** Small muted store label used next to names in lists. */
export function StoreTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("min-w-0 truncate text-[9.5px] text-muted-foreground", className)}>{children}</span>
  );
}

/** "See all N" link-style button at the foot of a preview list. */
export function SeeAll({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("mt-1 text-[10px] font-semibold hover:underline", PEOPLE.text)}
    >
      See all {count.toLocaleString()} →
    </button>
  );
}
