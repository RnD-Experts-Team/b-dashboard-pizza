"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full" />,
});

/**
 * One series, horizontal bars, biggest first -- "how many Oven tickets",
 * "how long Sinks take". One hue for every bar (a ramp on unordered
 * categories would double-encode the length), the value at each bar's tip in
 * text ink, a hairline grid, a tooltip on hover, and the numbers again in a
 * screen-reader table.
 *
 * #008FFB is the dashboard's series-1 blue, validated against both chart
 * surfaces (lightness band, chroma floor, >= 3:1 contrast).
 */
const SERIES_COLOR = "#008FFB";
/** Bars stay thin: the slot is 34px, the bar about 20px of it. */
const ROW_PX = 34;

/** Bars shown at most: the biggest ones. The rest are counted under the chart. */
const MAX_ROWS = 8;

/** Module-level so the chart options are not rebuilt on every render. */
const formatCount = (v: number) => v.toLocaleString();

export function AnalyticsBarChart({
  title,
  rows,
  valueLabel,
  format = formatCount,
}: {
  /** What is plotted -- the single series needs no legend, the title names it. */
  title: string;
  rows: { label: string; value: number }[];
  /** The unit, for the tooltip and the table ("tickets", "hours"). */
  valueLabel: string;
  format?: (value: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const all = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);
  const sorted = useMemo(() => all.slice(0, MAX_ROWS), [all]);
  const hidden = all.length - sorted.length;

  const options: ApexOptions = useMemo(() => {
    const ink = dark ? "#e4e4e7" : "#3f3f46";
    const muted = dark ? "#a1a1aa" : "#71717a";
    const grid = dark ? "#27272a" : "#e4e4e7";

    return {
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", foreColor: muted, animations: { enabled: false } },
      colors: [SERIES_COLOR],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "58%",
          borderRadius: 4,
          borderRadiusApplication: "end",
          dataLabels: { position: "top" },
        },
      },
      dataLabels: {
        enabled: true,
        offsetX: 26,
        formatter: (v: number) => format(Number(v)),
        style: { fontSize: "11px", fontWeight: 500, colors: [ink] },
      },
      xaxis: {
        categories: sorted.map((r) => r.label),
        labels: { formatter: (v: string) => format(Number(v)), style: { fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { maxWidth: 180, style: { fontSize: "12px", colors: [ink] } } },
      grid: {
        borderColor: grid,
        strokeDashArray: 0,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { right: 36 },
      },
      tooltip: {
        theme: dark ? "dark" : "light",
        y: { formatter: (v: number) => `${format(Number(v))} ${valueLabel}`, title: { formatter: () => "" } },
      },
      legend: { show: false },
    };
  }, [dark, sorted, format, valueLabel]);

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to chart for this range.</p>;
  }

  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <ReactApexChart
        type="bar"
        series={[{ name: title, data: sorted.map((r) => r.value) }]}
        options={options}
        height={Math.max(120, sorted.length * ROW_PX + 48)}
      />
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          The top {MAX_ROWS} shown; {hidden} more with smaller numbers.
        </p>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr><th scope="col">Item</th><th scope="col">{valueLabel}</th></tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td>{format(r.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
