"use client";

import { useState } from "react";
import { UserMinus, ChevronDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { V1Empty, V1Metric, V1StackedBar } from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type {
  LaborImpactSnapshot,
  LaborTurnover as LaborTurnoverData,
  LaborTurnoverEvent,
} from "@/types/labor.types";
import { LaborCard } from "./labor-chart";
import {
  DASH,
  fmtCurrency,
  fmtHours,
  fmtNumber,
  fmtPercent,
  reasonLabel,
} from "./labor-format";

/** Exactly what `summary.notable_departures_this_week` counts. */
export function isNotableDeparture(snap: LaborImpactSnapshot): boolean {
  return snap.above_average_hours === true || snap.above_average_performance === true;
}

/** Employee value vs. store average over the same window, side by side. */
function ComparisonRow({
  label,
  employee,
  store,
  above,
}: {
  label: string;
  employee: string;
  store: string;
  /** Tri-state — `null` means "not enough data", which must read neutral. */
  above: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
        <span
          className={cn(
            "font-semibold",
            above === true && "text-emerald-600 dark:text-emerald-400",
            above === false && "text-muted-foreground",
          )}
        >
          {employee}
        </span>
        <span className="text-muted-foreground/60">vs</span>
        <span className="text-muted-foreground">{store}</span>
        {above === true && (
          <Badge
            variant="secondary"
            className="h-4 px-1 text-[9px] font-semibold"
          >
            above avg
          </Badge>
        )}
      </span>
    </div>
  );
}

function EventRow({ event }: { event: LaborTurnoverEvent }) {
  const [open, setOpen] = useState(false);
  const snap = event.impact_snapshot;
  const notable = isNotableDeparture(snap);

  return (
    <li className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-1.5 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
          {event.name ?? `Employee #${event.employee_id}`}
        </span>
        {notable && (
          <Badge className="h-4 shrink-0 gap-0.5 border-amber-500/40 bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            Notable
          </Badge>
        )}
        <Badge
          variant={event.type === "voluntary" ? "secondary" : "outline"}
          className="h-4 shrink-0 px-1 text-[9px] capitalize"
        >
          {event.type === "voluntary" ? "Resigned" : "Terminated"}
        </Badge>
        <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
          {event.effective_date}
        </span>
      </button>

      {open && (
        <div className="mb-1.5 ms-5 rounded-md border border-border/50 bg-background/55 px-2 py-1.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              Reason:{" "}
              <span className="font-medium text-foreground">
                {reasonLabel(event.reason, event.reason_matched)}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Tenure at exit:{" "}
              <span className="font-medium text-foreground">
                {event.tenure_days === null
                  ? DASH
                  : `${fmtNumber(event.tenure_days)} days`}
              </span>
            </span>
          </div>

          <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Last {snap.lookback_days} days — employee vs. store average
          </p>
          <ComparisonRow
            label="Avg weekly hours"
            employee={fmtHours(snap.avg_weekly_hours)}
            store={fmtHours(snap.store_avg_weekly_hours_same_period)}
            above={snap.above_average_hours}
          />
          <ComparisonRow
            label="Avg performance score"
            employee={fmtNumber(snap.avg_performance_score, 2)}
            store={fmtNumber(snap.store_avg_performance_score_same_period, 2)}
            above={snap.above_average_performance}
          />
          {/* No store-average counterpart exists for pay — show it plainly
              rather than faking a comparison. */}
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              Avg hourly pay
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums">
              {fmtCurrency(snap.avg_hourly_pay)}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

export function LaborTurnover({ turnover }: { turnover: LaborTurnoverData }) {
  const segments = turnover.by_reason
    .filter((r) => r.count > 0)
    .map((r, i) => ({
      label: `${reasonLabel(r.reason)} (${r.count})`,
      value: r.count,
      color:
        r.type === "voluntary"
          ? ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"][i % 4]
          : ["#f43f5e", "#fb7185", "#fda4af", "#fecdd3"][i % 4],
    }));

  return (
    <LaborCard title="Turnover" icon={UserMinus}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <V1Metric
            label="Separations"
            value={fmtNumber(turnover.separations_count)}
            size="lg"
          />
          <V1Metric label="Voluntary" value={fmtNumber(turnover.voluntary_count)} />
          <V1Metric
            label="Involuntary"
            value={fmtNumber(turnover.involuntary_count)}
          />
          <V1Metric
            label="Rate"
            value={fmtPercent(turnover.turnover_rate_percent)}
          />
        </div>

        {segments.length > 0 && (
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              By Reason
            </p>
            <V1StackedBar segments={segments} />
          </div>
        )}

        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Departures
          </p>
          {turnover.events.length === 0 ? (
            <V1Empty icon={UserMinus}>No separations this week</V1Empty>
          ) : (
            <ul>
              {turnover.events.map((e) => (
                <EventRow key={`${e.employee_id}-${e.effective_date}`} event={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </LaborCard>
  );
}
