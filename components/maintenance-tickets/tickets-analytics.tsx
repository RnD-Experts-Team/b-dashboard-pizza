"use client";

import { useState } from "react";
import {
  ListChecks,
  Clock,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtDate, fmtNum } from "@/components/dspr/wbr-format";
import { statusAccent } from "./status-accent";
import type { TicketsAnalytics, TicketsErrorState } from "@/types/maintenance-tickets.types";

interface TicketsAnalyticsPanelProps {
  analytics: TicketsAnalytics | null;
  isLoading: boolean;
  error: TicketsErrorState | null;
}

/** Never divide/format client-side when sample_size is 0 — avg_hours is already null in that case. */
function formatHours(avgHours: number | null): string {
  return avgHours == null ? "—" : `${avgHours.toFixed(1)}h`;
}

/** One headline metric cell inside the top strip. */
function StatCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 bg-card px-3 py-2">
      <p className="flex items-start gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
        <Icon className="mt-px h-3 w-3 shrink-0" />
        <span className="min-w-0">{label}</span>
      </p>
      <p className="mt-0.5 font-heading text-lg font-semibold leading-none tabular-nums sm:text-xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}

export function TicketsAnalyticsPanel({ analytics, isLoading, error }: TicketsAnalyticsPanelProps) {
  // Expanded by default; collapsing is a per-session UI preference only.
  const [open, setOpen] = useState(true);

  if (isLoading && !analytics) {
    return <Skeleton className="h-40 w-full rounded-xl sm:h-[168px]" />;
  }

  if (!analytics) {
    // Non-blocking — the ticket table below renders independently either way.
    if (error) {
      return (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load analytics: {error.message}
        </p>
      );
    }
    return null;
  }

  const { issues, durations, avgTicketsPerWeek } = analytics;
  const total = issues.total;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Collapse toggle — keeps a total-issues summary visible when closed */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-start transition-colors hover:bg-muted/50"
      >
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Analytics
        </span>
        {!open && (
          <span className="text-[11px] text-muted-foreground/70">
            · {fmtNum(total)} issues
          </span>
        )}
        <ChevronDown
          className={cn(
            "ms-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* Headline metrics — hairline-separated cells via gap-px over the border colour */}
          <div className="grid grid-cols-1 gap-px border-t bg-border min-[400px]:grid-cols-2 sm:grid-cols-4">
            <StatCell icon={ListChecks} label="Total Issues" value={fmtNum(total)} />
            <StatCell
              icon={Clock}
              label="Avg Time to Next Status"
              value={formatHours(durations.pendingToNextStatus.avgHours)}
              hint={`${durations.pendingToNextStatus.sampleSize} sampled`}
            />
            <StatCell
              icon={CheckCircle2}
              label="Avg Time to Complete / Cancelled"
              value={formatHours(durations.timeToCompleteOrCancelled.avgHours)}
              hint={`${durations.timeToCompleteOrCancelled.sampleSize} sampled`}
            />
            <StatCell
              icon={CalendarDays}
              label="Avg Tickets / Week"
              value={avgTicketsPerWeek.value.toFixed(2)}
              hint={`All-time · ${fmtDate(avgTicketsPerWeek.spanStart)} – ${fmtDate(avgTicketsPerWeek.spanEnd)}`}
            />
          </div>

          {/* Status breakdown — colour-matched to the table's status badges */}
          {issues.statusBreakdown.length > 0 && (
            <div className="border-t bg-muted/30 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status Breakdown
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {issues.statusBreakdown.map((b) => {
                  const accent = statusAccent(b.status);
                  const isZero = b.count === 0;
                  return (
                    <div
                      key={b.status}
                      className={cn("rounded-lg border bg-card", isZero && "opacity-55")}
                      title={`${b.label}: ${b.count} of ${total}`}
                    >
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <span className={cn("h-3.5 w-1 shrink-0 rounded-full", accent.bar)} />
                        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {b.label}
                        </span>
                        <span
                          className={cn(
                            "ms-auto shrink-0 font-heading text-base font-semibold tabular-nums",
                            isZero ? "text-muted-foreground" : accent.text
                          )}
                        >
                          {fmtNum(b.count)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
