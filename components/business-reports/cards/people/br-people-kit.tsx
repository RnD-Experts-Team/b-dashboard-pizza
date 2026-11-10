"use client";

import { isValid, parseISO } from "date-fns";
import type { ApexOptions } from "apexcharts";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { buildTooltipCustom } from "@/components/labor/labor-chart";
import { DASH } from "@/components/labor/labor-format";
import type { useChartTheme } from "@/components/business-reports/chart";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$Compact, fmtDay, fmtPct, laborColor } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  Shared bits for the Business Reports "People & Labor" cards: the people
 *  colour ramp, Apex option builders (V1 look, literal colours from
 *  useChartTheme) and a few tiny render helpers. Number formatting comes
 *  from components/labor/labor-format.ts (null → "—", never 0).
 * ────────────────────────────────────────────────────────────────────────── */

export const PEOPLE = CATEGORIES.people;
export const PEOPLE_COLORS = PEOPLE.chartColors;

/** Height shared by the cards that sit in one row (turnover, overtime, trend…). */
export const ROW_CARD_HEIGHT = 340;
/** The taller row: headcount, tenure (span 2) and pay summary. */
export const TALL_ROW_HEIGHT = 420;
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

/** Room for a category name ("Shift Manager - AT") beside horizontal bars. */
const CATEGORY_LABEL_WIDTH = 130;

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
  const labelStyle = { colors: theme.label, fontSize: AXIS_FONT };
  return {
    ...base,
    chart: { ...base.chart, type: "bar" },
    plotOptions: { bar: { horizontal, borderRadius: BAR_RADIUS, barHeight: "70%", columnWidth: "55%" } },
    dataLabels: {
      enabled: true,
      formatter: (v: number) => formatValue(v),
      style: { fontSize: AXIS_FONT, colors: ["#fff"] },
    },
    // Horizontal bars put the CATEGORIES on the y axis and the values on the
    // x axis, so the number formatter has to move with them — on the y axis it
    // turned every category name into "—".
    xaxis: horizontal
      ? { ...base.xaxis, categories, labels: { style: labelStyle, formatter: (v: string) => formatValue(Number(v)) } }
      : { ...base.xaxis, categories },
    yaxis: horizontal
      ? { labels: { style: labelStyle, maxWidth: CATEGORY_LABEL_WIDTH } }
      : base.yaxis,
  };
}

/** "Oct 21" — or the raw value when it isn't an ISO date. */
export function safeDay(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return isValid(parseISO(iso)) ? fmtDay(iso) : iso;
}

/** Money that must fit a tile ("$102.8K"); "—" when there is none. */
export function fmtMoneyTile(v: number | null | undefined): string {
  return v === null || v === undefined ? DASH : fmt$Compact(v);
}

/** An employee's display name — upstream names can be null. */
export function employeeName(name: string | null | undefined, id: number | null | undefined): string {
  if (name) return name;
  return id === null || id === undefined ? "Unknown" : `Employee #${id}`;
}

/** Small muted store label used next to names in lists: always "number · name". */
export function StoreTag({ store, className }: { store: string; className?: string }) {
  const { storeName } = useReport();
  const label = storeName(store);
  return (
    <span className={cn("min-w-0 truncate text-[10px] text-muted-foreground", className)} title={label}>
      {label}
    </span>
  );
}

/* ── Active / Inactive / Both ────────────────────────────────────────────── */

export type ActiveFilter = "active" | "inactive" | "both";

const ACTIVE_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "both", label: "Both" },
];

export function matchesActive(isActive: boolean, filter: ActiveFilter): boolean {
  if (filter === "both") return true;
  return filter === "active" ? isActive : !isActive;
}

/** The status filter every employee list uses (default Active). */
export function ActiveToggle({
  value,
  onChange,
  className,
}: {
  value: ActiveFilter;
  onChange: (v: ActiveFilter) => void;
  className?: string;
}) {
  return (
    <V1Toggle<ActiveFilter>
      options={ACTIVE_OPTIONS}
      value={value}
      onChange={onChange}
      className={cn("h-8 items-stretch text-[11px] [&_button]:px-2.5", className)}
    />
  );
}

/* ── Labor % with its source ─────────────────────────────────────────────── */

/**
 * A labor % in its V1 band colour, tagged "Final" (Hiring's weekly final
 * labor: payroll ÷ royalty obligation); "—" when there is none.
 */
export function LaborPctValue({
  value,
  isFinal,
  className,
  tagClassName,
}: {
  value: number | null;
  isFinal: boolean;
  className?: string;
  tagClassName?: string;
}) {
  if (value === null) return <span className={cn("text-muted-foreground", className)}>{DASH}</span>;
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="font-semibold" style={{ color: laborColor(value) }}>
        {fmtPct(value)}
      </span>
      <span className={cn("text-[9px] font-semibold uppercase tracking-wide text-muted-foreground", tagClassName)}>
        {isFinal ? "Final" : "Est."}
      </span>
    </span>
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
