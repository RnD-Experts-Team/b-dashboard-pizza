"use client";

import { useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
import { ArrowRight, Info, UsersRound } from "lucide-react";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";
import type { LaborHeadcount as LaborHeadcountData } from "@/types/labor.types";
import {
  LaborCard,
  PEOPLE,
  ReactApexChart,
  buildTooltipCustom,
  useChartBase,
} from "./labor-chart";
import { fmtNumber } from "./labor-format";

interface LaborHeadcountProps {
  headcount: LaborHeadcountData;
  /** The business week's bounds, for the "day before"/"end of week" dates. */
  weekStart?: string;
  weekEnd?: string;
}

export function LaborHeadcount({ headcount, weekStart, weekEnd }: LaborHeadcountProps) {
  const { base, isDark } = useChartBase();

  // `by_position` arrives sorted descending by count — do not re-sort it.
  const positions = headcount.by_position;

  const options: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "bar" },
      colors: [PEOPLE.chartColors[0]],
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: "72%" },
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: "11px", fontWeight: 700, colors: ["#fff"] },
      },
      xaxis: {
        ...base.xaxis,
        categories: positions.map((p) => p.position),
        labels: { style: { ...base.xaxis?.labels?.style, fontSize: "11px" } },
      },
      // Match the x-axis label styling exactly, rather than an independent
      // color that kept failing to render on these.
      yaxis: {
        ...base.yaxis,
        labels: { style: { ...base.xaxis?.labels?.style, fontSize: "11px" } },
      },
      tooltip: {
        custom: buildTooltipCustom({ isDark, formatValue: (v) => fmtNumber(v) }),
      },
    }),
    [base, isDark, positions],
  );

  const series = useMemo(
    () => [{ name: "Employees", data: positions.map((p) => p.count) }],
    [positions],
  );

  const net = headcount.net_change;

  // "Start of week" is the carry-in count from the day before the business
  // week began — show that actual date so the two numbers read as two points
  // in time, not two unrelated totals.
  const startDateLabel = weekStart
    ? format(subDays(parseISO(weekStart), 1), "MMM d")
    : null;
  const endDateLabel = weekEnd ? format(parseISO(weekEnd), "MMM d") : null;

  return (
    <LaborCard title="Headcount" icon={UsersRound} fillHeight>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Flow: carry-in → end of week, with the net delta. */}
        <div className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-border/50 bg-background/55 px-2 py-2">
          <div className="flex items-center justify-center gap-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Employees, Start vs. End of Week
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="h-3 w-3" />
                  <span className="sr-only">What does this mean?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center text-xs">
                Active headcount the day before this business week began,
                compared to active headcount at week&apos;s end. The
                difference is hires minus separations during the week.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <p className="text-[9px] font-medium text-muted-foreground">
                Start{startDateLabel ? ` · ${startDateLabel}` : ""}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {fmtNumber(headcount.active_start_of_week)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-center">
              <p className="text-[9px] font-medium text-muted-foreground">
                End{endDateLabel ? ` · ${endDateLabel}` : ""}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {fmtNumber(headcount.active_end_of_week)}
              </p>
            </div>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                net > 0 && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                net < 0 && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                net === 0 && "bg-muted text-muted-foreground",
              )}
              title="Net change: new hires minus separations this week"
            >
              {net > 0 ? "+" : ""}
              {fmtNumber(net)} net
            </span>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1">
          <V1Metric label="New Hires" value={fmtNumber(headcount.new_hires)} />
          <V1Metric label="Separations" value={fmtNumber(headcount.separations)} />
        </div>

        {/* Grows to absorb whatever extra height the grid row stretched this
            card to (e.g. to match a taller Tenure card), so the chart fills
            the card instead of leaving blank space below it. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="mb-1 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            By Position
          </p>
          {positions.length === 0 ? (
            <V1Empty icon={UsersRound}>No active employees</V1Empty>
          ) : (
            <div className="labor-headcount-chart min-h-[180px] flex-1">
              <ReactApexChart
                options={options}
                series={series}
                type="bar"
                height="100%"
                width="100%"
              />
            </div>
          )}
        </div>
      </div>

      {/* ApexCharts sets its own inline `fill` on these SVG text nodes, which
          wins over a plain CSS rule — only an `!important` override actually
          replaces it. Same technique as
          components/dspr/daily-sales-by-channel-chart.tsx. */}
      <style jsx global>{`
        .labor-headcount-chart .apexcharts-yaxis-label {
          fill: #18181b !important;
        }
        .dark .labor-headcount-chart .apexcharts-yaxis-label {
          fill: #ffffff !important;
        }
      `}</style>
    </LaborCard>
  );
}
