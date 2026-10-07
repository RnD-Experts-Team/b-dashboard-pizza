"use client";

import { AlarmClock, CheckCircle2, FilePlus2, Hourglass, Inbox, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnalyticsSummary } from "@/types/maintenance-analytics.types";

/**
 * The headline numbers. Stat tiles, not charts: each is one number, and the
 * number is the chart. Range figures and "right now" figures are labelled as
 * such, because they answer different questions.
 */
export function AnalyticsKpis({ summary }: { summary: AnalyticsSummary }) {
  const k = summary.kpis;
  const tiles: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
    { label: "Tickets opened", value: fmt(k.tickets_created), hint: `${fmt(k.issues_created)} issues reported in the range`, icon: FilePlus2 },
    { label: "Issues completed", value: fmt(k.issues_completed), hint: "in the range", icon: CheckCircle2 },
    {
      label: "Average time to complete",
      value: k.avg_hours_to_complete === null ? "—" : hours(k.avg_hours_to_complete),
      hint: "from reported to complete, for issues completed in the range",
      icon: Hourglass,
    },
    { label: "Open tickets", value: fmt(k.open_tickets), hint: "right now", icon: Inbox },
    {
      label: "Untouched",
      value: fmt(k.untouched_tickets),
      hint: `open and silent ${summary.untouched_days === 1 ? "a day" : `${summary.untouched_days} days`} or more, right now`,
      icon: AlarmClock,
    },
    {
      label: "Recurring issues",
      value: fmt(k.recurring_issues),
      hint: `${summary.recurring_window.min}+ tickets at one store in ${summary.recurring_window.days} days`,
      icon: Repeat,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(({ label, value, hint, icon: Icon }) => (
        <div key={label} className="rounded-lg border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString();
}

/** "5.2 h" under two days, "3.1 days" over -- a coordinator thinks in both. */
export function hours(h: number): string {
  if (h < 48) return `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
  return `${(h / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
}
