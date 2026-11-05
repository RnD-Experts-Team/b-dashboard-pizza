"use client";

import { useState } from "react";
import {
  Banknote,
  Clock,
  DollarSign,
  Gauge,
  HandCoins,
  RotateCcw,
  Scale,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SalesMetrics } from "@/types/business-reports.types";
import { useSection } from "./report-context";
import { useFinalLabor, preferFinal } from "./final-labor";
import { fmt$, fmt$2, fmtNum, fmtPct, perStoreDay } from "./report-format";

interface Tile {
  label: string;
  /** The range total. */
  total: string;
  /** The same figure per store-day. */
  perDay: string;
  icon: LucideIcon;
  color: string;
  iconBg: string;
  border: string;
  tooltip: string;
  negative?: boolean;
}

const TILE_COUNT = 10;

function buildTiles(t: SalesMetrics, finalLabor: number | null): Tile[] {
  const labor = preferFinal(finalLabor, t.labor_percent);
  const avg = (v: number) => perStoreDay(v, t.store_days);
  return [
    {
      label: "Sales",
      total: fmt$(t.sales),
      perDay: fmt$(avg(t.sales)),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      border: "border-l-emerald-500",
      tooltip: "Royalty-obligation sales over the range",
    },
    {
      label: "Cash Sales",
      total: fmt$2(t.cash_sales),
      perDay: fmt$2(avg(t.cash_sales)),
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-500/15 dark:bg-green-500/20",
      border: "border-l-green-500",
      tooltip: "Total cash sales",
    },
    {
      label: "Deposit",
      total: fmt$2(t.deposit),
      perDay: fmt$2(avg(t.deposit)),
      icon: Banknote,
      color: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/15 dark:bg-blue-500/20",
      border: "border-l-blue-500",
      tooltip: "Cash/check bank deposits",
    },
    {
      label: "Refunds",
      total: `${fmtNum(t.refunded_orders)} / ${fmt$2(t.refund_amount)}`,
      perDay: `${avg(t.refunded_orders).toFixed(1)} / ${fmt$2(avg(t.refund_amount))}`,
      icon: RotateCcw,
      color: "text-orange-600 dark:text-orange-400",
      iconBg: "bg-orange-500/15 dark:bg-orange-500/20",
      border: "border-l-orange-500",
      tooltip: "Refunded orders / refunded amount",
      negative: t.refunded_orders > 0,
    },
    {
      label: "Customers",
      total: fmtNum(t.customer_count),
      perDay: avg(t.customer_count).toFixed(1),
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-violet-500/15 dark:bg-violet-500/20",
      border: "border-l-violet-500",
      tooltip: "Customers served",
    },
    {
      label: "Tips",
      total: fmt$2(t.total_tips),
      perDay: fmt$2(avg(t.total_tips)),
      icon: HandCoins,
      color: "text-teal-600 dark:text-teal-400",
      iconBg: "bg-teal-500/15 dark:bg-teal-500/20",
      border: "border-l-teal-500",
      tooltip: "Delivery + store tips",
    },
    {
      label: "Over/Short",
      total: fmt$2(t.over_short),
      perDay: fmt$2(avg(t.over_short)),
      icon: Scale,
      color: t.over_short < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      iconBg: t.over_short < 0 ? "bg-red-500/15 dark:bg-red-500/20" : "bg-emerald-500/15 dark:bg-emerald-500/20",
      border: t.over_short < 0 ? "border-l-red-500" : "border-l-emerald-500",
      tooltip: "Cash over (+) or short (−)",
      negative: t.over_short < 0,
    },
    {
      label: "Waste GW",
      total: fmt$2(t.waste_normal),
      perDay: fmt$2(avg(t.waste_normal)),
      icon: Trash2,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
      border: "border-l-amber-500",
      tooltip: "Waste recorded in the store system (cost)",
    },
    {
      label: "Waste Alta",
      total: fmt$2(t.waste_alta),
      perDay: fmt$2(avg(t.waste_alta)),
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/15 dark:bg-red-500/20",
      border: "border-l-red-500",
      tooltip: "Waste recorded in Alta inventory (cost)",
    },
    {
      label: labor.isFinal ? "Final Labor" : "Labor (est.)",
      total: fmtPct(labor.value),
      perDay: fmt$(avg(t.labor_cost)),
      icon: Clock,
      color: "text-sky-600 dark:text-sky-400",
      iconBg: "bg-sky-500/15 dark:bg-sky-500/20",
      border: "border-l-sky-500",
      tooltip: labor.isFinal
        ? "Final labor % (weekly, from Hiring) averaged over the range — per store-day: labor cost"
        : "Estimated labor % (labor cost ÷ sales) until the final labor loads — per store-day: labor cost",
    },
  ];
}

/**
 * The V1 day-summary strip for a range: each tile shows the range total, with
 * the per-store-day average beside it; the gauge button swaps the two.
 */
export function KpiStrip() {
  const { data } = useSection("sales");
  const finalLabor = useFinalLabor();
  const [perDayFirst, setPerDayFirst] = useState(false);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 xl:grid-cols-10">
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <Skeleton key={i} className="h-[42px] rounded-lg" />
        ))}
      </div>
    );
  }

  const tiles = buildTiles(data.totals, finalLabor?.overall ?? null);

  return (
    <div className="flex items-stretch gap-1" data-report-target="card" data-report-label="Range summary">
      <div className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-5 xl:grid-cols-10">
        {tiles.map((t) => {
          const Icon = t.icon;
          const [primary, secondary] = perDayFirst ? [t.perDay, t.total] : [t.total, t.perDay];
          return (
            <Tooltip key={t.label}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex cursor-default items-center gap-1.5 rounded-lg border border-l-2 bg-card px-2 py-1.5 transition-all hover:bg-accent/50 hover:shadow-sm",
                    t.border,
                  )}
                >
                  <div className={cn("shrink-0 rounded p-0.5", t.iconBg)}>
                    <Icon className={cn("h-3 w-3", t.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[11px] font-bold leading-tight tracking-tight tabular-nums",
                        t.negative && "text-red-600 dark:text-red-400",
                      )}
                    >
                      {primary}
                    </p>
                    <div className="flex min-w-0 items-baseline gap-1">
                      <p className="shrink-0 truncate text-[8px] font-medium leading-tight text-muted-foreground">
                        {t.label}
                      </p>
                      <p className="min-w-0 truncate text-[8px] font-medium leading-tight tabular-nums text-muted-foreground/80">
                        {secondary}
                        <span className="ms-0.5 text-[6px] font-bold uppercase tracking-wide">
                          {perDayFirst ? "total" : "/store-day"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setPerDayFirst((v) => !v)}
            aria-pressed={perDayFirst}
            aria-label="Switch between range totals and per store-day averages"
            className={cn(
              "flex w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              perDayFirst
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground/50 hover:bg-accent/50 hover:text-muted-foreground",
            )}
          >
            <Gauge className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {perDayFirst ? "Showing per store-day averages — click for range totals" : "Showing range totals — click for per store-day averages"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
