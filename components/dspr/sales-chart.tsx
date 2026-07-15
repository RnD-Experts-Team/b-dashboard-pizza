"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DsprSales } from "@/types/dspr.types";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";
import { WtdComparisonDialog } from "./wtd-comparison-dialog";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function laborColor(v: number): string {
  if (v <= 10) return "#EF4444";
  if (v <= 15) return "#EAB308";
  if (v <= 19) return "#F97316";
  if (v <= 24) return "#22C55E";
  if (v <= 29) return "#F97316";
  if (v <= 39) return "#EAB308";
  return "#EF4444";
}

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-50 w-full" />,
});

/** Day-name labels for the x-axis (Tue → Mon) */
const DAY_NAMES = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

interface SalesChartProps {
  sales: DsprSales;
  /** Show/hide individual series – default all visible */
  showThisWeek?: boolean;
  showPreviousWeek?: boolean;
  showLastYear?: boolean;
  /** Chart height in px */
  height?: number;
  /** Card title override */
  title?: string;
  /** Enable/disable data labels */
  dataLabels?: boolean;
  /** Column border-radius */
  columnBorderRadius?: number;
  /** Column width percentage */
  columnWidth?: string;
  /** Line stroke width */
  lineStrokeWidth?: number;
  /** Custom colors [thisWeek, prevWeek, lastYear] */
  colors?: [string, string, string];
  /** Enable/disable chart toolbar (download, zoom, etc.) */
  toolbar?: boolean;
  /** Enable/disable chart animations */
  animations?: boolean;
  /** Legend position */
  legendPosition?: "top" | "bottom" | "left" | "right";
  /** Legend horizontal align */
  legendAlign?: "left" | "center" | "right";
  /** Enable/disable tooltip */
  tooltip?: boolean;
  /** Currency prefix for values (default "$") */
  currencyPrefix?: string;
  /** Grid show/hide */
  grid?: boolean;
  /** Daily labor % keyed by date string, from labor_week_to_date_by_day */
  laborWeekToDateByDay?: Record<string, { value: number; percent: number }>;
  className?: string;
}

