"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { HourGrid } from "@/lib/screen-usage/aggregate";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});

interface HoursHeatmapProps {
  present: HourGrid;
  away: HourGrid;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Weekday × hour grid (viewer's local time): minutes present, or minutes away. */
export function HoursHeatmap({ present, away }: HoursHeatmapProps) {
  const t = useTranslations("screenMonitoring");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mode, setMode] = useState<"present" | "away">("present");

  const grid = mode === "present" ? present : away;
  const color = mode === "present" ? "#10b981" : "#f59e0b";

  // ApexCharts draws the first series at the bottom — reverse so Monday is on top.
  const series = useMemo(
    () =>
      DAY_KEYS.map((key, day) => ({
        name: t(`days.${key}`),
        data: grid[day].map((minutes, hour) => ({
          x: String(hour).padStart(2, "0"),
          y: Math.round(minutes),
        })),
      })).reverse(),
    [grid, t],
  );

  const options: ApexOptions = {
    chart: { type: "heatmap", toolbar: { show: false }, foreColor: isDark ? "#a1a1aa" : "#52525b" },
    dataLabels: { enabled: false },
    colors: [color],
    plotOptions: { heatmap: { shadeIntensity: 0.6, radius: 2, enableShades: true } },
    stroke: { width: 1, colors: [isDark ? "#18181b" : "#ffffff"] },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: { formatter: (v: number) => t("minutes", { count: v }) },
    },
    xaxis: { title: { text: t("hourOfDay") } },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={mode === "present" ? "default" : "outline"} onClick={() => setMode("present")}>
          {t("heatmapPresent")}
        </Button>
        <Button size="sm" variant={mode === "away" ? "default" : "outline"} onClick={() => setMode("away")}>
          {t("heatmapAway")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("heatmapHint")}</span>
      </div>
      <ReactApexChart type="heatmap" height={320} series={series} options={options} />
    </div>
  );
}
