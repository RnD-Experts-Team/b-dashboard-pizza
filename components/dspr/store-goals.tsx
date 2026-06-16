"use client";

import { Target, DollarSign, Users, Gauge, Leaf, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DsprSales, DsprDay, DsprGoalMetric } from "@/types/dspr.types";

// ── Status style maps ─────────────────────────────────────────────────────────
type GoalStatus = "met" | "close" | "behind";

const statusColor: Record<GoalStatus, string> = {
  met:    "text-emerald-600 dark:text-emerald-400",
  close:  "text-amber-600  dark:text-amber-400",
  behind: "text-red-600    dark:text-red-400",
};
const statusBorder: Record<GoalStatus, string> = {
  met:    "border-l-emerald-500",
  close:  "border-l-amber-500",
  behind: "border-l-red-500",
};
const statusIconBg: Record<GoalStatus, string> = {
  met:    "bg-emerald-500/15 dark:bg-emerald-500/20",
  close:  "bg-amber-500/15  dark:bg-amber-500/20",
  behind: "bg-red-500/15    dark:bg-red-500/20",
};
const statusBarBg: Record<GoalStatus, string> = {
  met:    "bg-emerald-500",
  close:  "bg-amber-400",
  behind: "bg-red-500",
};

// ── Metric helpers ─────────────────────────────────────────────────────────────

function isHigherBetter(name: string): boolean {
  const n = name.toLowerCase();
  return !(n.includes("waste") || n.includes("labor"));
}

function getMetricVisuals(name: string): {
  icon: React.ComponentType<{ className?: string }>;
  shortLabel: string;
} {
  const n = name.toLowerCase();
  if (n.includes("sales"))    return { icon: DollarSign, shortLabel: "Sales" };
  if (n.includes("customer")) return { icon: Users,      shortLabel: "Customers" };
  if (n.includes("labor"))    return { icon: Gauge,      shortLabel: "Labor" };
  if (n.includes("waste"))    return { icon: Leaf,       shortLabel: "Waste" };
  if (n.includes("portal") || n.includes("on-time") || n.includes("on time"))
                              return { icon: Clock,      shortLabel: "On-Time" };
  return { icon: Target, shortLabel: name };
}

function getCurrentValue(
  name: string,
  sales?: DsprSales,
  day?: DsprDay,
): number | null {
  const n = name.toLowerCase();
  if (n.includes("sales"))    return sales?.this_week_total ?? null;
  if (n.includes("customer")) return day?.customer_count_week_to_date ?? null;
  if (n.includes("labor"))    return day?.labor_week_to_date ?? null;
  if (n.includes("waste")) {
    const w = day?.waste_week_to_date;
    if (!w) return null;
    return w.alta_inventory + w.normal;
  }
  if (n.includes("portal") || n.includes("on-time") || n.includes("on time"))
    return day?.portal?.week_to_date?.in_portal_on_time_percent ?? null;
  return null;
}

function formatValue(name: string, value: number): string {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("waste"))
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n.includes("portal") || n.includes("on-time") || n.includes("on time") || n.includes("labor"))
    return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

function formatGoalValue(name: string, goal: number): string {
  const formatted = formatValue(name, goal);
  return isHigherBetter(name) ? formatted : `< ${formatted}`;
}

function computePct(higherIsBetter: boolean, current: number, goal: number): number {
  if (goal === 0) return 0;
  if (higherIsBetter) return (current / goal) * 100;
  return current <= goal ? 100 : (goal / current) * 100;
}

function computeStatus(
  higherIsBetter: boolean,
  pct: number,
  current: number,
  goal: number,
): GoalStatus {
  if (higherIsBetter) {
    if (pct >= 100) return "met";
    if (pct >= 80)  return "close";
    return "behind";
  }
  if (current <= goal)        return "met";
  if (current <= goal * 1.1)  return "close";
  return "behind";
}

// ── Goal card ──────────────────────────────────────────────────────────────────
function GoalCard({
  metric,
  sales,
  day,
}: {
  metric: DsprGoalMetric;
  sales?: DsprSales;
  day?: DsprDay;
}) {
  const name = metric.metric_name;
  const goalValue = parseFloat(metric.goals[0]?.goal ?? "0");
  const hiB = isHigherBetter(name);
  const { icon: Icon, shortLabel } = getMetricVisuals(name);

  const rawCurrent = getCurrentValue(name, sales, day);

  let currentDisplay: string;
  let targetDisplay: string;
  let pct: number;
  let status: GoalStatus;

  if (rawCurrent === null) {
    currentDisplay = "—";
    targetDisplay  = formatGoalValue(name, goalValue);
    pct            = 0;
    status         = "behind";
  } else {
    currentDisplay = formatValue(name, rawCurrent);
    targetDisplay  = formatGoalValue(name, goalValue);
    pct            = computePct(hiB, rawCurrent, goalValue);
    status         = computeStatus(hiB, pct, rawCurrent, goalValue);
  }

  const barPct = Math.min(pct, 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-l-2 bg-card px-2 py-1.5",
            "hover:shadow-sm hover:bg-accent/50 transition-all cursor-default",
            statusBorder[status],
          )}
        >
          <div className={cn("rounded p-0.5 shrink-0", statusIconBg[status])}>
            <Icon className={cn("h-3 w-3", statusColor[status])} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[11px] font-bold tabular-nums tracking-tight truncate leading-tight",
                statusColor[status],
              )}
            >
              {currentDisplay}
            </p>
            <div className="flex items-baseline gap-1 min-w-0">
              <p className="text-[8px] font-medium text-muted-foreground truncate leading-tight shrink-0">
                {shortLabel}
              </p>
              <p className="text-[8px] font-medium tabular-nums truncate leading-tight text-muted-foreground/80 min-w-0">
                {targetDisplay}
                <span className="ms-0.5 text-[6px] font-bold uppercase tracking-wide">
                  goal
                </span>
              </p>
            </div>
            <div className="mt-0.5 h-0.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", statusBarBg[status])}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {name}: {currentDisplay} / {targetDisplay} — {pct.toFixed(1)}% of goal reached
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface StoreGoalsProps {
  sales?: DsprSales;
  day?: DsprDay;
  goalMetrics?: DsprGoalMetric[];
  className?: string;
}

export function StoreGoals({ sales, day, goalMetrics, className }: StoreGoalsProps) {
  if (!goalMetrics || goalMetrics.length === 0) return null;

  // Upselling is shown separately in the Upselling card — hide it here
  const visibleMetrics = goalMetrics.filter(
    (m) => !m.metric_name.toLowerCase().includes("upselling"),
  );

  if (visibleMetrics.length === 0) return null;

  const colClass =
    visibleMetrics.length === 1 ? "grid-cols-1" :
    visibleMetrics.length === 2 ? "grid-cols-2" :
    visibleMetrics.length === 3 ? "grid-cols-2 sm:grid-cols-3" :
    visibleMetrics.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
    "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={cn("grid gap-1", colClass, className)}>
      {visibleMetrics.map((metric) => (
        <GoalCard key={metric.metric_id} metric={metric} sales={sales} day={day} />
      ))}
    </div>
  );
}
