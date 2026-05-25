"use client";

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
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  borderColor: string;
  tooltip: string;
  isNegative?: boolean;
};

export function DaySummaryStats({ day, className }: DaySummaryStatsProps) {
  const hasWtd = day.total_cash_sales_week_to_date !== undefined;

  const stats: StatConfig[] = [
    {
      label: "Total Cash Sales",
      shortLabel: "Cash Sales",
      value: fmt(day.total_cash_sales),
      rawValue: day.total_cash_sales,
      wtdValue: hasWtd ? fmt(day.total_cash_sales_week_to_date!) : undefined,
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
      icon: Trash2,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
      borderColor: "border-l-amber-500",
      tooltip: "Normal waste value",
      isNegative: true,
      isWtdNegative: true,
    },
    {
      label: "Waste (Alta)",
      shortLabel: "Waste Alta",
      value: fmt(day.waste.alta_inventory),
      rawValue: day.waste.alta_inventory,
      wtdValue: hasWtd ? fmt(day.waste_week_to_date!.alta_inventory) : undefined,
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/15 dark:bg-red-500/20",
      borderColor: "border-l-red-500",
      tooltip: "Alta inventory waste value",
      isNegative: true,
      isWtdNegative: true,
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1", className)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
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
                  {/* Daily value — primary */}
                  <p
                    className={cn(
                      "text-[11px] font-bold tabular-nums tracking-tight truncate leading-tight",
                      stat.isNegative && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {stat.value}
                  </p>

                  {/* Label row — with inline WTD when available */}
                  <div className="flex items-baseline gap-1 min-w-0">
                    <p className="text-[8px] font-medium text-muted-foreground truncate leading-tight shrink-0">
                      {stat.shortLabel}
                    </p>
                    {stat.wtdValue && (
                      <p
                        className={cn(
                          "text-[8px] font-medium tabular-nums truncate leading-tight min-w-0",
                          stat.isWtdNegative
                            ? "text-red-500/80 dark:text-red-400/70"
                            : "text-muted-foreground/80",
                        )}
                      >
                        {stat.wtdValue}
                        <span className="ms-0.5 text-[6px] font-bold uppercase tracking-wide">
                          wtd
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
  );
}