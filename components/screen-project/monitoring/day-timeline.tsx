"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, type TimelineBar, type TimelineLane, type TimelineState } from "@/lib/screen-usage/aggregate";
import type { UsageStation } from "@/lib/screen-usage/types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

interface DayTimelineProps {
  bars: TimelineBar[];
  kicks: number[];
  stations: UsageStation[];
  dayStart: number;
  dayEnd: number;
}

const LANES: TimelineLane[] = ["session", "main", "camera", "mic", "talkAll"];

const STATE_COLORS: Record<TimelineState, string> = {
  page: "#0ea5e9",
  pip: "#8b5cf6",
  main: "#6366f1",
  visible: "#10b981",
  noFace: "#94a3b8",
  covered: "#f59e0b",
  open: "#22c55e",
  dead: "#ef4444",
  talkAll: "#ec4899",
};

/** One manager, one day (viewer's local time): every lane minute by minute. */
export function DayTimeline({ bars, kicks, stations, dayStart, dayEnd }: DayTimelineProps) {
  const t = useTranslations("screenMonitoring");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const stationName = (id: number | null) =>
    id === null ? "" : (stations.find((s) => s.id === id)?.name ?? `#${id}`);

  // One series per state so the legend explains the colours.
  const series = useMemo(() => {
    const states = [...new Set(bars.map((b) => b.state))];
    return states.map((state) => ({
      name: t(`states.${state}`),
      color: STATE_COLORS[state],
      data: bars
        .filter((b) => b.state === state)
        .map((b) => ({
          x: t(`lanes.${b.lane}`),
          y: [b.start, b.end],
          meta: { station: stationName(b.stationId), talking: b.talkingSeconds },
        })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, t, stations]);

  const options: ApexOptions = {
    chart: { type: "rangeBar", toolbar: { show: true }, zoom: { enabled: true }, foreColor: isDark ? "#a1a1aa" : "#52525b" },
    plotOptions: { bar: { horizontal: true, barHeight: "60%", rangeBarGroupRows: true } },
    xaxis: {
      type: "datetime",
      min: dayStart,
      max: dayEnd,
      labels: { datetimeUTC: false, format: "HH:mm" },
    },
    yaxis: { categories: LANES.map((l) => t(`lanes.${l}`)) } as ApexOptions["yaxis"],
    legend: { position: "top" },
    grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
    annotations: {
      xaxis: kicks.map((x) => ({
        x,
        borderColor: "#ef4444",
        label: { text: t("kicked"), style: { background: "#ef4444", color: "#fff" } },
      })),
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const point = w.config.series[seriesIndex].data[dataPointIndex];
        const [start, end] = point.y as [number, number];
        const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const extra = [
          point.meta.station,
          point.meta.talking > 0 ? t("talkingFor", { duration: formatDuration(point.meta.talking * 1000) }) : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const div = document.createElement("div");
        div.className = "px-2 py-1 text-xs";
        div.textContent = `${w.config.series[seriesIndex].name}: ${time(start)} – ${time(end)} (${formatDuration(end - start)})${extra ? ` · ${extra}` : ""}`;
        return div.outerHTML;
      },
    },
  };

  return <ReactApexChart type="rangeBar" height={300} series={series} options={options} />;
}
