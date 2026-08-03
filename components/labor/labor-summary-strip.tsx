"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LaborSummary } from "@/types/labor.types";
import { fmtCurrency, fmtHours, fmtNumber, fmtPercent } from "./labor-format";

/** Trailing averages are null only for a store with no data at all. */
const NO_DATA_YET = "No data yet";

/**
 * A KPI tile for the header strip — two rows (label, value), never three.
 * The caption that used to sit on its own line under the value (e.g. "this
 * week", "trailing average") now sits inline right next to it instead.
 */
function SummaryTile({
  label,
  value,
  caption,
  accent,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-lg border border-border/50 bg-background/55 px-2.5 py-1.5 backdrop-blur-sm",
        className,
      )}
    >
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="flex items-baseline gap-1 truncate">
        <span className={cn("text-xl font-bold leading-tight tabular-nums", accent)}>
          {value}
        </span>
        {caption && (
          <span className="truncate text-[9.5px] font-medium leading-tight text-muted-foreground/80">
            {caption}
          </span>
        )}
      </p>
    </div>
  );
}

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
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryTile label="Headcount" value={fmtNumber(summary.headcount_current)} />

      <SummaryTile
        label="New Hires"
        value={fmtNumber(summary.new_hires_this_week)}
        caption="· this week"
        accent={summary.new_hires_this_week > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined}
      />

      <SummaryTile
        label="Separations"
        value={fmtNumber(summary.separations_this_week)}
        caption="· this week"
        accent={summary.separations_this_week > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
      />

      {/* The one tile a manager most needs to notice. */}
      <SummaryTile
        label={
          <span className="flex items-center gap-1">
            {hasNotable && (
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            Notable Departures
          </span>
        }
        value={fmtNumber(notable)}
        caption={hasNotable ? "· above-average performers left" : "· none this week"}
        accent={hasNotable ? "text-amber-600 dark:text-amber-400" : undefined}
        className={cn(
          hasNotable &&
            "border-amber-500/50 bg-amber-500/10 dark:border-amber-400/40 dark:bg-amber-400/10",
        )}
      />

      <SummaryTile
        label="Turnover Rate"
        value={fmtPercent(summary.turnover_rate_this_week_percent)}
        caption={turnoverBaseline}
      />

      <SummaryTile
        label="Avg Weekly Gross Pay"
        value={
          summary.avg_weekly_gross_pay_trailing === null
            ? NO_DATA_YET
            : fmtCurrency(summary.avg_weekly_gross_pay_trailing, 0)
        }
        caption={summary.avg_weekly_gross_pay_trailing === null ? undefined : "· trailing avg"}
      />
      <SummaryTile
        label="Avg Weekly Hours"
        value={
          summary.avg_weekly_hours_trailing === null
            ? NO_DATA_YET
            : fmtHours(summary.avg_weekly_hours_trailing)
        }
        caption={summary.avg_weekly_hours_trailing === null ? undefined : "· trailing avg"}
      />

      <button type="button" onClick={onJumpToOvertime} className="text-left">
        <SummaryTile
          label="Over 40 Hours"
          value={fmtNumber(summary.employees_over_40_hours)}
          caption="· view →"
          className="h-full transition-colors hover:border-border hover:bg-background"
        />
      </button>
      <button type="button" onClick={onJumpToOvertime} className="text-left">
        <SummaryTile
          label="Over 60 Hours"
          value={fmtNumber(summary.employees_over_60_hours)}
          caption="· view →"
          accent={
            summary.employees_over_60_hours > 0
              ? "text-rose-600 dark:text-rose-400"
              : undefined
          }
          className="h-full transition-colors hover:border-border hover:bg-background"
        />
      </button>
    </div>
  );
}
