"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays } from "lucide-react";
import type { DsprChannelSales } from "@/types/dspr.types";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";
import { WtdComparisonDialog, ComparisonTable } from "./wtd-comparison-dialog";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

const CHANNEL_KEYS: { key: keyof DsprChannelSales; label: string; color: string }[] = [
  { key: "royalty_obligation", label: "In Store", color: "#FF6B35" },
  { key: "phone_sales", label: "Phone", color: "#008FFB" },
  { key: "website_sales", label: "Website", color: "#00E396" },
  { key: "mobile_sales", label: "Mobile", color: "#FEB019" },
  { key: "doordash_sales", label: "DoorDash", color: "#FF4560" },
  { key: "ubereats_sales", label: "UberEats", color: "#775DD0" },
  { key: "grubhub_sales", label: "Grubhub", color: "#546E7A" },
  { key: "call_center_sales", label: "Call Center", color: "#26a69a" },
  { key: "drive_thru_sales", label: "Drive-Thru", color: "#D10CE8" },
];

interface DailySalesByChannelChartProps {
  totalSales: DsprChannelSales;
  /** WTD totals — enables the Day/WTD toggle */
  weeklyTotalSales?: DsprChannelSales;
  height?: number;
  title?: string;
  toolbar?: boolean;
  className?: string;
}

