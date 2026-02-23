"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { HourlySalesChannel } from "@/types/dspr.types";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-50 w-full" />,
});

/** Channel keys from HourlySalesChannel (everything except hour & royalty_obligation) */
const CHANNEL_KEYS: { key: keyof HourlySalesChannel; label: string; color: string }[] = [
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
  /** Show royalty_obligation on top as separate annotation (total per hour) */
  showRoyaltyTotal?: boolean;
  height?: number;
  title?: string;
  /** Horizontal or vertical bars */
  horizontal?: boolean;
  /** Custom channel colors override (8 colors) */
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { series, categories } = useMemo(() => {
    // Sort by hour
    const sorted = [...hourlyData].sort((a, b) => a.hour - b.hour);

    // Categories = formatted hours ("10 AM", "11 AM", ... "11 PM")
    const cats = sorted.map((h) => {
      const hour = h.hour;
      if (hour === 0) return "12 AM";
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return "12 PM";
      return `${hour - 12} PM`;
    });

    // Build one series per channel
    const s = CHANNEL_KEYS.map(({ key, label }) => ({
      name: label,
      data: sorted.map((h) => parseFloat(String(h[key])) || 0),
    }));

    // Royalty obligation totals per hour (for tooltip)
    const royalty = sorted.map((h) => parseFloat(h.royalty_obligation) || 0);

    return { series: s, categories: cats, royaltyTotals: royalty };
  }, [hourlyData]);

  const channelColors = colors || CHANNEL_KEYS.map((c) => c.color);

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
      colors: channelColors,
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
      legendPosition,
      isDark,
    ]
  );

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
            <svg className="h-3 w-3 text-violet-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 16V8l4 4 4-4v8"/></svg>
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ReactApexChart
          options={options}
          series={series}
          type="bar"
          height={height}
        />
      </CardContent>
    </Card>
  );
}
