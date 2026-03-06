"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DsprChannelSales } from "@/types/dspr.types";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

const CHANNEL_KEYS: { key: keyof DsprChannelSales; label: string; color: string }[] = [
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
  height?: number;
  title?: string;
  toolbar?: boolean;
  className?: string;
}

export function DailySalesByChannelChart({
  totalSales,
  height = 300,
  title = "Daily Sales by Channel",
  toolbar = true,
  className,
}: DailySalesByChannelChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { labels, series, colors } = useMemo(() => {
    const mapped = CHANNEL_KEYS.map(({ key, label, color }) => {
      const value = Number(totalSales?.[key] ?? 0);
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
  }, [totalSales]);

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
        position: "bottom",
        horizontalAlign: "left",
        fontSize: "8px",
        labels: { colors: isDark ? "#a1a1aa" : "#71717a" },
      },
      // Disable hover tooltip per UX request
      tooltip: {
        enabled: false,
      },
      stroke: {
        width: 1,
        colors: [isDark ? "#27272a" : "#fff"],
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => `${value.toFixed(1)}%`,
        style: {
          fontSize: "10px",
          fontWeight: 400,
        },
      },
      plotOptions: {
        pie: {
            donut: {
              size: "58%",
              labels: {
                show: true,
                name: {
                  show: true,
                  fontSize: "7px",
                  color: isDark ? "#d4d4d8" : "#52525b",
                },
                value: {
                  show: true,
                  formatter: (val: any) =>
                    `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                  fontSize: "12px",
                  color: isDark ? "#f4f4f5" : "#18181b",
                },
                total: {
                  show: true,
                  label: "Total",
                  fontSize: "12px",
                  color: isDark ? "#f4f4f5" : "#18181b",
                  formatter: () =>
                    `$${series
                      .reduce((sum, value) => sum + value, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
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
    <Card className={cn("daily-sales-by-channel-chart group hover:shadow-md transition-shadow py-1.5 gap-0  bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/20 dark:to-violet-800/20", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
            <svg className="h-3 w-3 text-violet-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12A9 9 0 1 1 12 3"/><path d="M21 3v9h-9"/></svg>
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-0">
        <ReactApexChart options={options} series={series} type="donut" height={height} />
      </CardContent>
      <style jsx global>{`
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
