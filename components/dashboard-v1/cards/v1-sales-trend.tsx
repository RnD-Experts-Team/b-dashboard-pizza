"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import type { DsprSales } from "@/types/dspr.types";
import { Skeleton } from "@/components/ui/skeleton";
import { V1Card } from "../v1-card";
import { WtdComparisonDialog } from "@/components/dspr/wtd-comparison-dialog";
import { CATEGORIES } from "../category";
import { fmt$, fmt$2 } from "@/components/dspr/wbr-format";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full" />,
});

const DAY_NAMES = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

function laborColor(v: number): string {
  if (v <= 10) return "#EF4444";
  if (v <= 15) return "#EAB308";
  if (v <= 19) return "#F97316";
  if (v <= 24) return "#22C55E";
  if (v <= 29) return "#F97316";
  if (v <= 39) return "#EAB308";
  return "#EF4444";
}

/* Fresh weekly-sales chart: this week vs previous week (columns) with last
 * year as a smooth line, in the Sales (emerald) category palette. */
export function V1SalesTrendCard({
  sales,
  laborWeekToDateByDay,
  span = 2,
  className,
}: {
  sales: DsprSales;
  laborWeekToDateByDay?: Record<string, { value: number; percent: number }>;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const isDark = useDocumentColorMode() === "dark";
  const [open, setOpen] = useState(false);
  const colors = CATEGORIES.sales.chartColors;
  const prevWeekColor = "#0ea5e9"; // sky-500 — matches Phone blue in hourly channels
  const lineColor = "#EAB308"; // yellow-500

  const twDates = useMemo(() => Object.keys(sales.this_week_by_day), [sales]);
  const thisWeek = useMemo(() => Object.values(sales.this_week_by_day), [sales]);
  const prevWeek = useMemo(() => Object.values(sales.previous_week_by_day), [sales]);
  const lastYear = useMemo(() => Object.values(sales.same_week_last_year_by_day), [sales]);

  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const twTotal = sales.this_week_total ?? sum(thisWeek);
  const pwTotal = sales.previous_week_total ?? sum(prevWeek);
  const lyTotal = sales.same_week_last_year_total ?? sum(lastYear);

  const pctDiff = (a: number, b: number) => {
    if (b === 0) return null;
    return ((a - b) / b) * 100;
  };

  const series = useMemo(
    () => [
      { name: "This Week", type: "column", data: thisWeek },
      { name: "Previous Week", type: "column", data: prevWeek },
      { name: "Last Year", type: "line", data: lastYear },
    ],
    [thisWeek, prevWeek, lastYear],
  );

  const labelColor = isDark ? "#a1a1aa" : "#71717a";

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        stacked: false,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: labelColor,
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: [colors[0], prevWeekColor, lineColor],
      plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
      dataLabels: { enabled: false },
      stroke: { width: [0, 0, 3], curve: "smooth", colors: [isDark ? "#18181b" : "#ffffff", isDark ? "#18181b" : "#ffffff", lineColor] },
      xaxis: {
        categories: thisWeek.map((_, i) => DAY_NAMES[i] ?? `D${i + 1}`),
        labels: {
          style: { fontSize: "10px", colors: labelColor },
        },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks: { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => (v == null ? "" : `$${(v / 1000).toFixed(0)}k`),
          style: { fontSize: "10px", colors: labelColor },
        },
      },
      legend: {
        position: "top",
        horizontalAlign: "left",
        fontSize: "10px",
        labels: { colors: labelColor },
      },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        y: { formatter: (v: number) => fmt$(v) },
      },
      fill: { opacity: [0.9, 0.9, 1] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, labelColor, thisWeek.length],
  );

  return (
    <V1Card
      title="Weekly Sales"
      category="sales"
      period="W"
      span={span}
      className={className}
      onExpand={() => setOpen(true)}
      bodyClassName="overflow-hidden"
    >
      <ReactApexChart
        key={isDark ? "dark" : "light"}
        options={options}
        series={series}
        type="line"
        height={195}
      />

      <WtdComparisonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Weekly Sales Comparison"
        badgeText="3-Week Breakdown"
        wide
      >
        {/* Weekly Totals Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(
            [
              { label: "This Week", value: twTotal, color: "#008FFB", compare: pwTotal },
              { label: "Previous Week", value: pwTotal, color: "#00E396", compare: null },
              { label: "Same Week Last Year", value: lyTotal, color: "#FEB019", compare: null },
            ] as { label: string; value: number; color: string; compare: number | null }[]
          ).map(({ label, value, color, compare }) => {
            const diff = compare != null ? pctDiff(twTotal, compare) : null;
            return (
              <div
                key={label}
                className="rounded-lg p-3 text-center"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
              >
                <p className="text-[10px] font-medium mb-1" style={{ color }}>
                  {label}
                </p>
                <p className="text-lg font-bold tabular-nums" style={{ color }}>
                  {fmt$2(value)}
                </p>
                {diff != null && (
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {diff > 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : diff < 0 ? (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    ) : (
                      <Minus className="h-3 w-3 text-zinc-400" />
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-zinc-400",
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(1)}% vs prev week
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Day-by-day table */}
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-400">Day</th>
                <th className="px-3 py-2 text-right font-semibold" style={{ color: "#008FFB" }}>This Week</th>
                <th className="px-3 py-2 text-right font-semibold" style={{ color: "#00E396" }}>Previous Week</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-500">vs Prev</th>
                <th className="px-3 py-2 text-right font-semibold" style={{ color: "#FEB019" }}>Same Week LY</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-500">vs LY</th>
                {laborWeekToDateByDay && <th className="px-3 py-2 text-right font-semibold text-zinc-500">Labor %</th>}
              </tr>
            </thead>
            <tbody>
              {thisWeek.map((tw, i) => {
                const pw = prevWeek[i] ?? 0;
                const ly = lastYear[i] ?? 0;
                const vsPrev = pctDiff(tw, pw);
                const vsLY = pctDiff(tw, ly);
                const laborEntry = laborWeekToDateByDay && twDates[i] ? laborWeekToDateByDay[twDates[i]] : undefined;
                const renderPct = (v: number | null) => {
                  if (v == null) return <span className="text-zinc-400">—</span>;
                  const isPos = v > 0;
                  const isNeg = v < 0;
                  return (
                    <span className={cn("font-medium", isPos ? "text-emerald-500" : isNeg ? "text-red-500" : "text-zinc-400")}>
                      {isPos ? "+" : ""}{v.toFixed(1)}%
                    </span>
                  );
                };
                return (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold">{DAY_NAMES[i] ?? `Day ${i + 1}`}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: "#008FFB" }}>
                      {tw > 0 ? fmt$2(tw) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#00E396" }}>
                      {pw > 0 ? fmt$2(pw) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{renderPct(vsPrev)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#FEB019" }}>
                      {ly > 0 ? fmt$2(ly) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{renderPct(vsLY)}</td>
                    {laborWeekToDateByDay && (
                      laborEntry && laborEntry.percent > 0
                        ? <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: laborColor(laborEntry.percent) }}>{laborEntry.percent.toFixed(1)}%</td>
                        : <td className="px-3 py-2 text-right tabular-nums text-zinc-300 dark:text-zinc-600">—</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-t-2 border-zinc-300 dark:border-zinc-600 font-bold">
                <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">Total</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#008FFB" }}>
                  {fmt$2(twTotal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#00E396" }}>
                  {fmt$2(pwTotal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(() => {
                    const d = pctDiff(twTotal, pwTotal);
                    if (d == null) return <span className="text-zinc-400">—</span>;
                    return (
                      <span className={cn("font-bold", d > 0 ? "text-emerald-500" : d < 0 ? "text-red-500" : "text-zinc-400")}>
                        {d > 0 ? "+" : ""}{d.toFixed(1)}%
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#FEB019" }}>
                  {fmt$2(lyTotal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(() => {
                    const d = pctDiff(twTotal, lyTotal);
                    if (d == null) return <span className="text-zinc-400">—</span>;
                    return (
                      <span className={cn("font-bold", d > 0 ? "text-emerald-500" : d < 0 ? "text-red-500" : "text-zinc-400")}>
                        {d > 0 ? "+" : ""}{d.toFixed(1)}%
                      </span>
                    );
                  })()}
                </td>
                {laborWeekToDateByDay && (() => {
                  const entries = Object.values(laborWeekToDateByDay).filter((e) => e.percent > 0);
                  if (entries.length === 0) return <td className="px-3 py-2 text-right tabular-nums text-zinc-400">—</td>;
                  const avg = entries.reduce((s, e) => s + e.percent, 0) / entries.length;
                  return (
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: laborColor(avg) }}>
                      {avg.toFixed(1)}%
                    </td>
                  );
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      </WtdComparisonDialog>
    </V1Card>
  );
}
