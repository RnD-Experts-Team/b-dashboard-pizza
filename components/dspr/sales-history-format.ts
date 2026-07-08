import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import type {
  SalesHistoryWeek,
  SalesHistoryPeriod,
  SalesHistoryQuarter,
  SalesHistoryYear,
} from "@/types/dashboard-report.types";
import { fmtDate, fmtMonth, fmt$ } from "./wbr-format";

export type SalesHistoryGranularity = "weeks" | "periods" | "quarters" | "years";

export type SalesHistoryBucket =
  | SalesHistoryWeek
  | SalesHistoryPeriod
  | SalesHistoryQuarter
  | SalesHistoryYear;

export const GRANULARITY_OPTIONS: { key: SalesHistoryGranularity; label: string }[] = [
  { key: "weeks", label: "Week" },
  { key: "periods", label: "Period" },
  { key: "quarters", label: "Quarter" },
  { key: "years", label: "Year" },
];

/** Short x-axis / pill label for a bucket, e.g. "Mar 24", "P4 FY26", "Q2 FY26", "FY2026". */
export function bucketLabel(
  granularity: SalesHistoryGranularity,
  bucket: SalesHistoryBucket,
): string {
  switch (granularity) {
    case "weeks":
      return fmtDate((bucket as SalesHistoryWeek).week_start);
    case "periods": {
      const b = bucket as SalesHistoryPeriod;
      return `P${b.period_number} FY${String(b.fiscal_year).slice(-2)}`;
    }
    case "quarters": {
      const b = bucket as SalesHistoryQuarter;
      return `Q${b.quarter_number} FY${String(b.fiscal_year).slice(-2)}`;
    }
    case "years":
      return `FY${(bucket as SalesHistoryYear).fiscal_year}`;
  }
}

/**
 * X-axis category labels for a chart. Every bucket still gets its own column/tick
 * (no data is merged), but for "weeks" — which can span dozens of columns — a week
 * is only labeled when its start date rolls into a new calendar month, so the axis
 * reads as month markers instead of a date under every single bar. Grouping is by
 * the week's actual calendar month (not fiscal period, which doesn't line up with
 * month boundaries), so every week shown between two month labels genuinely falls
 * in that month. Other granularities are unaffected and keep their normal label.
 */
export function buildChartCategories(
  granularity: SalesHistoryGranularity,
  buckets: SalesHistoryBucket[],
): string[] {
  if (granularity !== "weeks") {
    return buckets.map((b) => bucketLabel(granularity, b));
  }
  let prevMonthKey: string | null = null;
  return buckets.map((bucket) => {
    const week = bucket as SalesHistoryWeek;
    const monthKey = week.week_start.slice(0, 7); // "YYYY-MM"
    const isNewMonth = monthKey !== prevMonthKey;
    prevMonthKey = monthKey;
    return isNewMonth ? fmtMonth(week.week_start) : "";
  });
}

/** Full date-range label for a bucket, e.g. "Mar 24 – Mar 30". */
export function bucketRangeLabel(
  granularity: SalesHistoryGranularity,
  bucket: SalesHistoryBucket,
): string {
  switch (granularity) {
    case "weeks": {
      const b = bucket as SalesHistoryWeek;
      return `${fmtDate(b.week_start)} – ${fmtDate(b.week_end)}`;
    }
    case "periods": {
      const b = bucket as SalesHistoryPeriod;
      return `${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}`;
    }
    case "quarters": {
      const b = bucket as SalesHistoryQuarter;
      return `${fmtDate(b.quarter_start)} – ${fmtDate(b.quarter_end)}`;
    }
    case "years": {
      const b = bucket as SalesHistoryYear;
      return `${fmtDate(b.year_start)} – ${fmtDate(b.year_end)}`;
    }
  }
}

/**
 * Same as bucketLabel, but weeks also carry the fiscal year (e.g. "Mar 24, 2026"
 * instead of just "Mar 24") and, optionally, the week number (weeks run Tue–Mon).
 * Used only for tooltip headers — the axis/table labels stay short since
 * periods/quarters/years already spell out "FY26" in their label.
 */
export function bucketTooltipLabel(
  granularity: SalesHistoryGranularity,
  bucket: SalesHistoryBucket,
  opts?: { showWeekNumber?: boolean },
): string {
  if (granularity === "weeks") {
    const b = bucket as SalesHistoryWeek;
    const base = `${fmtDate(b.week_start)}, ${b.fiscal_year}`;
    return opts?.showWeekNumber ? `${base} · Week ${b.week_number}` : base;
  }
  return bucketLabel(granularity, bucket);
}

/**
 * Custom tooltip renderer — ApexCharts' built-in `tooltip.theme` doesn't reliably
 * pick up dark mode in this app (same fix already used by sales-chart.tsx), so we
 * render the tooltip HTML ourselves with explicit dark/light colors.
 */
