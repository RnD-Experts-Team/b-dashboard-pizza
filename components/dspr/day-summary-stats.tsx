"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign,
  Banknote,
  ArrowUpDown,
  RotateCcw,
  Users,
  Trash2,
  HandCoins,
  Gauge,
} from "lucide-react";
import type { DsprDay } from "@/types/dspr.types";
import { cn } from "@/lib/utils";

interface DaySummaryStatsProps {
  day: DsprDay;
  className?: string;
}

const fmt = (v: number, decimals = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

type StatConfig = {
  label: string;
  shortLabel: string;
  value: string;
  rawValue: number;
  wtdValue?: string;
  isWtdNegative?: boolean;
  wtdAvgValue?: string;
  isWtdAvgNegative?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  borderColor: string;
  tooltip: string;
  isNegative?: boolean;
};

export function DaySummaryStats({ day, className }: DaySummaryStatsProps) {
  const hasWtd = day.total_cash_sales_week_to_date !== undefined;
  const hasWtdAvg = day.total_cash_sales_week_to_date_avg !== undefined;
  const [showWtdAvg, setShowWtdAvg] = useState(false);

  const stats: StatConfig[] = [
    {
      label: "Total Cash Sales",
      shortLabel: "Cash Sales",
      value: fmt(day.total_cash_sales),
      rawValue: day.total_cash_sales,
      wtdValue: hasWtd ? fmt(day.total_cash_sales_week_to_date!) : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.total_cash_sales_week_to_date_avg!) : undefined,
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      borderColor: "border-l-emerald-500",
      tooltip: "Total cash sales for the day",
    },
    {
      label: "Total Deposit",
      shortLabel: "Deposit",
      value: fmt(day.total_deposit),
      rawValue: day.total_deposit,
      wtdValue: hasWtd ? fmt(day.total_deposit_week_to_date!) : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.total_deposit_week_to_date_avg!) : undefined,
      icon: Banknote,
      color: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/15 dark:bg-blue-500/20",
      borderColor: "border-l-blue-500",
      tooltip: "Total bank deposit for the day",
    },
    {
      label: "Refunded Orders",
      shortLabel: "Refunds",
      value: `${day.refunded_orders.count} / ${fmt(day.refunded_orders.sales)}`,
      rawValue: day.refunded_orders.sales,
      wtdValue: hasWtd
        ? `${day.refunded_orders_week_to_date!.count} / ${fmt(day.refunded_orders_week_to_date!.sales)}`
        : undefined,
      isWtdNegative: hasWtd ? (day.refunded_orders_week_to_date?.count ?? 0) > 0 : undefined,
      wtdAvgValue: hasWtdAvg
        ? `${day.refunded_orders_week_to_date_avg!.count} / ${fmt(day.refunded_orders_week_to_date_avg!.sales)}`
        : undefined,
      isWtdAvgNegative: hasWtdAvg ? (day.refunded_orders_week_to_date_avg?.count ?? 0) > 0 : undefined,
      icon: RotateCcw,
      color: "text-orange-600 dark:text-orange-400",
      iconBg: "bg-orange-500/15 dark:bg-orange-500/20",
      borderColor: "border-l-orange-500",
      tooltip: `${day.refunded_orders.count} order(s) refunded totaling ${fmt(day.refunded_orders.sales)}`,
      isNegative: day.refunded_orders.count > 0,
    },
    {
      label: "Customer Count",
      shortLabel: "Customers",
      value: day.customer_count.toLocaleString(),
      rawValue: day.customer_count,
      wtdValue: hasWtd ? day.customer_count_week_to_date!.toLocaleString() : undefined,
      wtdAvgValue: hasWtdAvg ? day.customer_count_week_to_date_avg!.toLocaleString() : undefined,
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-violet-500/15 dark:bg-violet-500/20",
      borderColor: "border-l-violet-500",
      tooltip: "Total number of customers served",
    },
    {
      label: "Total Tips",
      shortLabel: "Tips",
      value: fmt(day.total_tips),
      rawValue: day.total_tips,
      wtdValue: hasWtd ? fmt(day.total_tips_week_to_date!) : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.total_tips_week_to_date_avg!) : undefined,
      icon: HandCoins,
      color: "text-teal-600 dark:text-teal-400",
      iconBg: "bg-teal-500/15 dark:bg-teal-500/20",
      borderColor: "border-l-teal-500",
      tooltip: "Total tips collected for the day",
    },
    {
      label: "Over/Short",
      shortLabel: "Over/Short",
      value: fmt(day.over_short),
      rawValue: day.over_short,
      wtdValue: hasWtd ? fmt(day.over_short_week_to_date!) : undefined,
      isWtdNegative: hasWtd ? (day.over_short_week_to_date ?? 0) < 0 : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.over_short_week_to_date_avg!) : undefined,
      isWtdAvgNegative: hasWtdAvg ? (day.over_short_week_to_date_avg ?? 0) < 0 : undefined,
      icon: ArrowUpDown,
      color:
        day.over_short >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      iconBg:
        day.over_short >= 0
          ? "bg-emerald-500/15 dark:bg-emerald-500/20"
          : "bg-red-500/15 dark:bg-red-500/20",
      borderColor: day.over_short >= 0 ? "border-l-emerald-500" : "border-l-red-500",
      tooltip: day.over_short >= 0 ? "Cash register is over" : "Cash register is short",
      isNegative: day.over_short < 0,
    },
    {
      label: "Waste (GW)",
      shortLabel: "Waste GW",
      value: fmt(day.waste.normal),
      rawValue: day.waste.normal,
      wtdValue: hasWtd ? fmt(day.waste_week_to_date!.normal) : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.waste_week_to_date_avg!.normal) : undefined,
      icon: Trash2,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
      borderColor: "border-l-amber-500",
      tooltip: "Normal waste value",
      isNegative: true,
      isWtdNegative: true,
      isWtdAvgNegative: true,
    },
    {
      label: "Waste (Alta)",
      shortLabel: "Waste Alta",
      value: fmt(day.waste.alta_inventory),
      rawValue: day.waste.alta_inventory,
      wtdValue: hasWtd ? fmt(day.waste_week_to_date!.alta_inventory) : undefined,
      wtdAvgValue: hasWtdAvg ? fmt(day.waste_week_to_date_avg!.alta_inventory) : undefined,
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/15 dark:bg-red-500/20",
      borderColor: "border-l-red-500",
      tooltip: "Alta inventory waste value",
      isNegative: true,
      isWtdNegative: true,
      isWtdAvgNegative: true,
    },
  ];

  return (
    <div className={cn("flex items-stretch gap-1", className)}>
      <div className="grid flex-1 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1">
      {stats.map((stat) => {
        const Icon = stat.icon;
        // The primary (day) number never changes — the toggle only swaps
        // which WTD variant the small secondary badge shows.
        const showingAvg = showWtdAvg && stat.wtdAvgValue != null;
        const secondaryValue = showingAvg ? stat.wtdAvgValue : stat.wtdValue;
        const secondaryIsNegative = showingAvg ? stat.isWtdAvgNegative : stat.isWtdNegative;
        const secondaryLabel = showingAvg ? "wtd avg" : "wtd";
        return (
          <Tooltip key={stat.label}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border border-l-2 bg-card px-2 py-1.5",
                  "hover:shadow-sm hover:bg-accent/50 transition-all cursor-default",
                  stat.borderColor,
                )}
              >
                <div className={cn("rounded p-0.5 shrink-0", stat.iconBg)}>
                  <Icon className={cn("h-3 w-3", stat.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Daily value — primary, always shown */}
                  <p
                    className={cn(
                      "text-[11px] font-bold tabular-nums tracking-tight truncate leading-tight",
                      stat.isNegative && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {stat.value}
                  </p>

                  {/* Label row — inline WTD sum, or WTD avg when toggled */}
                  <div className="flex items-baseline gap-1 min-w-0">
                    <p className="text-[8px] font-medium text-muted-foreground truncate leading-tight shrink-0">
                      {stat.shortLabel}
                    </p>
                    {secondaryValue && (
                      <p
                        className={cn(
                          "text-[8px] font-medium tabular-nums truncate leading-tight min-w-0",
                          secondaryIsNegative
                            ? "text-red-500/80 dark:text-red-400/70"
                            : "text-muted-foreground/80",
                        )}
                      >
                        {secondaryValue}
                        <span className="ms-0.5 text-[6px] font-bold uppercase tracking-wide">
                          {secondaryLabel}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{stat.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
      </div>
      {hasWtdAvg && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowWtdAvg((v) => !v)}
              className={cn(
                "flex w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                showWtdAvg
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground/50 hover:bg-accent/50 hover:text-muted-foreground",
              )}
            >
              <Gauge className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {showWtdAvg
              ? "Showing WTD averages — click to switch back to WTD totals"
              : "Showing WTD totals — click to switch to WTD averages"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}