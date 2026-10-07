"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
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
 *
 * Text, grid and tooltip take their colours from the theme tokens in CSS
 * (`INK` below), not from a light/dark guess in JS: the page's light/dark
 * class and `useTheme()` can disagree after a toggle, and the chart then kept
 * near-white labels on a white card. Apex writes `fill`/`stroke` as SVG
 * attributes, which any CSS rule outranks.
 */
const SERIES_COLOR = "#008FFB";
/** Bars stay thin: the slot is 34px, the bar about 20px of it. */
const ROW_PX = 34;

/** Bars shown at most: the biggest ones. The rest are counted under the chart. */
const MAX_ROWS = 8;

/** Chart text, grid and tooltip in the page's own colours, whatever the theme. */
const INK = [
  "[&_.apexcharts-text]:fill-muted-foreground",
  "[&_.apexcharts-yaxis-label]:fill-foreground",
  "[&_.apexcharts-datalabel]:fill-foreground",
  "[&_.apexcharts-gridline]:stroke-border",
  "[&_.apexcharts-tooltip]:!border-border [&_.apexcharts-tooltip]:!bg-popover [&_.apexcharts-tooltip]:!text-popover-foreground [&_.apexcharts-tooltip]:!shadow-md",
  "[&_.apexcharts-tooltip-title]:!border-border [&_.apexcharts-tooltip-title]:!bg-muted",
].join(" ");

/**
 * The value axis: round steps (1, 2, 5 x 10^n -- never "0.5 tickets" when the
 * values are counts) and one step of room past the longest bar, so its number
 * sits beside the bar instead of on top of it.
 */
function valueAxis(top: number, whole: boolean): { max: number; tickAmount: number } {
  const raw = Math.max(top / 5, Number.EPSILON);
  const power = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 5, 10].map((m) => m * power).find((v) => v >= raw) ?? 10 * power;
  if (whole) step = Math.max(1, Math.round(step));
  const max = (Math.floor(top / step) + 1) * step;
  return { max, tickAmount: Math.round(max / step) };
}

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
  const all = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);
  const sorted = useMemo(() => all.slice(0, MAX_ROWS), [all]);
  const hidden = all.length - sorted.length;

  const options: ApexOptions = useMemo(() => {
    const axis = valueAxis(sorted[0]?.value ?? 0, sorted.every((r) => Number.isInteger(r.value)));
    return {
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", animations: { enabled: false } },
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
        style: { fontSize: "11px", fontWeight: 500 },
      },
      xaxis: {
        categories: sorted.map((r) => r.label),
        min: 0,
        max: axis.max,
        tickAmount: axis.tickAmount,
        labels: { formatter: (v: string) => format(Number(v)), style: { fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { maxWidth: 180, style: { fontSize: "12px" } } },
      grid: {
        strokeDashArray: 0,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { right: 36 },
      },
      tooltip: {
        y: { formatter: (v: number) => `${format(Number(v))} ${valueLabel}`, title: { formatter: () => "" } },
      },
      legend: { show: false },
    };
  }, [sorted, format, valueLabel]);

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to chart for this range.</p>;
  }

  return (
    <figure className={INK}>
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