export function buildCustomTooltip(
  isDark: boolean,
  categories: string[],
  valueFormatter: (val: number, seriesName: string) => string,
  /** Optional extra row appended below the series list (e.g. a total not plotted on the chart). */
  extra?: (dataPointIndex: number) => { label: string; value: string } | null,
) {
  return ({
    dataPointIndex,
    w,
  }: {
    dataPointIndex: number;
    w: { globals: Record<string, unknown>; config: Record<string, unknown> };
  }) => {
    const globals = w.globals as Record<string, unknown>;
    const cat = categories[dataPointIndex] ?? "";
    const hiddenSet = new Set<number>([
      ...((globals.collapsedSeriesIndices as number[]) ?? []),
      ...((globals.ancillaryCollapsedSeriesIndices as number[]) ?? []),
    ]);
    const allSeries = (w.config as { series: { name: string; data: number[] }[] }).series;
    const seriesColors = globals.colors as string[];

    const bg = isDark ? "#1a1a1e" : "#fff";
    const border = isDark ? "#333" : "#e4e4e7";
    const textColor = isDark ? "#e4e4e7" : "#333";
    const mutedColor = isDark ? "#a1a1aa" : "#71717a";

    let rows = "";
    for (let i = 0; i < allSeries.length; i++) {
      if (hiddenSet.has(i)) continue;
      const val = allSeries[i].data[dataPointIndex];
      if (val == null) continue;
      const color = seriesColors[i] ?? "#888";
      const name = allSeries[i].name;
      const formatted = valueFormatter(val, name);
      rows += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="color:${mutedColor};font-size:11px">${name}:</span>
        <span style="font-weight:600;font-size:11px;color:${textColor}">${formatted}</span>
      </div>`;
    }

    const extraRow = extra?.(dataPointIndex);
    const extraHtml = extraRow
      ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px;padding-top:4px;border-top:1px solid ${border}">
          <span style="color:${mutedColor};font-size:11px">${extraRow.label}:</span>
          <span style="font-weight:700;font-size:11px;color:${textColor}">${extraRow.value}</span>
        </div>`
      : "";

    return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:8px 10px;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.12)">
      <div style="font-weight:600;font-size:11px;margin-bottom:4px;color:${textColor}">${cat}</div>
      ${rows || `<div style="font-size:11px;color:${mutedColor}">No data</div>`}
      ${extraHtml}
    </div>`;
  };
}

export type SalesHistoryMetricKey = "total_sales" | "customer_count";

export const METRIC_TABS: { key: SalesHistoryMetricKey; label: string; color: string }[] = [
  { key: "total_sales", label: "Total Sales", color: "#EAB308" },
  { key: "customer_count", label: "Customers", color: "#EAB308" },
];

/** Single-metric series for the area chart — one metric shown at a time (Total Sales OR Customers). */
export function buildMetricAreaSeries(buckets: SalesHistoryBucket[], metric: SalesHistoryMetricKey) {
  const tab = METRIC_TABS.find((m) => m.key === metric)!;
  return [{ name: tab.label, data: buckets.map((b) => b[metric]) }];
}

/**
 * Area chart for a single metric (Total Sales or Customers), axis on the left.
 * Kept separate instead of a dual-axis mixed chart — the two metrics have very
 * different scales, so plotting them together made the left/right axis pairing
 * confusing. Callers switch metrics via a tab instead. `color` is passed in
 * (rather than derived from METRIC_TABS) so other palettes — e.g. Dashboard
 * V1's category colors — can reuse this builder.
 */
export function buildMetricAreaOptions({
  categories,
  buckets,
  granularity,
  isDark,
  height,
  toolbar = false,
  metric,
  color,
  showWeekNumber = false,
}: {
  categories: string[];
  /** Used only to build the year-inclusive tooltip header — the axis keeps the short `categories` labels. */
  buckets: SalesHistoryBucket[];
  granularity: SalesHistoryGranularity;
  isDark: boolean;
  height: number;
  toolbar?: boolean;
  metric: SalesHistoryMetricKey;
  color: string;
  /** Also show the week number in the tooltip header when granularity is "weeks". */
  showWeekNumber?: boolean;
}): ApexOptions {
  const tooltipCategories = buckets.map((b) => bucketTooltipLabel(granularity, b, { showWeekNumber }));
  const axisTextColor = isDark ? "#a1a1aa" : "#71717a";
  const gridColor = isDark ? "#27272a" : "#e4e4e7";
  const axisLineColor = isDark ? "#3f3f46" : "#e4e4e7";
  const valueFormatter = (val: number) =>
    metric === "customer_count" ? val.toLocaleString() : fmt$(val);

  return {
    chart: {
      type: "area",
      height,
      toolbar: { show: toolbar },
      fontFamily: "inherit",
      background: "transparent",
      foreColor: axisTextColor,
    },
    theme: { mode: isDark ? "dark" : "light" },
    colors: [color],
    stroke: { width: 2.5, curve: "smooth" },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { fontSize: "10px", colors: axisTextColor } },
      axisBorder: { color: axisLineColor },
      axisTicks: { color: axisLineColor },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => (val == null ? "" : valueFormatter(val)),
        style: { fontSize: "10px", colors: axisTextColor },
      },
    },
    grid: { borderColor: gridColor },
    tooltip: {
      shared: true,
      intersect: false,
      custom: buildCustomTooltip(isDark, tooltipCategories, (val) => valueFormatter(val)),
    },
  };
}

export const CHANNEL_FIELDS: { key: keyof SalesHistoryWeek & string; label: string }[] = [
  { key: "phone_sales", label: "Phone" },
  { key: "website_sales", label: "Website" },
  { key: "mobile_sales", label: "Mobile" },
  { key: "doordash_sales", label: "DoorDash" },
  { key: "ubereats_sales", label: "UberEats" },
  { key: "grubhub_sales", label: "GrubHub" },
  { key: "call_center_sales", label: "Call Center" },
  { key: "drive_thru_sales", label: "Drive-Thru" },
];

export const CHANNEL_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#64748b",
];

/**
 * Shared Channel Breakdown chart state — click-to-filter legend, chart options/series,
 * and the empty-state flag (all channels hidden, so ApexCharts must not be given `[]`).
 * Used by both the compact card and the detail dialog so the click-to-filter behavior
 * and the "no channels selected" guard stay in sync.
 */
export function useChannelBreakdown(
  buckets: SalesHistoryBucket[],
  categories: string[],
  isDark: boolean,
  height: number,
  granularity: SalesHistoryGranularity,
  resetKey?: unknown,
) {
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  const tooltipCategories = useMemo(
    () => buckets.map((b) => bucketTooltipLabel(granularity, b, { showWeekNumber: true })),
    [buckets, granularity],
  );

  useEffect(() => {
    setHiddenChannels(new Set());
  }, [resetKey]);

  const toggleChannel = (key: string) => {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const legendItems = useMemo(
    () => CHANNEL_FIELDS.map((f, i) => ({ key: f.key, label: f.label, color: CHANNEL_COLORS[i] })),
    [],
  );

  const visibleFields = useMemo(
    () => CHANNEL_FIELDS.filter((f) => !hiddenChannels.has(f.key)),
    [hiddenChannels],
  );

  const visibleColors = useMemo(
    () =>
      CHANNEL_FIELDS.map((f, i) => (hiddenChannels.has(f.key) ? null : CHANNEL_COLORS[i])).filter(
        (c): c is string => c !== null,
      ),
    [hiddenChannels],
  );

  const axisTextColor = isDark ? "#a1a1aa" : "#71717a";
  const gridColor = isDark ? "#27272a" : "#e4e4e7";
  const axisLineColor = isDark ? "#3f3f46" : "#e4e4e7";

  const series = useMemo(
    () =>
      visibleFields.map((f) => ({
        name: f.label,
        type: "column" as const,
        data: buckets.map((b) => b[f.key as keyof SalesHistoryBucket] as number),
      })),
    [buckets, visibleFields],
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        height,
        stacked: false,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: axisTextColor,
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: visibleColors,
      plotOptions: { bar: { borderRadius: 2, columnWidth: "85%" } },
      stroke: { width: visibleFields.map(() => 0) },
      dataLabels: { enabled: false },
      fill: { opacity: visibleFields.map(() => 0.9) },
      xaxis: {
        categories,
        labels: { style: { fontSize: "10px", colors: axisTextColor } },
        axisBorder: { color: axisLineColor },
        axisTicks: { color: axisLineColor },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => (val == null ? "" : `$${val.toLocaleString()}`),
          style: { fontSize: "10px", colors: axisTextColor },
        },
      },
      legend: { show: false },
      grid: { borderColor: gridColor },
      tooltip: {
        shared: true,
        intersect: false,
        custom: buildCustomTooltip(isDark, tooltipCategories, (val) => fmt$(val), (dataPointIndex) => {
          const b = buckets[dataPointIndex];
          return b ? { label: "Total Sales", value: fmt$(b.total_sales) } : null;
        }),
      },
    }),
    [categories, isDark, axisTextColor, axisLineColor, gridColor, buckets, visibleFields, visibleColors, height, tooltipCategories],
  );

  return {
    options,
    series,
    legendItems,
    hiddenChannels,
    toggleChannel,
    hasVisible: visibleFields.length > 0,
  };
}
