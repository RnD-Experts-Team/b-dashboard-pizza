"use client";

import {
  Banknote,
  Clock,
  Repeat,
  Timer,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { LaborSummary } from "@/types/labor.types";
import { SummaryTile } from "./labor-chart";
import { fmtCurrency, fmtHours, fmtNumber, fmtPercent } from "./labor-format";

/** Trailing averages are null only for a store with no data at all. */
const NO_DATA_YET = "No data yet";

interface LaborSummaryStripProps {
  summary: LaborSummary;
  /** Scrolls the Overtime section into view. */
  onJumpToOvertime: () => void;
}

export function LaborSummaryStrip({
  summary,
  onJumpToOvertime,
}: LaborSummaryStripProps) {
  const notable = summary.notable_departures_this_week;
  const hasNotable = notable > 0;

  const turnoverBaseline =
    summary.avg_weekly_turnover_rate_trailing_percent === null
      ? NO_DATA_YET
      : `· avg ${fmtPercent(summary.avg_weekly_turnover_rate_trailing_percent)}`;

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
      {/* People currently on staff — the page's own "home" color. */}
      <SummaryTile
        label="Headcount"
        value={fmtNumber(summary.headcount_current)}
        icon={Users}
        color="text-violet-600 dark:text-violet-400"
        iconBg="bg-violet-500/15 dark:bg-violet-500/20"
        borderColor="border-l-violet-500"
        tooltip="Active headcount as of the end of this business week"
      />

      {/* Growth — green, same convention as "money coming in" elsewhere. */}
      <SummaryTile
        label="New Hires"
        value={fmtNumber(summary.new_hires_this_week)}
        caption="· this week"
        icon={UserPlus}
        color="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-500/15 dark:bg-emerald-500/20"
        borderColor="border-l-emerald-500"
        tooltip="Employees hired or rehired at this store this week"
      />

      {/* Loss of staff — red, the same "needs attention" tone as departures/60h+. */}
      <SummaryTile
        label="Separations"
        value={fmtNumber(summary.separations_this_week)}
        caption="· this week"
        icon={UserMinus}
        color="text-rose-600 dark:text-rose-400"
        iconBg="bg-rose-500/15 dark:bg-rose-500/20"
        borderColor="border-l-rose-500"
        isNegative={summary.separations_this_week > 0}
        tooltip="Employees who resigned or were terminated this week"
      />

      {/* The one tile a manager most needs to notice — amber only lights up
          when there's actually something to flag. */}
      <SummaryTile
        label="Notable Departures"
        value={fmtNumber(notable)}
        caption={hasNotable ? "· above avg" : "· none"}
        icon={UserMinus}
        color={
          hasNotable
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
        }
        iconBg={hasNotable ? "bg-amber-500/15 dark:bg-amber-500/20" : "bg-muted"}
        borderColor={hasNotable ? "border-l-amber-500" : "border-l-border"}
        isNegative={hasNotable}
        tooltip="Separations this week whose own trailing performance was above the store average — worth a second look"
      />

      {/* A rate, not a good/bad signal by itself — orange keeps it distinct
          from the harder "loss" red of Separations. */}
      <SummaryTile
        label="Turnover Rate"
        value={fmtPercent(summary.turnover_rate_this_week_percent)}
        caption={turnoverBaseline}
        icon={Repeat}
        color="text-orange-600 dark:text-orange-400"
        iconBg="bg-orange-500/15 dark:bg-orange-500/20"
        borderColor="border-l-orange-500"
        tooltip="Separations ÷ average headcount this week, vs. the trailing average"
      />

      {/* Money — blue, the same "informational financial" tone used for
          deposits elsewhere in the app. */}
      <SummaryTile
        label="Avg Gross Pay"
        value={
          summary.avg_weekly_gross_pay_trailing === null
            ? NO_DATA_YET
            : fmtCurrency(summary.avg_weekly_gross_pay_trailing, 0)
        }
        caption={summary.avg_weekly_gross_pay_trailing === null ? undefined : "· trailing avg"}
        icon={Banknote}
        color="text-blue-600 dark:text-blue-400"
        iconBg="bg-blue-500/15 dark:bg-blue-500/20"
        borderColor="border-l-blue-500"
        tooltip="Average total gross pay per week over the trailing window"
      />

      {/* Time worked — teal, a distinct informational hue from pay. */}
      <SummaryTile
        label="Avg Hours"
        value={
          summary.avg_weekly_hours_trailing === null
            ? NO_DATA_YET
            : fmtHours(summary.avg_weekly_hours_trailing)
        }
        caption={summary.avg_weekly_hours_trailing === null ? undefined : "· trailing avg"}
        icon={Clock}
        color="text-teal-600 dark:text-teal-400"
        iconBg="bg-teal-500/15 dark:bg-teal-500/20"
        borderColor="border-l-teal-500"
        tooltip="Average total hours worked per week over the trailing window"
      />

      {/* Kept neutral (no yellow) — 40h+ isn't itself a violation, just a
          watch-list; only the 60h+ tile carries a warning color. */}
      <SummaryTile
        label="Over 40 Hrs"
        value={fmtNumber(summary.employees_over_40_hours)}
        caption="· view →"
        icon={Timer}
        color="text-muted-foreground"
        iconBg="bg-muted"
        borderColor="border-l-border"
        onClick={onJumpToOvertime}
        tooltip="Employees who worked more than 40 hours this week — tap to view"
      />
      <SummaryTile
        label="Over 60 Hrs"
        value={fmtNumber(summary.employees_over_60_hours)}
        caption="· view →"
        icon={Timer}
        color="text-rose-600 dark:text-rose-400"
        iconBg="bg-rose-500/15 dark:bg-rose-500/20"
        borderColor="border-l-rose-500"
        isNegative={summary.employees_over_60_hours > 0}
        onClick={onJumpToOvertime}
        tooltip="Employees at 60+ hours this week — tap to view"
      />
    </div>
  );
}
