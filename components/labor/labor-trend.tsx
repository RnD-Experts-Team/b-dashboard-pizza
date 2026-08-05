"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";
import type { LaborTrend as LaborTrendData, LaborTrendMetrics } from "@/types/labor.types";
import {
  LaborCard,
  PEOPLE,
  ReactApexChart,
  buildTooltipCustom,
  useChartBase,
} from "./labor-chart";
import { DASH, TREND_METRICS, fmtDelta, trendMetricConfig } from "./labor-format";

/** One `comparison_to_average` entry. */
function ComparisonCallout({
  metric,
  thisWeek,
  average,
  delta,
}: {
  metric: string;
  thisWeek: number | null;
  average: number | null;
  delta: number | null;
}) {
  const config = trendMetricConfig(metric);
  const label = config?.label ?? metric;
  const fmt = config?.format ?? ((v: number | null) => (v === null ? DASH : String(v)));

  // A rise in turnover is bad; a rise in hours or gross pay is good.
  const higherIsBetter = config?.higherIsBetter ?? true;
  const good = delta === null ? null : higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border border-border/50 bg-background/55 px-2.5 py-1.5">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-base font-bold leading-tight tabular-nums">
          {fmt(thisWeek)}
        </p>
        <span
          className={cn(
            "flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
            good === true && "text-emerald-600 dark:text-emerald-400",
            good === false && "text-rose-600 dark:text-rose-400",
            good === null && "text-muted-foreground",
          )}
        >
          <Icon className="h-3 w-3" />
          {fmtDelta(delta)}
        </span>
      </div>
      <p className="truncate text-[9.5px] font-medium leading-tight text-muted-foreground/80">
        avg {fmt(average)}
      </p>
    </div>
  );
}

export function LaborTrend({ trend }: { trend: LaborTrendData }) {
  const { base, isDark } = useChartBase();
  // Headcount is derived from status records, not CSV imports, so it's
  // populated even for stores/weeks with no pay data yet — a safer first
  // view than a metric that may render as an empty chart.
  const [metric, setMetric] = useState<keyof LaborTrendMetrics>("headcount_active_end");

  const config = useMemo(
    () => TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0],
    [metric],
  );

  const weeks = trend.weeks;

  const options: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "line" },
      colors: [PEOPLE.chartColors[0]],
      stroke: { curve: "smooth", width: 2.5 },
      markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
      xaxis: {
        ...base.xaxis,
        categories: weeks.map((w) => format(parseISO(w.week_start), "MMM d")),
      },
      yaxis: {
        ...base.yaxis,
        labels: {
          style: { fontSize: "10px" },
          formatter: (v: number) => config.format(v),
        },
      },
      tooltip: {
        custom: buildTooltipCustom({ isDark, formatValue: (v) => config.format(v) }),
      },
    }),
    [base, isDark, weeks, config],
  );

  const series = useMemo(
    () => [
      {
        name: config.label,
        // Apex renders `null` as a gap, which is exactly right for "no data".
        data: weeks.map((w) => w[config.key] ?? null),
      },
    ],
    [weeks, config],
  );

  return (
    <LaborCard
      title="Trend"
      icon={TrendingUp}
      action={
        weeks.length > 0 ? (
          <Select
            value={metric}
            onValueChange={(v) => setMetric(v as keyof LaborTrendMetrics)}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TREND_METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {weeks.length === 0 ? (
          <V1Empty icon={TrendingUp}>No trailing week data</V1Empty>
        ) : (
          <div className="labor-trend-chart h-[220px]">
            <ReactApexChart
              options={options}
              series={series}
              type="line"
              height={220}
            />
          </div>
        )}

        {trend.comparison_to_average.length > 0 && (
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              This Week vs. Trailing Average
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              {trend.comparison_to_average.map((c) => (
                <ComparisonCallout
                  key={c.metric}
                  metric={c.metric}
                  thisWeek={c.this_week}
                  average={c.trailing_average}
                  delta={c.delta_percent}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Same fix as labor-headcount.tsx — ApexCharts sets its own inline
          fill on these SVG text nodes, so only an `!important` override
          actually replaces it. */}
      <style jsx global>{`
        .labor-trend-chart .apexcharts-yaxis-label {
          fill: #18181b !important;
        }
        .dark .labor-trend-chart .apexcharts-yaxis-label {
          fill: #ffffff !important;
        }
      `}</style>
    </LaborCard>
  );
}
