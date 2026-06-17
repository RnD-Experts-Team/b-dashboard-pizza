"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import type { HourlySalesChannel } from "@/types/dspr.types";
import { Skeleton } from "@/components/ui/skeleton";
import { V1Card } from "../v1-card";
import { V1Toggle } from "../v1-ui";
import { CATEGORIES } from "../category";
import { fmt$ } from "@/components/dspr/wbr-format";
import { CHANNELS, num } from "./channels";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full" />,
});

function hourLabel(h: number): string {
  const ampm = h >= 12 ? "p" : "a";
  const h12 = h % 12 || 12;
  return `${h12}${ampm}`;
}

const totalForHour = (row: HourlySalesChannel): number =>
  CHANNELS.reduce((s, c) => s + num(row[c.key as keyof HourlySalesChannel] as number | string), 0);

/* Fresh hourly view: a smooth area line of total sales per hour in the Sales
 * (emerald) palette, replacing the stacked multi-hue bars. */
export function V1HourlyChannelsCard({
  hourly,
  weekly,
  span,
  className,
}: {
  hourly: HourlySalesChannel[];
  weekly?: HourlySalesChannel[];
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const hasWeekly = Boolean(weekly && weekly.length);
  const [view, setView] = useState<"day" | "wtd">("day");
  const colors = CATEGORIES.sales.chartColors;

  const rows = useMemo(() => {
    const src = view === "wtd" && weekly ? weekly : hourly;
    return [...src].sort((a, b) => a.hour - b.hour);
  }, [view, weekly, hourly]);

  const series = useMemo(
    () => [{ name: view === "wtd" ? "WTD Avg Sales" : "Sales", data: rows.map(totalForHour) }],
    [rows, view],
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "area", toolbar: { show: false }, fontFamily: "inherit", background: "transparent", foreColor: isDark ? "#a1a1aa" : "#71717a" },
      theme: { mode: isDark ? "dark" : "light" },
      colors: [colors[0]],
      dataLabels: { enabled: false },
      stroke: { width: 2.5, curve: "smooth" },
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
      xaxis: { categories: rows.map((r) => hourLabel(r.hour)), labels: { style: { fontSize: "9px" }, rotate: 0, hideOverlappingLabels: true } },
      yaxis: { labels: { formatter: (v: number) => (v == null ? "" : `$${(v / 1000).toFixed(1)}k`), style: { fontSize: "10px" } } },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      tooltip: { y: { formatter: (v: number) => fmt$(v) } },
    }),
    [isDark, colors, rows],
  );

  return (
    <V1Card
      title="Hourly Sales"
      category="sales"
      period={hasWeekly ? "D·WTD" : "D"}
      span={span}
      className={className}
      bodyClassName="overflow-hidden"
      headerControl={
        hasWeekly ? (
          <V1Toggle
            className="ms-1"
            options={[
              { value: "day", label: "Day" },
              { value: "wtd", label: "WTD" },
            ]}
            value={view}
            onChange={setView}
          />
        ) : undefined
      }
    >
      <ReactApexChart options={options} series={series} type="area" height={200} />
    </V1Card>
  );
}
