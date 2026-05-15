"use client";

import { Target, DollarSign, Users, Gauge, Leaf, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Static goal definitions — replace with API / store data when ready ───────
type GoalStatus = "met" | "close" | "behind";

type GoalConfig = {
  label: string;
  shortLabel: string;
  current: string;
  target: string;
  pct: number;      // 0–100 (or >100 if over-target)
  status: GoalStatus;
  higherIsBetter: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  borderColor: string;
  tooltip: string;
};

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

// ── Static data ───────────────────────────────────────────────────────────────
const GOALS: GoalConfig[] = [
  {
    label:          "Daily Sales Goal",
    shortLabel:     "Sales",
    current:        "$6,120",
    target:         "$10,000",
    pct:            61.2,
    status:         "behind",
    higherIsBetter: true,
    icon:           DollarSign,
    color:          "text-emerald-600 dark:text-emerald-400",
    iconBg:         "bg-emerald-500/15 dark:bg-emerald-500/20",
    borderColor:    "border-l-emerald-500",
    tooltip:        "Daily sales goal: $10,000 target",
  },
  {
    label:          "Customer Count Goal",
    shortLabel:     "Customers",
    current:        "187",
    target:         "200",
    pct:            93.5,
    status:         "close",
    higherIsBetter: true,
    icon:           Users,
    color:          "text-violet-600 dark:text-violet-400",
    iconBg:         "bg-violet-500/15 dark:bg-violet-500/20",
    borderColor:    "border-l-violet-500",
    tooltip:        "Customer count goal: 200 customers",
  },
  {
    label:          "Labor % Goal",
    shortLabel:     "Labor",
    current:        "22%",
    target:         "< 24%",
    pct:            100,
    status:         "met",
    higherIsBetter: false,
    icon:           Gauge,
    color:          "text-sky-600 dark:text-sky-400",
    iconBg:         "bg-sky-500/15 dark:bg-sky-500/20",
    borderColor:    "border-l-sky-500",
    tooltip:        "Labor percentage goal: keep below 24%",
  },
  {
    label:          "Waste Budget",
    shortLabel:     "Waste",
    current:        "$87",
    target:         "< $100",
    pct:            100,
    status:         "met",
    higherIsBetter: false,
    icon:           Leaf,
    color:          "text-teal-600 dark:text-teal-400",
    iconBg:         "bg-teal-500/15 dark:bg-teal-500/20",
    borderColor:    "border-l-teal-500",
    tooltip:        "Daily waste budget: keep below $100",
  },
  {
    label:          "On-Time Delivery",
    shortLabel:     "On-Time",
    current:        "85%",
    target:         "> 90%",
    pct:            85,
    status:         "behind",
    higherIsBetter: true,
    icon:           Clock,
    color:          "text-orange-600 dark:text-orange-400",
    iconBg:         "bg-orange-500/15 dark:bg-orange-500/20",
    borderColor:    "border-l-orange-500",
    tooltip:        "On-time delivery goal: above 90%",
  },
];

interface StoreGoalsProps {
  className?: string;
}

export function StoreGoals({ className }: StoreGoalsProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1", className)}>
      {GOALS.map((goal) => {
        const Icon = goal.icon;
        const barPct = Math.min(goal.pct, 100);
        return (
          <Tooltip key={goal.label}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border border-l-2 bg-card px-2 py-1.5",
                  "hover:shadow-sm hover:bg-accent/50 transition-all cursor-default",
                  statusBorder[goal.status],
                )}
              >
                <div className={cn("rounded p-0.5 shrink-0", statusIconBg[goal.status])}>
                  <Icon className={cn("h-3 w-3", statusColor[goal.status])} />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Current value — primary */}
                  <p
                    className={cn(
                      "text-[11px] font-bold tabular-nums tracking-tight truncate leading-tight",
                      statusColor[goal.status],
                    )}
                  >
                    {goal.current}
                  </p>

                  {/* Label + target */}
                  <div className="flex items-baseline gap-1 min-w-0">
                    <p className="text-[8px] font-medium text-muted-foreground truncate leading-tight shrink-0">
                      {goal.shortLabel}
                    </p>
                    <p className="text-[8px] font-medium tabular-nums truncate leading-tight text-muted-foreground/80 min-w-0">
                      {goal.target}
                      <span className="ms-0.5 text-[6px] font-bold uppercase tracking-wide">
                        goal
                      </span>
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-0.5 h-0.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", statusBarBg[goal.status])}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {goal.tooltip} — {goal.pct.toFixed(1)}% of goal reached
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
