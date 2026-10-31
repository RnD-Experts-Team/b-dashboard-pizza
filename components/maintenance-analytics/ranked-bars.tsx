"use client";

import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/maintenance/money";
import { ChartCard, ChartEmpty, DataTable, ReactApexChart, useChartInk } from "./chart-kit";

/** Bars drawn at most; "Show all" lists the rest (docs §8: top 10 + show all table). */
export const TOP_BARS = 10;
/** Each bar's slot in pixels, and the room for the axis under them. */
const ROW_PX = 32;
const AXIS_PX = 48;
const MIN_HEIGHT_PX = 120;
const LABEL_MAX_PX = 180;
const BAR_RADIUS_PX = 3;

export interface RankedRow {
  key: string;
  label: string;
  value: number;
}

const money = (v: number) => formatMoney(v);

/**
 * Horizontal bars, biggest first, one hue (the length says it, a ramp would
 * say it twice): "by store", "by technician"… The top ten are drawn; "Show
 * all" lists every row under the chart. "Show as table" swaps the chart for
 * the full table.
 */
export function RankedBars({
  id,
  icon,
  title,
  description,
  rows,
  color,
  valueHead,
  format = money,
  sorted = true,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  rows: RankedRow[];
  color: string;
  /** The value column's heading ("Spent"). */
  valueHead: string;
  format?: (value: number) => string;
  /** false keeps the given order (e.g. Bought → Used → …). */
  sorted?: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const ink = useChartInk();
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(() => (sorted ? [...rows].sort((a, b) => b.value - a.value) : rows), [rows, sorted]);
  const top = useMemo(() => all.slice(0, TOP_BARS), [all]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", foreColor: ink.fore, animations: { enabled: false } },
      colors: [color],
      plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: BAR_RADIUS_PX, borderRadiusApplication: "end" } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: top.map((r) => r.label),
        labels: { formatter: (v: string) => format(Number(v)) },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { maxWidth: LABEL_MAX_PX } },
      grid: { borderColor: ink.grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
      tooltip: { theme: ink.tooltip, y: { formatter: (v: number) => format(v), title: { formatter: () => "" } } },
      legend: { show: false },
    }),
    [top, color, format, ink],
  );

  const table = () => (
    <DataTable
      head={[t("analytics.name"), valueHead]}
      rows={all.map((r) => [r.label, format(r.value)])}
      numeric={[1]}
    />
  );

  return (
    <ChartCard
      id={id}
      icon={icon}
      title={title}
      description={description}
      table={() => (all.length ? table() : <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>)}
      chart={() =>
        all.length === 0 ? (
          <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>
        ) : (
          <figure className="space-y-2">
            <figcaption className="sr-only">{title}</figcaption>
            <ReactApexChart
              type="bar"
              series={[{ name: valueHead, data: top.map((r) => r.value) }]}
              options={options}
              height={Math.max(MIN_HEIGHT_PX, top.length * ROW_PX + AXIS_PX)}
            />
            {all.length > TOP_BARS && (
              <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                  {showAll ? t("analytics.showTop", { count: TOP_BARS }) : t("analytics.showAllRows", { count: all.length })}
                </Button>
                {showAll && table()}
              </div>
            )}
          </figure>
        )
      }
    />
  );
}
