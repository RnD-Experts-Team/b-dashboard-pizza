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
  Star,
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
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  borderColor: string;
  tooltip: string;
  isNegative?: boolean;
};

export function DaySummaryStats({ day, className }: DaySummaryStatsProps) {
  const stats: StatConfig[] = [
    {
      label: "Store Score",
      shortLabel: "Store Score",
      value: "88 %", // Placeholder value
      rawValue: 0,
      icon: Star,
      color: "text-yellow-600 dark:text-yellow-400",
      iconBg: "bg-yellow-500/15 dark:bg-yellow-500/20",
      borderColor: "border-l-yellow-500",
      tooltip: "Store score based on various performance metrics",
      isNegative: false,
    },
    {
      label: "Total Cash Sales",
      shortLabel: "Cash Sales",
      value: fmt(day.total_cash_sales),
      rawValue: day.total_cash_sales,
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
      icon: Trash2,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
      borderColor: "border-l-amber-500",
      tooltip: "Normal waste value",
      isNegative: true,
    },
    {
      label: "Waste (Alta)",
      shortLabel: "Waste Alta",
      value: fmt(day.waste.alta_inventory),
      rawValue: day.waste.alta_inventory,
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/15 dark:bg-red-500/20",
      borderColor: "border-l-red-500",
      tooltip: "Alta inventory waste value",
      isNegative: true,
    },
     
  ];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-1", className)}>
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
                  <p
                    className={cn(
                      "text-[11px] font-bold tabular-nums tracking-tight truncate leading-tight",
                      stat.isNegative && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[8px] font-medium text-muted-foreground truncate leading-tight">
                    {stat.shortLabel}
                  </p>
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