export function DailySalesByChannelChart({
  totalSales,
  weeklyTotalSales,
  height = 310,
  title = "Daily Sales by Channel",
  toolbar = true,
  className,
}: DailySalesByChannelChartProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const activeSales = isWeekly && weeklyTotalSales ? weeklyTotalSales : totalSales;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
const { labels, series, colors } = useMemo(() => {
    const mapped = CHANNEL_KEYS.map(({ key, label, color }) => {
      const value = Number(activeSales?.[key] ?? 0);

      return {
        label,
        color,
        value: Number.isFinite(value) ? value : 0,
      };
    }).filter((entry) => entry.value > 0);

    return {
      labels: mapped.map((entry) => entry.label),
      colors: mapped.map((entry) => entry.color),
      series: mapped.map((entry) => entry.value),
    };
  }, [activeSales]);

  // Independent daily/wtd data for dialog (never depends on toggle state)
  const dailyChartData = useMemo(() => {
    const mapped = CHANNEL_KEYS.map(({ key, label, color }) => {
      const value = Number(totalSales?.[key] ?? 0);
      return { label, color, value: Number.isFinite(value) ? value : 0 };
    }).filter((e) => e.value > 0);
    return {
      labels: mapped.map((e) => e.label),
      colors: mapped.map((e) => e.color),
      series: mapped.map((e) => e.value),
    };
  }, [totalSales]);

  const wtdChartData = useMemo(() => {
    if (!weeklyTotalSales) return null;
    const mapped = CHANNEL_KEYS.map(({ key, label, color }) => {
      const value = Number(weeklyTotalSales?.[key] ?? 0);
      return { label, color, value: Number.isFinite(value) ? value : 0 };
    }).filter((e) => e.value > 0);
    return {
      labels: mapped.map((e) => e.label),
      colors: mapped.map((e) => e.color),
      series: mapped.map((e) => e.value),
    };
  }, [weeklyTotalSales]);

  const total = useMemo(() => {
    return series.reduce((sum, value) => sum + value, 0);
  }, [series]);

  const percentages = useMemo(() => {
    return series.map((value) => (total > 0 ? (value / total) * 100 : 0));
  }, [series, total]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "donut",
        height,
        toolbar: { show: toolbar },
        animations: { enabled: true },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      labels,
      colors,
      legend: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
      stroke: {
        width: 1,
        colors: [isDark ? "#27272a" : "#fff"],
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => {
          // Hide tiny slice labels to keep the chart clean
          if (value < 5) return "";

          // Keep only percentage inside slices.
          // The channel label appears in the center on hover and in the legend below.
          return `${value.toFixed(1)}%`;
        },
        style: {
          fontSize: "10px",
          fontWeight: 600,
          colors: ["#ffffff"],
        },
        dropShadow: {
          enabled: true,
          top: 1,
          left: 1,
          blur: 1,
          opacity: 0.45,
        },
      },
      plotOptions: {
        pie: {
          expandOnClick: false,
          dataLabels: {
            offset: 0,
            minAngleToShowLabel: 15,
          },
          donut: {
            size: "60%",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "10px",
                fontWeight: 500,
                color: isDark ? "#d4d4d8" : "#52525b",
                offsetY: -8,
              },
              value: {
                show: true,
                formatter: (val: any) =>
                  `$${Number(val).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}`,
                fontSize: "12px",
                fontWeight: 700,
                color: isDark ? "#f4f4f5" : "#18181b",
                offsetY: -4,
              },
              total: {
                show: true,
                label: "Total",
                fontSize: "12px",
                fontWeight: 600,
                color: isDark ? "#f4f4f5" : "#18181b",
                formatter: () =>
                  `$${series
                    .reduce((sum, value) => sum + value, 0)
                    .toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`,
              },
            },
          },
        },
      },
      noData: {
        text: "No channel sales data",
      },
    }),
    [height, toolbar, labels, colors, series, isDark]
  );

  return (
    <Card
      className={cn(
        "daily-sales-by-channel-chart group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/20 dark:to-violet-800/20",
        weeklyTotalSales && "cursor-pointer dspr-card-hover",
        className
      )}
      onClick={() => weeklyTotalSales && setDialogOpen(true)}
    >
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
            <svg
              className="h-3 w-3 text-violet-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12A9 9 0 1 1 12 3" />
              <path d="M21 3v9h-9" />
            </svg>
          </div>
          {isWeekly ? "Sales by Channel (WTD)" : title}
          {weeklyTotalSales && (
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
      </CardHeader>

      <CardContent className="px-3 pb-2">
        <div className="relative">
          <ReactApexChart
            options={options}
            series={series}
            type="donut"
            height={height}
          />


        </div>

        {/* Clean custom legend */}
        {labels.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
            {labels.map((label, index) => (
              <div
                key={label}
                className="flex items-center gap-1 text-[9px] text-muted-foreground"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[index] }}
                />
                <span>{label}</span>
                <span className="font-semibold text-foreground">
                  {`${percentages[index].toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* WTD Comparison Dialog */}
      {weeklyTotalSales && wtdChartData && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Sales by Channel Comparison"
          wide
        >
          {/* Charts row — side by side, no stacking */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {/* Today column */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Today</span>
              </div>
              <div className="rounded-xl border bg-blue-50/40 dark:bg-blue-950/20 p-2 flex items-center justify-center">
                <ReactApexChart
                  options={{
                    chart: { type: "donut", height: 290, toolbar: { show: false }, animations: { enabled: false }, fontFamily: "inherit", background: "transparent", foreColor: isDark ? "#a1a1aa" : "#71717a" },
                    theme: { mode: isDark ? "dark" : "light" },
                    labels: dailyChartData.labels,
                    colors: dailyChartData.colors,
                    legend: { show: true, position: "bottom", fontSize: "8px" },
                    tooltip: { enabled: true },
                    stroke: { width: 1, colors: [isDark ? "#27272a" : "#fff"] },
                    dataLabels: { enabled: true, formatter: (v: number) => v < 5 ? "" : `${v.toFixed(1)}%`, style: { fontSize: "10px", fontWeight: 600, colors: ["#ffffff"] } },
                    plotOptions: { pie: { expandOnClick: false, donut: { size: "60%", labels: { show: true, value: { show: true, fontSize: "12px", fontWeight: 700, formatter: (val: any) => `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}` }, total: { show: true, label: "Total", fontSize: "16px", formatter: () => `$${dailyChartData.series.reduce((s, v) => s + v, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` } } } } },
                  }}
                  series={dailyChartData.series}
                  type="donut"
                  height={290}
                  width="100%"
                />
              </div>
            </div>
            {/* WTD column */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Week-to-Date Avg</span>
              </div>
              <div className="rounded-xl border bg-primary/5 dark:bg-primary/10 p-2 flex items-center justify-center">
                <ReactApexChart
                  options={{
                    chart: { type: "donut", height: 290, toolbar: { show: false }, animations: { enabled: false }, fontFamily: "inherit", background: "transparent", foreColor: isDark ? "#a1a1aa" : "#71717a" },
                    theme: { mode: isDark ? "dark" : "light" },
                    labels: wtdChartData.labels,
                    colors: wtdChartData.colors,
                    legend: { show: true, position: "bottom", fontSize: "8px" },
                    tooltip: { enabled: true },
                    stroke: { width: 1, colors: [isDark ? "#27272a" : "#fff"] },
                    dataLabels: { enabled: true, formatter: (v: number) => v < 5 ? "" : `${v.toFixed(1)}%`, style: { fontSize: "10px", fontWeight: 600, colors: ["#ffffff"] } },
                    plotOptions: { pie: { expandOnClick: false, donut: { size: "60%", labels: { show: true, value: { show: true, fontSize: "12px", fontWeight: 700, formatter: (val: any) => `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}` }, total: { show: true, label: "Total", fontSize: "16px", formatter: () => `$${wtdChartData.series.reduce((s, v) => s + v, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` } } } } },
                  }}
                  series={wtdChartData.series}
                  type="donut"
                  height={290}
                  width="100%"
                />
              </div>
            </div>
          </div>
          <ComparisonTable
            rows={CHANNEL_KEYS.map(({ key, label }) => {
              const d = Number(totalSales?.[key] ?? 0);
              const w = Number(weeklyTotalSales?.[key] ?? 0);
              if (d === 0 && w === 0) return null;
              return {
                label,
                daily: `$${d.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                wtd: `$${w.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                dailyNum: d,
                wtdNum: w,
                higherIsBetter: true,
              };
            }).filter((r): r is NonNullable<typeof r> => r !== null)}
          />
        </WtdComparisonDialog>
      )}

      <style jsx global>{`
        .daily-sales-by-channel-chart .apexcharts-datalabel {
          fill: #ffffff !important;
        }

        .daily-sales-by-channel-chart .apexcharts-datalabel-label,
        .daily-sales-by-channel-chart .apexcharts-datalabel-value,
        .daily-sales-by-channel-chart .apexcharts-datalabel-total {
          fill: #18181b !important;
        }

        .dark .daily-sales-by-channel-chart .apexcharts-datalabel-label,
        .dark .daily-sales-by-channel-chart .apexcharts-datalabel-value,
        .dark .daily-sales-by-channel-chart .apexcharts-datalabel-total {
          fill: #f4f4f5 !important;
        }
      `}</style>
    </Card>
  );
}