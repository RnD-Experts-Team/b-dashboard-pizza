"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import type { DsprSales } from "@/types/dspr.types";
import { Skeleton } from "@/components/ui/skeleton";
import { V1Card } from "../v1-card";
import {
  WtdComparisonDialog,
  ComparisonTable,
} from "@/components/dspr/wtd-comparison-dialog";
import { CATEGORIES } from "../category";
import { fmt$ } from "@/components/dspr/wbr-format";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full" />,
});

const DAY_NAMES = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

/* Fresh weekly-sales chart: this week vs previous week (columns) with last
 * year as a smooth line, in the Sales (emerald) category palette. */
export function V1SalesTrendCard({
  sales,
  span = 2,
  className,
}: {
  sales: DsprSales;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [open, setOpen] = useState(false);
  const colors = CATEGORIES.sales.chartColors;
  const lineColor = "#f59e0b";

  const thisWeek = useMemo(() => Object.values(sales.this_week_by_day), [sales]);
  const prevWeek = useMemo(() => Object.values(sales.previous_week_by_day), [sales]);
  const lastYear = useMemo(() => Object.values(sales.same_week_last_year_by_day), [sales]);

  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const twTotal = sales.this_week_total ?? sum(thisWeek);
  const pwTotal = sales.previous_week_total ?? sum(prevWeek);
  const lyTotal = sales.same_week_last_year_total ?? sum(lastYear);

  const series = useMemo(
    () => [
      { name: "This Week", type: "column", data: thisWeek },
      { name: "Previous Week", type: "column", data: prevWeek },
      { name: "Last Year", type: "line", data: lastYear },
    ],
    [thisWeek, prevWeek, lastYear],
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        stacked: false,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: [colors[0], colors[1], lineColor],
      plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
      dataLabels: { enabled: false },
      stroke: { width: [0, 0, 3], curve: "smooth" },
      xaxis: {
        categories: thisWeek.map((_, i) => DAY_NAMES[i] ?? `D${i + 1}`),
        labels: { style: { fontSize: "10px" } },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => (v == null ? "" : `$${(v / 1000).toFixed(0)}k`),
          style: { fontSize: "10px" },
        },
      },
      legend: { position: "top", horizontalAlign: "left", fontSize: "10px" },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => fmt$(v) } },
      fill: { opacity: [0.9, 0.9, 1] },
    }),
    [isDark, colors, thisWeek],
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
      <ReactApexChart options={options} series={series} type="line" height={195} />

      <WtdComparisonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Weekly Sales Comparison"
        badgeText="3-Week Breakdown"
        wide
      >
        <ComparisonTable
          rows={[
            { label: "This Week Total", daily: fmt$(twTotal), wtd: fmt$(pwTotal), dailyNum: twTotal, wtdNum: pwTotal, higherIsBetter: true },
            { label: "vs Last Year", daily: fmt$(twTotal), wtd: fmt$(lyTotal), dailyNum: twTotal, wtdNum: lyTotal, higherIsBetter: true },
          ]}
        />
        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-right">This Week</th>
                <th className="px-3 py-2 text-right">Prev Week</th>
                <th className="px-3 py-2 text-right">Last Year</th>
              </tr>
            </thead>
            <tbody>
              {thisWeek.map((tw, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{DAY_NAMES[i] ?? `Day ${i + 1}`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tw > 0 ? fmt$(tw) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{prevWeek[i] > 0 ? fmt$(prevWeek[i]) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{lastYear[i] > 0 ? fmt$(lastYear[i]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WtdComparisonDialog>
    </V1Card>
  );
}