export function SalesChart({
  sales,
  showThisWeek = true,
  showPreviousWeek = true,
  showLastYear = true,
  height = 350,
  title = "Weekly Sales Comparison",
  dataLabels = false,
  columnBorderRadius = 4,
  columnWidth = "50%",
  lineStrokeWidth = 4,
  colors = ["#008FFB", "#00E396", "#FEB019"],
  toolbar = true,
  animations = true,
  legendPosition = "top",
  legendAlign = "left",
  tooltip = true,
  currencyPrefix = "$",
  grid = true,
  laborWeekToDateByDay,
  className,
}: SalesChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Weekly totals (from API or summed from daily data) ─────────────
  const thisWeekTotal = useMemo(
    () => sales.this_week_total ?? Object.values(sales.this_week_by_day).reduce((s, v) => s + v, 0),
    [sales]
  );
  const prevWeekTotal = useMemo(
    () => sales.previous_week_total ?? Object.values(sales.previous_week_by_day).reduce((s, v) => s + v, 0),
    [sales]
  );
  const lastYearTotal = useMemo(
    () => sales.same_week_last_year_total ?? Object.values(sales.same_week_last_year_by_day).reduce((s, v) => s + v, 0),
    [sales]
  );

  // ── Day-by-day rows for the dialog table ───────────────────────────
  const weekRows = useMemo(() => {
    const twDates = Object.keys(sales.this_week_by_day);
    const pwDates = Object.keys(sales.previous_week_by_day);
    const lyDates = Object.keys(sales.same_week_last_year_by_day);
    const maxLen = Math.max(twDates.length, pwDates.length, lyDates.length);
    const fmtDate = (d?: string) => {
      if (!d) return "—";
      const parts = d.split("-");
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    };
    return Array.from({ length: maxLen }, (_, i) => {
      const twDate = twDates[i];
      const pwDate = pwDates[i];
      const lyDate = lyDates[i];
      return {
        dayName: DAY_NAMES[i] ?? `Day ${i + 1}`,
        twDate: twDate ?? null,
        twDateLabel: fmtDate(twDate),
        pwDateLabel: fmtDate(pwDate),
        lyDateLabel: fmtDate(lyDate),
        twVal: twDate != null ? (sales.this_week_by_day[twDate] ?? 0) : 0,
        pwVal: pwDate != null ? (sales.previous_week_by_day[pwDate] ?? 0) : 0,
        lyVal: lyDate != null ? (sales.same_week_last_year_by_day[lyDate] ?? 0) : 0,
      };
    });
  }, [sales]);
  const { series, categories } = useMemo(() => {
    const thisWeekValues = Object.values(sales.this_week_by_day);
    const prevWeekValues = Object.values(sales.previous_week_by_day);
    const lastYearValues = Object.values(sales.same_week_last_year_by_day);

    // Build categories from actual day names (use index → DAY_NAMES)
    const cats = thisWeekValues.map((_, i) => DAY_NAMES[i] || `Day ${i + 1}`);

    const s: { name: string; type: "column" | "line"; data: number[] }[] = [];
    if (showThisWeek) {
      s.push({ name: "This Week", type: "column", data: thisWeekValues });
    }
    if (showPreviousWeek) {
      s.push({ name: "Previous Week", type: "column", data: prevWeekValues });
    }
    if (showLastYear) {
      s.push({ name: "Same Week Last Year", type: "line", data: lastYearValues });
    }

    return { series: s, categories: cats };
  }, [sales, showThisWeek, showPreviousWeek, showLastYear]);

  /** Map active series to their colours */
  const activeColors = useMemo(() => {
    const c: string[] = [];
    if (showThisWeek) c.push(colors[0]);
    if (showPreviousWeek) c.push(colors[1]);
    if (showLastYear) c.push(colors[2]);
    return c;
  }, [showThisWeek, showPreviousWeek, showLastYear, colors]);

  /** Build stroke widths per series (columns get 0, line gets user width) */
  const strokeWidths = useMemo(() => {
    const w: number[] = [];
    if (showThisWeek) w.push(0);
    if (showPreviousWeek) w.push(0);
    if (showLastYear) w.push(lineStrokeWidth);
    return w;
  }, [showThisWeek, showPreviousWeek, showLastYear, lineStrokeWidth]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        height,
        stacked: false,
        toolbar: { show: toolbar },
        animations: { enabled: animations },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: activeColors,
      plotOptions: {
        bar: {
          borderRadius: columnBorderRadius,
          columnWidth,
        },
      },
      dataLabels: { enabled: dataLabels },
      stroke: { width: strokeWidths, curve: "smooth" },
      xaxis: {
        categories,
        labels: {
          style: { fontSize: "10px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks: { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => val == null ? "" : `${currencyPrefix}${val.toLocaleString()}`,
          style: { fontSize: "10px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
        title: { text: "Sales", style: { color: isDark ? "#a1a1aa" : "#71717a" } },
      },
      tooltip: {
        enabled: tooltip,
        shared: true,
        intersect: false,
        // Custom tooltip to fix ApexCharts mixed-chart legend-toggle bug
        // where hiding the line series breaks the shared tooltip for columns
        custom: ({ dataPointIndex, w }: { series: number[][]; dataPointIndex: number; w: Record<string, Record<string, unknown[]>> }) => {
          const globals = w.globals as Record<string, unknown[]>;
          const cat = (globals.categoryLabels as string[])?.[dataPointIndex] ?? categories[dataPointIndex] ?? "";
          const hiddenSet = new Set<number>([
            ...((globals.collapsedSeriesIndices as number[]) ?? []),
            ...((globals.ancillaryCollapsedSeriesIndices as number[]) ?? []),
          ]);
          const allSeries = (w.config as Record<string, { name: string; data: number[] }[]>).series;
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
            const formatted = `${currencyPrefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            rows += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <span style="color:${mutedColor};font-size:11px">${name}:</span>
              <span style="font-weight:600;font-size:11px;color:${textColor}">${formatted}</span>
            </div>`;
          }

          return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:8px 10px;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.12)">
            <div style="font-weight:600;font-size:11px;margin-bottom:4px;color:${textColor}">${cat}</div>
            ${rows || `<div style="font-size:11px;color:${mutedColor}">No data</div>`}
          </div>`;
        },
      },
      legend: {
        position: legendPosition,
        horizontalAlign: legendAlign,
        offsetX: 0,
        fontSize: "10px",
        labels: { colors: isDark ? "#a1a1aa" : "#71717a" },
      },
      grid: {
        show: grid,
        borderColor: isDark ? "#27272a" : "#e4e4e7",
      },
      fill: { opacity: [0.85, 0.85, 1] },
    }),
    [
      height,
      toolbar,
      animations,
      activeColors,
      columnBorderRadius,
      columnWidth,
      dataLabels,
      strokeWidths,
      categories,
      currencyPrefix,
      tooltip,
      legendPosition,
      legendAlign,
      grid,
      isDark,
    ]
  );

  if (series.length === 0) return null;

  const fmt = (v: number) =>
    `${currencyPrefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pctDiff = (a: number, b: number) => {
    if (b === 0) return null;
    return ((a - b) / b) * 100;
  };

  return (
    <Card
      className={cn(
        "group hover:shadow-md transition-shadow py-1.5 gap-0 justify-between cursor-pointer dspr-card-hover bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/20 dark:to-violet-800/20",
        className
      )}
      onClick={() => setDialogOpen(true)}
    >
        <CardHeader className="pb-0 px-3">
          <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
            <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
              <svg className="h-3 w-3 text-violet-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-0 cursor-default border-t-3 border-border/40" onClick={(e) => e.stopPropagation()}>
          <ReactApexChart
            options={options}
            series={series}
            type="line"
            height={height}
          />
        </CardContent>
      {/* ── Comparison Dialog ──────────────────────────────────────── */}
      <WtdComparisonDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Weekly Sales Comparison"
          badgeText="3-Week Breakdown"
          wide
        >
          {/* Weekly Totals Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {(
              [
                { label: "This Week", value: thisWeekTotal, color: "#008FFB", compare: prevWeekTotal },
                { label: "Previous Week", value: prevWeekTotal, color: "#00E396", compare: null },
                { label: "Same Week Last Year", value: lastYearTotal, color: "#FEB019", compare: null },
              ] as { label: string; value: number; color: string; compare: number | null }[]
            ).map(({ label, value, color, compare }) => {
              const diff = compare != null ? pctDiff(thisWeekTotal, compare) : null;
              return (
                <div
                  key={label}
                  className="rounded-lg p-3 text-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <p className="text-[10px] font-medium mb-1" style={{ color }}>
                    {label}
                  </p>
                  <p className="text-lg font-bold tabular-nums" style={{ color }}>
                    {fmt(value)}
                  </p>
                  {diff != null && (
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {diff > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : diff < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      ) : (
                        <Minus className="h-3 w-3 text-zinc-400" />
                      )}
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-zinc-400"
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}% vs prev week
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day-by-day table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-400">Day</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: "#008FFB" }}>This Week</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: "#00E396" }}>Previous Week</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-500">vs Prev</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: "#FEB019" }}>Same Week LY</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-500">vs LY</th>
                  {laborWeekToDateByDay && <th className="px-3 py-2 text-right font-semibold text-zinc-500">Labor %</th>}
                </tr>
              </thead>
              <tbody>
                {weekRows.map((row, idx) => {
                  const vsPrev = pctDiff(row.twVal, row.pwVal);
                  const vsLY = pctDiff(row.twVal, row.lyVal);
                  const renderPct = (v: number | null) => {
                    if (v == null) return <span className="text-zinc-400">—</span>;
                    const isPos = v > 0;
                    const isNeg = v < 0;
                    return (
                      <span className={cn("font-medium", isPos ? "text-emerald-500" : isNeg ? "text-red-500" : "text-zinc-400")}>
                        {isPos ? "+" : ""}{v.toFixed(1)}%
                      </span>
                    );
                  };
                  return (
                    <tr
                      key={idx}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                        <span className="font-semibold">{row.dayName}</span>
                        <span className="ml-1.5 text-[10px] text-zinc-400">{row.twDateLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: "#008FFB" }}>
                        {row.twVal > 0 ? fmt(row.twVal) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#00E396" }}>
                        {row.pwVal > 0 ? fmt(row.pwVal) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{renderPct(vsPrev)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#FEB019" }}>
                        {row.lyVal > 0 ? fmt(row.lyVal) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{renderPct(vsLY)}</td>
                      {laborWeekToDateByDay && (() => {
                        const entry = row.twDate ? laborWeekToDateByDay[row.twDate] : undefined;
                        if (!entry || entry.percent === 0) {
                          return <td className="px-3 py-2 text-right tabular-nums text-zinc-300 dark:text-zinc-600">—</td>;
                        }
                        const color = laborColor(entry.percent);
                        return (
                          <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color }}>
                            {entry.percent.toFixed(1)}%
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-t-2 border-zinc-300 dark:border-zinc-600 font-bold">
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#008FFB" }}>
                    {fmt(thisWeekTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#00E396" }}>
                    {fmt(prevWeekTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(() => {
                      const d = pctDiff(thisWeekTotal, prevWeekTotal);
                      if (d == null) return <span className="text-zinc-400">—</span>;
                      return (
                        <span className={cn("font-bold", d > 0 ? "text-emerald-500" : d < 0 ? "text-red-500" : "text-zinc-400")}>
                          {d > 0 ? "+" : ""}{d.toFixed(1)}%
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#FEB019" }}>
                    {fmt(lastYearTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(() => {
                      const d = pctDiff(thisWeekTotal, lastYearTotal);
                      if (d == null) return <span className="text-zinc-400">—</span>;
                      return (
                        <span className={cn("font-bold", d > 0 ? "text-emerald-500" : d < 0 ? "text-red-500" : "text-zinc-400")}>
                          {d > 0 ? "+" : ""}{d.toFixed(1)}%
                        </span>
                      );
                    })()}
                  </td>
                  {laborWeekToDateByDay && (() => {
                    const entries = Object.values(laborWeekToDateByDay).filter(e => e.percent > 0);
                    if (entries.length === 0) return <td className="px-3 py-2 text-right tabular-nums text-zinc-400">—</td>;
                    const avg = entries.reduce((s, e) => s + e.percent, 0) / entries.length;
                    const color = laborColor(avg);
                    return (
                      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color }}>
                        {avg.toFixed(1)}%
                      </td>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
      </WtdComparisonDialog>
    </Card>
  );
}
