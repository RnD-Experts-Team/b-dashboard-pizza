"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import type { HourlySalesChannel } from "@/types/dspr.types";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";
import { WtdComparisonDialog } from "./wtd-comparison-dialog";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-50 w-full" />,
});

/** Channel keys from HourlySalesChannel (everything except hour & royalty_obligation) */
const CHANNEL_KEYS: { key: keyof HourlySalesChannel; label: string; color: string }[] = [
  { key: "adjusted_royalty_obligation", label: "In Store",    color: "#F97316" },
  { key: "phone_sales",        label: "Phone",        color: "#008FFB" },
  { key: "website_sales",      label: "Website",      color: "#00E396" },
  { key: "mobile_sales",       label: "Mobile",       color: "#FEB019" },
  { key: "doordash_sales",     label: "DoorDash",     color: "#FF4560" },
  { key: "ubereats_sales",     label: "UberEats",     color: "#775DD0" },
  { key: "grubhub_sales",      label: "Grubhub",      color: "#546E7A" },
  { key: "call_center_sales",  label: "Call Center",   color: "#26a69a" },
  { key: "drive_thru_sales",   label: "Drive-Thru",    color: "#D10CE8" },
];

interface HourlyChannelsChartProps {
  hourlyData: HourlySalesChannel[];
  /** WTD avg data — enables the Day/WTD toggle */
  weeklyData?: HourlySalesChannel[];
  /** Show royalty_obligation on top as separate annotation (total per hour) */
  showRoyaltyTotal?: boolean;
  height?: number;
  title?: string;
  /** Horizontal or vertical bars */
  horizontal?: boolean;
  /** Custom channel colors override (match channel count) */
  colors?: string[];
  toolbar?: boolean;
  animations?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
  dataLabels?: boolean;
  currencyPrefix?: string;
  className?: string;
}

