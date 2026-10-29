"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/utils/date-display";
import { CHART_INK, USAGE_COLORS, formatDuration, percent, toHours } from "@/lib/screen-usage/format";
import type { UsageDayRow } from "@/lib/screen-usage/types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

/** What the charts' shares are out of: the stores' open hours (the headline) or the time connected. */
export type ChartBasis = "open" | "connected";

/** A small two-or-more-way switch, the look the heatmap's present/away switch set. */
export function SegmentedToggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const HOUR_S = 3600;

/**
 * Present + away stack to "on Screen Project"; talking is a line on the same hours axis.
 * With `openByDay` (seconds open per day) the stack runs up to the open hours: the rest is "not
 * connected", and every share in the tooltip is of that day's open hours instead of its connected time.
 */
export function DailyPresenceChart({ days, openByDay }: { days: UsageDayRow[]; openByDay: Record<string, number> | null }) {
  const t = useTranslations("screenMonitoring");

  const { series, options } = useMemo(() => {
    const categories = days.map((d) => formatDateOnly(d.date, days.length > 14 ? "MMM d" : "EEE d"));
    const base = (i: number) => (openByDay ? (openByDay[days[i].date] ?? 0) : days[i].on_screen);
    const gap = openByDay
      ? [{ name: t("legend.notConnected"), type: "bar", data: days.map((d) => toHours(Math.max(0, (openByDay[d.date] ?? 0) - d.on_screen))) }]
      : [];
    const opts: ApexOptions = {
      chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit", animations: { enabled: false } },
      colors: [USAGE_COLORS.good, USAGE_COLORS.attention, ...(openByDay ? [USAGE_COLORS.gap] : []), USAGE_COLORS.info],
      plotOptions: { bar: { columnWidth: days.length > 20 ? "70%" : "45%", borderRadius: 3, borderRadiusApplication: "end" } },
      stroke: { width: [0, 0, ...gap.map(() => 0), 2], curve: "smooth" },
      markers: { size: days.length > 20 ? 0 : 4, strokeWidth: 2 },
      dataLabels: { enabled: false },
      xaxis: { categories, labels: { rotate: -45, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => `${v}h` }, min: 0, forceNiceScale: true },
      grid: { strokeDashArray: 0, xaxis: { lines: { show: false } } },
      legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 6 } },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v: number, { dataPointIndex }: { dataPointIndex: number }) =>
            `${formatDuration((v ?? 0) * HOUR_S)} · ${percent((v ?? 0) * HOUR_S, base(dataPointIndex))}`,
        },
      },
    };
    const s = [
      { name: t("legend.present"), type: "bar", data: days.map((d) => toHours(d.present)) },
      { name: t("legend.away"), type: "bar", data: days.map((d) => toHours(Math.max(0, d.on_screen - d.present))) },
      ...gap,
      { name: t("legend.talking"), type: "line", data: days.map((d) => toHours(d.talking)) },
    ];
    return { series: s, options: opts };
  }, [days, openByDay, t]);

  return (
    <figure className={CHART_INK}>
      <ReactApexChart type="bar" height={280} series={series} options={options} />
      <figcaption className="sr-only">{t("charts.dailyCaption")}</figcaption>
    </figure>
  );
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Sequential steps (low → high) per theme: on a dark card "more" is lighter, on a light card darker. */
const HEAT_RAMPS = {
  present: { light: ["#99f6e4", "#2dd4bf", "#0d9488", "#115e59"], dark: ["#134e4a", "#0f766e", "#14b8a6", "#5eead4"] },
  away: { light: ["#fde68a", "#fbbf24", "#d97706", "#92400e"], dark: ["#78350f", "#b45309", "#f59e0b", "#fcd34d"] },
} as const;

/** Weekday × hour, minutes present (or away), summed over the range — in the viewer's clock. */
export function HoursHeatmap({ present, away }: { present: number[][]; away: number[][] }) {
  const t = useTranslations("screenMonitoring");
  const [mode, setMode] = useState<"present" | "away">("present");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const grid = mode === "present" ? present : away;

  const { series, options } = useMemo(() => {
    // Apex draws the first series at the bottom — reversed so Monday is on top.
    const s = DAY_KEYS.map((key, day) => ({
      name: t(`days.${key}`),
      data: grid[day].map((seconds, hour) => ({ x: String(hour).padStart(2, "0"), y: Math.round(seconds / 60) })),
    })).reverse();
    // One hue, four steps (sequential: more = stronger against the card); empty hours stay a faint neutral.
    const ramp = HEAT_RAMPS[mode][isDark ? "dark" : "light"];
    const max = Math.max(1, ...s.flatMap((row) => row.data.map((c) => c.y)));
    const step = max / 4;
    const ranges = [
      { from: 0, to: 0, color: isDark ? "#1e293b" : "#f1f5f9" },
      ...ramp.map((color, i) => ({
        from: i === 0 ? 1 : Math.floor(step * i) + 1,
        to: i === 3 ? max : Math.floor(step * (i + 1)),
        color,
      })),
    ];
    const opts: ApexOptions = {
      chart: { type: "heatmap", toolbar: { show: false }, fontFamily: "inherit", animations: { enabled: false } },
      plotOptions: { heatmap: { radius: 3, enableShades: false, colorScale: { ranges } } },
      legend: { show: false },
      stroke: { width: 2, colors: ["var(--card)"] },
      dataLabels: { enabled: false },
      xaxis: { title: { text: t("charts.hourOfDay"), style: { fontWeight: 500 } }, axisBorder: { show: false }, axisTicks: { show: false } },
      tooltip: { y: { formatter: (v: number) => t("minutes", { count: v }) } },
    };
    return { series: s, options: opts };
  }, [grid, mode, isDark, t]);

  return (
    <div className="space-y-3">
      <SegmentedToggle
        label={t("charts.heatmapMode")}
        value={mode}
        onChange={setMode}
        options={(["present", "away"] as const).map((m) => ({ value: m, label: t(`legend.${m}`) }))}
      />
      <figure className={CHART_INK}>
        <ReactApexChart type="heatmap" height={260} series={series} options={options} />
        <figcaption className="sr-only">{t("charts.heatmapCaption")}</figcaption>
      </figure>
    </div>
  );
}

export interface BreakdownSlice {
  label: string;
  seconds: number;
  color: string;
}

/**
 * Part of the time on Screen Project: a donut with the total in the middle and
 * every slice named with its time and share in the list beside it (identity
 * never by colour alone).
 */
export function BreakdownChart({ slices, totalLabel }: { slices: BreakdownSlice[]; totalLabel: string }) {
  const total = slices.reduce((s, x) => s + x.seconds, 0);
  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", fontFamily: "inherit", animations: { enabled: false } },
      labels: slices.map((s) => s.label),
      colors: slices.map((s) => s.color),
      stroke: { width: 2, colors: ["var(--card)"] },
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: { show: true, fontSize: "12px" },
              value: { show: true, fontSize: "18px", fontWeight: 600, formatter: (v: string) => formatDuration(Number(v)) },
              total: { show: true, showAlways: true, label: totalLabel, fontSize: "12px", formatter: () => formatDuration(total) },
            },
          },
        },
      },
      tooltip: { y: { formatter: (v: number) => `${formatDuration(v)} · ${percent(v, total)}` } },
    }),
    [slices, total, totalLabel],
  );

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <figure className={CHART_INK}>
        <ReactApexChart type="donut" height={220} series={slices.map((s) => s.seconds)} options={options} />
      </figure>
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="tabular-nums">{formatDuration(s.seconds)}</span>
            <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">{percent(s.seconds, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
