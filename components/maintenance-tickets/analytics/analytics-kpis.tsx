"use client";

import { CheckCircle2, Clock, FileText, Inbox, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrollToSection } from "@/lib/maintenance-tickets/scroll-to-section";
import type { AnalyticsSummary } from "@/types/maintenance-analytics.types";

interface Kpi {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Icon tile tint: the colour names the kind of number, the label says it. */
  tint: string;
  /** One short line under the number. */
  note: string;
  /** The table on the page this number counts. */
  target?: string;
}

/**
 * The headline numbers. Every card has the same three rows -- label and icon,
 * the number, one short line -- so the numbers line up across the row however
 * narrow the page gets. The grid follows the space it is given (a container
 * query), not the window: beside the sidebar the page is far narrower than
 * the screen.
 */
export function AnalyticsKpis({ summary, rangeLabel }: { summary: AnalyticsSummary; rangeLabel: string }) {
  const k = summary.kpis;
  const days = summary.untouched_days;

  const kpis: Kpi[] = [
    {
      label: "New tickets",
      value: k.tickets_created,
      icon: FileText,
      tint: "bg-red-500/10 text-red-600 dark:text-red-400",
      note: `${rangeLabel} · ${k.issues_created} ${k.issues_created === 1 ? "issue" : "issues"}`,
      target: "new-tickets",
    },
    {
      label: "No update",
      value: k.untouched_tickets,
      icon: Clock,
      tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      note: `Quiet ${days === 1 ? "24+ hours" : `${days}+ days`}`,
      target: "untouched",
    },
    {
      label: "Open",
      value: k.open_tickets,
      icon: Inbox,
      tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      note: "Tickets, right now",
    },
    {
      label: "Completed",
      value: k.issues_completed,
      icon: CheckCircle2,
      tint: "bg-green-500/10 text-green-600 dark:text-green-400",
      note: k.avg_hours_to_complete === null ? rangeLabel : `Avg. ${hours(k.avg_hours_to_complete)} to fix`,
    },
    {
      label: "Recurring",
      value: k.recurring_issues,
      icon: Repeat,
      tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      note: `Issues, ${summary.recurring_window.min}+ in ${summary.recurring_window.days} days`,
      target: "recurring",
    },
  ];

  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-3 @4xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", kpi.tint)}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 font-heading text-3xl font-semibold leading-none tabular-nums">{kpi.value.toLocaleString()}</p>
              <p className="mt-2 truncate text-xs text-muted-foreground" title={kpi.note}>{kpi.note}</p>
            </>
          );
          const shell = "block w-full rounded-xl border bg-card p-4 text-start shadow-sm";
          return kpi.target ? (
            <button
              key={kpi.label}
              type="button"
              onClick={() => scrollToSection(kpi.target!)}
              className={cn(shell, "cursor-pointer transition-colors duration-150 hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
              aria-label={`${kpi.label}: ${kpi.value}. Show the list`}
            >
              {body}
            </button>
          ) : (
            <div key={kpi.label} className={shell}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "5.2 h" under two days, "3.1 days" over -- a coordinator thinks in both. */
export function hours(h: number): string {
  if (h < 48) return `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
  return `${(h / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
}
