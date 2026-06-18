"use client";

import { useMemo } from "react";
import {
  DollarSign,
  Users,
  Activity,
  TrendingUp,
  Banknote,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DsprChannelSales, DsprDay, DsprGoalMetric } from "@/types/dspr.types";
import { fmt$, fmtNum, fmtPct } from "@/components/dspr/wbr-format";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  KpiHero — the headline strip at the top of Dashboard V1.
 *
 *  Big daily numbers with a small WTD subscript, mirroring the data shown in
 *  the existing DaySummaryStats but front-and-center. Same `day` fields, no
 *  new endpoints.
 * ────────────────────────────────────────────────────────────────────────── */

const CHANNEL_KEYS: (keyof DsprChannelSales)[] = [
  "phone_sales",
  "call_center_sales",
  "drive_thru_sales",
  "website_sales",
  "mobile_sales",
  "doordash_sales",
  "ubereats_sales",
  "grubhub_sales",
];

/** Sum all sales channels (values arrive as number | string). */
function sumChannels(c?: DsprChannelSales): number {
  if (!c) return 0;
  return CHANNEL_KEYS.reduce((s, k) => s + (Number(c[k]) || 0), 0);
}

/** Pull a numeric goal for a metric name from goal_metrics. */
function goalFor(metrics: DsprGoalMetric[] | undefined, name: string): number | null {
  const m = metrics?.find((x) => x.metric_name === name);
  const g = m?.goals?.[0]?.goal;
  if (g == null) return null;
  const n = Number(g);
  return Number.isFinite(n) ? n : null;
}

interface Pill {
  label: string;
  value: string;
  wtd?: string;
  icon: LucideIcon;
  text: string;
  iconBg: string;
  border: string;
  tooltip: string;
  emphasizeNegative?: boolean;
  negative?: boolean;
}

export function KpiHero({ day, goalMetrics }: { day: DsprDay; goalMetrics?: DsprGoalMetric[] }) {
  const pills = useMemo<Pill[]>(() => {
    const netSales = sumChannels(day.total_sales);
    const netSalesWtd = day.total_sales_week_to_date
      ? sumChannels(day.total_sales_week_to_date)
      : undefined;

    const upDay = day.upselling?.total_upselling_day;
    const upWtd = day.upselling?.total_upselling_week_to_date;
    const upGoal = goalFor(goalMetrics, "Upselling");

    return [
      {
        label: "Net Sales",
        value: fmt$(netSales),
        wtd: netSalesWtd != null ? fmt$(netSalesWtd) : undefined,
        icon: DollarSign,
        text: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
        border: "border-l-emerald-500",
        tooltip: "Total sales across all channels for the day",
      },
      {
        label: "Customers",
        value: fmtNum(day.customer_count),
        wtd:
          day.customer_count_week_to_date != null
            ? fmtNum(day.customer_count_week_to_date)
            : undefined,
        icon: Users,
        text: "text-violet-600 dark:text-violet-400",
        iconBg: "bg-violet-500/15 dark:bg-violet-500/20",
        border: "border-l-violet-500",
        tooltip: "Customers served for the day",
      },
      {
        label: "Labor",
        value: fmtPct(day.labor),
        wtd:
          day.labor_week_to_date_avg != null
            ? fmtPct(day.labor_week_to_date_avg)
            : undefined,
        icon: Activity,
        text: "text-sky-600 dark:text-sky-400",
        iconBg: "bg-sky-500/15 dark:bg-sky-500/20",
        border: "border-l-sky-500",
        tooltip: "Labor as a percentage of sales (WTD = week-to-date average)",
      },
      {
        label: upGoal != null ? `Upselling / ${fmtNum(upGoal)}` : "Upselling",
        value: fmtNum(upDay),
        wtd: upWtd != null ? fmtNum(upWtd) : undefined,
        icon: TrendingUp,
        text: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
        border: "border-l-amber-500",
        tooltip:
          upGoal != null
            ? `Upselling units today vs weekly goal of ${fmtNum(upGoal)}`
            : "Upselling units today",
      },
      {
        label: "Deposit",
        value: fmt$(day.total_deposit),
        wtd:
          day.total_deposit_week_to_date != null
            ? fmt$(day.total_deposit_week_to_date)
            : undefined,
        icon: Banknote,
        text: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-500/15 dark:bg-blue-500/20",
        border: "border-l-blue-500",
        tooltip: "Total bank deposit for the day",
      },
      {
        label: "Over / Short",
        value: fmt$(day.over_short),
        wtd:
          day.over_short_week_to_date != null
            ? fmt$(day.over_short_week_to_date)
            : undefined,
        icon: ArrowUpDown,
        text:
          day.over_short >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        iconBg:
          day.over_short >= 0
            ? "bg-emerald-500/15 dark:bg-emerald-500/20"
            : "bg-red-500/15 dark:bg-red-500/20",
        border: day.over_short >= 0 ? "border-l-emerald-500" : "border-l-red-500",
        tooltip: day.over_short >= 0 ? "Cash register is over" : "Cash register is short",
        emphasizeNegative: true,
        negative: day.over_short < 0,
      },
    ];
  }, [day, goalMetrics]);

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
      {pills.map((p) => {
        const Icon = p.icon;
        return (
          <Tooltip key={p.label}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-l-2 bg-card px-2.5 py-2",
                  "cursor-default transition-all hover:bg-accent/40 hover:shadow-sm",
                  p.border,
                )}
              >
                <div className={cn("shrink-0 rounded-md p-1", p.iconBg)}>
                  <Icon className={cn("h-3.5 w-3.5", p.text)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-bold leading-tight tabular-nums",
                      p.emphasizeNegative && p.negative && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {p.value}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {p.label}
                    </p>
                    {p.wtd && (
                      <span className="shrink-0 text-[9px] font-medium tabular-nums text-muted-foreground/80">
                        {p.wtd}
                        <span className="ms-0.5 text-[7px] font-bold uppercase">wtd</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{p.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
