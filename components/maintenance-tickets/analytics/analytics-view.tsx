"use client";

import type { ReactNode } from "react";
import { ArrowDown, BarChart3, Clock, FileText, Gauge, History, Hourglass, Info, LifeBuoy, ListChecks, Repeat, Store as StoreIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { scrollToSection } from "@/lib/maintenance-tickets/scroll-to-section";
import { AnalyticsCard } from "./analytics-card";
import { AnalyticsKpis, hours } from "./analytics-kpis";
import { AnalyticsBarChart } from "./analytics-bar-chart";
import { ByStore, NewTickets, Recurring, SectionError, TroubleshootingFixes, Untouched, WhatChanged } from "./analytics-sections";
import type {
  AnalyticsActivityTicket,
  AnalyticsSummary,
  AnalyticsWatchlist,
} from "@/types/maintenance-analytics.types";

/** Module-level: a stable function keeps the chart from rebuilding each render. */
const formatHours = (v: number) => hours(v);

export interface AnalyticsViewProps {
  locale: string;
  /** "Yesterday", "Last 7 days", or "This range" for a custom one. */
  rangeLabel: string;
  summary: AnalyticsSummary | null;
  watchlist: AnalyticsWatchlist | null;
  activity: AnalyticsActivityTicket[];
  activityPage: { page: number; lastPage: number; total: number };
  errors: Partial<Record<"summary" | "activity" | "watchlist", string>>;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * The report, from the big picture down:
 *
 *   1. the numbers                 -- five cards
 *   2. the charts                  -- the same, by issue, status and store
 *   3. at a glance                 -- one line per table below, linking to it
 *   4. the details                 -- the tables, five rows a page
 *
 * No table grows past a page: a busy month pages instead of scrolling for ever.
 */
export function AnalyticsView({
  locale,
  rangeLabel,
  summary,
  watchlist,
  activity,
  activityPage,
  errors,
  isLoadingMore,
  onLoadMore,
}: AnalyticsViewProps) {
  return (
    <div className="@container space-y-6">
      {errors.summary ? (
        <div className="rounded-xl border bg-card"><SectionError message={errors.summary} /></div>
      ) : (
        summary && <AnalyticsKpis summary={summary} rangeLabel={rangeLabel} />
      )}

      {summary && (
        <div className="grid gap-6 @4xl:grid-cols-2">
          <AnalyticsCard center icon={BarChart3} title="Issues reported" description={`${rangeLabel}, by issue.`}>
            <AnalyticsBarChart
              title="Issues reported in the range, by issue"
              rows={summary.by_issue.map((r) => ({ label: r.title, value: r.count }))}
              valueLabel="issues"
            />
          </AnalyticsCard>
          <AnalyticsCard center icon={Gauge} title="Open work by status" description="Right now, across the selected stores.">
            <AnalyticsBarChart
              title="Open issues right now, by status"
              rows={summary.by_status.map((r) => ({ label: r.label, value: r.count }))}
              valueLabel="issues"
            />
          </AnalyticsCard>
          <AnalyticsCard center icon={Hourglass} title="Time to complete" description={`Average from report to complete, for issues completed ${rangeLabel.toLowerCase()}.`}>
            <AnalyticsBarChart
              title="Average time from reported to complete, by issue"
              rows={summary.completion_by_issue.map((r) => ({ label: `${r.title} (${r.completed})`, value: r.avg_hours }))}
              valueLabel="hours"
              format={formatHours}
            />
          </AnalyticsCard>
          <AnalyticsCard icon={StoreIcon} title="By store" description="Busiest first: opened and completed in this range, open right now." flush>
            <ByStore rows={summary.by_store} />
          </AnalyticsCard>
        </div>
      )}

      <AtAGlance
        rangeLabel={rangeLabel}
        summary={summary}
        watchlist={watchlist}
        updated={errors.activity ? null : activityPage.total}
      />

      <NewTickets
        locale={locale}
        title={`Tickets Submitted · ${rangeLabel}`}
        tickets={summary?.created ?? []}
        recurringDays={summary?.recurring_window.days ?? 90}
        error={errors.summary}
      />

      <Untouched
        locale={locale}
        tickets={watchlist?.untouched ?? []}
        days={watchlist?.untouched_days ?? 1}
        error={errors.watchlist}
      />

      <WhatChanged
        locale={locale}
        tickets={activity}
        total={activityPage.total}
        hasMore={activityPage.page < activityPage.lastPage}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
        error={errors.activity}
      />

      <Recurring
        items={watchlist?.recurring ?? []}
        min={watchlist?.recurring_window.min ?? 3}
        days={watchlist?.recurring_window.days ?? 90}
        error={errors.watchlist}
      />

      <TroubleshootingFixes
        locale={locale}
        fixes={summary?.troubleshooting_fixes ?? []}
        rangeLabel={rangeLabel}
        error={errors.summary}
      />

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4" aria-hidden="true" />
        Click a ticket number to open the ticket and follow up.
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  At a glance -- the details below, summed up in one line each               */
/* ────────────────────────────────────────────────────────────────────────── */

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function silenceOf(iso: string): string {
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000));
  return h < 48 ? `${h} hours` : `${Math.floor(h / 24)} days`;
}

function GlanceLine({ icon: Icon, tint, target, children }: { icon: LucideIcon; tint: string; target: string; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => scrollToSection(target)}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm">{children}</span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground sm:inline-flex">
          View <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}

function AtAGlance({
  rangeLabel,
  summary,
  watchlist,
  updated,
}: {
  rangeLabel: string;
  summary: AnalyticsSummary | null;
  watchlist: AnalyticsWatchlist | null;
  updated: number | null;
}) {
  const range = rangeLabel.toLowerCase();
  const created = summary?.created ?? [];
  const urgent = created.filter((t) => t.issues.some((i) => i.priority.value === "urgent")).length;
  const untouched = watchlist?.untouched ?? [];
  const oldest = untouched[0];
  const recurring = watchlist?.recurring ?? [];
  const top = recurring[0];
  const fixes = summary?.troubleshooting_fixes ?? [];
  const span = watchlist && watchlist.untouched_days !== 1 ? `${watchlist.untouched_days}+ days` : "24+ hours";

  return (
    <AnalyticsCard icon={ListChecks} title="At a glance" description="What the tables below hold. Click a line to jump to it.">
      <ul className="-mx-3 -my-1.5 space-y-0.5">
        {summary && (
          <GlanceLine icon={FileText} tint="bg-red-500/10 text-red-600 dark:text-red-400" target="new-tickets">
            <strong className="font-semibold">{plural(created.length, "ticket", "tickets")}</strong> submitted {range}
            {urgent > 0 && <>, <strong className="font-semibold text-red-600 dark:text-red-400">{urgent} urgent</strong></>}.
          </GlanceLine>
        )}
        {watchlist && (
          <GlanceLine icon={Clock} tint="bg-amber-500/10 text-amber-600 dark:text-amber-400" target="untouched">
            {untouched.length === 0 ? (
              <>Every open ticket has been updated in the last {span}.</>
            ) : (
              <>
                <strong className="font-semibold">{plural(untouched.length, "open ticket", "open tickets")}</strong> with no update for {span}
                {oldest && <>; the longest has waited <strong className="font-semibold text-red-600 dark:text-red-400">{silenceOf(oldest.last_change_at)}</strong></>}.
              </>
            )}
          </GlanceLine>
        )}
        {updated !== null && (
          <GlanceLine icon={History} tint="bg-blue-500/10 text-blue-600 dark:text-blue-400" target="what-changed">
            <strong className="font-semibold">{plural(updated, "ticket", "tickets")}</strong> updated {range}.
          </GlanceLine>
        )}
        {watchlist && (
          <GlanceLine icon={Repeat} tint="bg-purple-500/10 text-purple-600 dark:text-purple-400" target="recurring">
            {recurring.length === 0 ? (
              <>No issue keeps coming back.</>
            ) : (
              <>
                <strong className="font-semibold">{plural(recurring.length, "issue keeps", "issues keep")}</strong> coming back
                {top && <>; most often {top.title} at {top.store_number} ({top.count}× in {watchlist.recurring_window.days} days)</>}.
              </>
            )}
          </GlanceLine>
        )}
        {summary && (
          <GlanceLine icon={LifeBuoy} tint="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" target="troubleshooting-fixes">
            {fixes.length === 0 ? (
              <>No problem was fixed by troubleshooting {range}.</>
            ) : (
              <>
                <strong className="font-semibold">{plural(fixes.length, "problem", "problems")}</strong> fixed by troubleshooting {range}, with no ticket opened.
              </>
            )}
          </GlanceLine>
        )}
      </ul>
    </AnalyticsCard>
  );
}

/** The shape of the report while its first answer is on the way. */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the report">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