export function HourlyChannelsChart({
  hourlyData,
  weeklyData,
  showRoyaltyTotal = true,
  height = 400,
  title = "Hourly Sales by Channel",
  horizontal = false,
  colors,
  toolbar = true,
  animations = true,
  legendPosition = "top",
  dataLabels = false,
  currencyPrefix = "$",
  className,
}: HourlyChannelsChartProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const activeData = isWeekly && weeklyData ? weeklyData : hourlyData;
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = useCallback((label: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

 const { series, categories, channelHasData } = useMemo(() => {
  // Sort by hour
  const sorted = [...activeData].sort((a, b) => a.hour - b.hour);

  // Categories = formatted hours
  const cats = sorted.map((h) => {
    const hour = h.hour;
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  });

  const hasUsableValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return false;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue !== 0;
  };

  // Tracks whether each channel has at least one non-zero value
  const hasDataByChannel = CHANNEL_KEYS.reduce<Record<string, boolean>>(
    (acc, { key, label }) => {
      acc[label] = sorted.some((h) => hasUsableValue(h[key]));
      return acc;
    },
    {}
  );

  // Build one series per channel
  const s = CHANNEL_KEYS.map(({ key, label }) => ({
    name: label,
    data: sorted.map((h) => Number(h[key]) || 0),
  }));

  return {
    series: s,
    categories: cats,
    channelHasData: hasDataByChannel,
  };
}, [activeData]);

  // Hourly totals for comparison table (dialog only — never depends on toggle)
  const hourlyComparisonRows = useMemo(() => {
    const allHours = Array.from(
      new Set([
        ...hourlyData.map((h) => h.hour),
        ...(weeklyData ?? []).map((h) => h.hour),
      ])
    ).sort((a, b) => a - b);

    const dailyByHour = new Map(hourlyData.map((h) => [h.hour, h]));
    const wtdByHour = new Map((weeklyData ?? []).map((h) => [h.hour, h]));

    const formatHour = (h: number) => {
      if (h === 0) return "12 AM";
      if (h < 12) return `${h} AM`;
      if (h === 12) return "12 PM";
      return `${h - 12} PM`;
    };

    return allHours.map((hour) => {
      const d = dailyByHour.get(hour);
      const w = wtdByHour.get(hour);
      const dailyTotal = d
        ? CHANNEL_KEYS.reduce((s, { key }) => s + (Number(d[key]) || 0), 0)
        : 0;
      const wtdTotal = w
        ? CHANNEL_KEYS.reduce((s, { key }) => s + (Number(w[key]) || 0), 0)
        : 0;
      return { hour, label: formatHour(hour), dailyTotal, wtdTotal };
    });
  }, [hourlyData, weeklyData]);

  // Only pass visible series + matching colors to the chart
  const visibleKeys = CHANNEL_KEYS.filter((c) => !hiddenSeries.has(c.label));
  const visibleSeriesData = series.filter((s) => !hiddenSeries.has(s.name));
  const channelColors = visibleKeys.map((c, i) => (colors ? colors[i] : c.color));

  // ApexCharts crashes with an empty series/colors array — guard against it
  const allHidden = visibleSeriesData.length === 0;

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        height,
        stacked: true,
        toolbar: { show: toolbar },
        animations: { enabled: animations },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: channelColors.length > 0 ? channelColors : ["#94a3b8"],
      plotOptions: {
        bar: {
          horizontal,
          borderRadius: 2,
          dataLabels: {
            total: {
              enabled: dataLabels,
              offsetX: 0,
              style: {
                fontSize: "11px",
                fontWeight: 700,
                color: isDark ? "#d4d4d8" : "#3f3f46",
              },
              formatter: (val: string) => `${currencyPrefix}${parseFloat(val).toFixed(0)}`,
            },
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 1, colors: [isDark ? "#27272a" : "#fff"] },
      xaxis: {
        categories,
        labels: {
          style: { fontSize: "9px", colors: isDark ? "#a1a1aa" : "#71717a" },
          rotate: -45,
          rotateAlways: false,
        },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks: { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (val: number) => `${currencyPrefix}${val.toFixed(0)}`,
          style: { fontSize: "9px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        y: {
          formatter: (val: number) =>
            `${currencyPrefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
      legend: {
        show: false,
        position: legendPosition,
        horizontalAlign: "left",
        fontSize: "10px",
        labels: { colors: isDark ? "#a1a1aa" : "#71717a" },
      },
      fill: { opacity: 1 },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
    }),
    [
      height,
      toolbar,
      animations,
      channelColors,
      horizontal,
      dataLabels,
      currencyPrefix,
      categories,
      showRoyaltyTotal,
      legendPosition,
      isDark,
    ]
  );

  const activeTitle = isWeekly ? "Hourly Avg by Channel (WTD)" : title;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/20 dark:to-violet-800/20", weeklyData && "cursor-pointer", className)} onClick={() => weeklyData && setDialogOpen(true)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
            <svg className="h-3 w-3 text-violet-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 16V8l4 4 4-4v8"/></svg>
          </div>
          {activeTitle}
          {weeklyData && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-5 w-5 ms-auto rounded", isWeekly ? "bg-primary/15 text-primary" : "text-muted-foreground/40")}
                  onClick={(e) => { e.stopPropagation(); setIsWeekly((v) => !v); }}
                >
                  <CalendarDays className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isWeekly ? "Switch to Daily" : "Switch to Week-to-Date"}</TooltipContent>
            </Tooltip>
          )}
        </CardTitle>

        {/* Legend toggle buttons */}
        <div className="flex flex-wrap gap-0 pt-1" onClick={(e) => e.stopPropagation()}>
          {CHANNEL_KEYS.map(({ label, color }) => {
            const isHidden = hiddenSeries.has(label);
            return (
              <button
                key={label}
                onClick={() => toggleSeries(label)}
                className={cn(
                  "flex items-center gap-1 rounded-full border-none px-1 py-0.5 text-[9px] font-medium transition-all",
                  isHidden
                    ? "border-dashed border-muted-foreground/30 text-muted-foreground opacity-40"
                    : "opacity-100"
                )}
                style={isHidden ? undefined : { borderColor: color, color }}
              >
                {channelHasData[label] ? (
  <span
    className="inline-block h-2 w-2 shrink-0 rounded-full"
    style={{ backgroundColor: isHidden ? "#71717a" : color }}
  />
) : (
  <span
    title={`No data for ${label}`}
    className="text-[10px] leading-none text-red-500"
  >
    !
  </span>
)}

{label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {allHidden ? (
          <div
            className="flex items-center justify-center text-[11px] text-muted-foreground"
            style={{ height }}
          >
            No channels selected
          </div>
        ) : (
          <ReactApexChart
            options={options}
            series={visibleSeriesData}
            type="bar"
            height={height}
          />
        )}
      </CardContent>

      {/* WTD Comparison Dialog */}
      {weeklyData && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Hourly Sales by Channel Comparison"
        >
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hour</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Today</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-primary uppercase tracking-wider">WTD Avg</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
                </tr>
              </thead>
              <tbody>
                {hourlyComparisonRows.map((row, i) => {
                  const diff = row.dailyTotal - row.wtdTotal;
                  const direction =
                    Math.abs(diff) < 0.01 ? "same" : diff > 0 ? "up" : "down";
                  const pct =
                    row.wtdTotal !== 0
                      ? `${diff >= 0 ? "+" : ""}${((diff / Math.abs(row.wtdTotal)) * 100).toFixed(1)}%`
                      : null;
                  return (
                    <tr
                      key={row.hour}
                      className={cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/30",
                        i % 2 === 1 && "bg-muted/20",
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-mono text-blue-700 dark:text-blue-300">
                        ${row.dailyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-mono text-foreground">
                        ${row.wtdTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {direction !== "same" && pct && (
                          <span
                            className={cn(
                              "inline-flex items-center justify-end gap-0.5 text-[10px] font-semibold",
                              diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
                            )}
                          >
                            {diff > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {pct}
                          </span>
                        )}
                        {direction === "same" && (
                          <span className="text-[10px] text-muted-foreground">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WtdComparisonDialog>
      )}
    </Card>
  );
}
