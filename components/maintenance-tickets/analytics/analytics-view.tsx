"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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

/** The At a glance icon tints -- class strings, not copy. */
const TINT_RED = "bg-red-500/10 text-red-600 dark:text-red-400";
const TINT_AMBER = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
const TINT_BLUE = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
const TINT_PURPLE = "bg-purple-500/10 text-purple-600 dark:text-purple-400";
const TINT_CYAN = "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";

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
  const t = useTranslations("maintenanceSystem.tickets.analytics");
  return (
    <div className="@container space-y-6">
      {errors.summary ? (
        <div className="rounded-xl border bg-card"><SectionError message={errors.summary} /></div>
      ) : (
        summary && <AnalyticsKpis summary={summary} rangeLabel={rangeLabel} />
      )}

      {summary && (
        <div className="grid gap-6 @4xl:grid-cols-2">
          <AnalyticsCard center icon={BarChart3} title={t("issuesReported")} description={t("issuesReportedDescription", { range: rangeLabel })}>
            <AnalyticsBarChart
              title={t("issuesReportedChart")}
              rows={summary.by_issue.map((r) => ({ label: r.title, value: r.count }))}
              valueLabel={t("unitIssues")}
            />
          </AnalyticsCard>
          <AnalyticsCard center icon={Gauge} title={t("openByStatus")} description={t("openByStatusDescription")}>
            <AnalyticsBarChart
              title={t("openByStatusChart")}
              rows={summary.by_status.map((r) => ({ label: r.label, value: r.count }))}
              valueLabel={t("unitIssues")}
            />
          </AnalyticsCard>
          <AnalyticsCard center icon={Hourglass} title={t("timeToClose")} description={t("timeToCloseDescription", { range: rangeLabel.toLowerCase() })}>
            <AnalyticsBarChart
              title={t("timeToCloseChart")}
              rows={summary.completion_by_issue.map((r) => ({ label: `${r.title} (${r.completed})`, value: r.avg_hours }))}
              valueLabel={t("unitHours")}
              format={formatHours}
            />
          </AnalyticsCard>
          <AnalyticsCard icon={StoreIcon} title={t("byStore")} description={t("byStoreDescription")} flush>
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
        title={t("ticketsSubmitted", { range: rangeLabel })}
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
        {t("clickTicketHint")}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  At a glance -- the details below, summed up in one line each               */
/* ────────────────────────────────────────────────────────────────────────── */

/** How long a ticket has waited: whole hours under two days, else whole days. */
function silenceOf(iso: string): { hours: number } | { days: number } {
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000));
  return h < 48 ? { hours: h } : { days: Math.floor(h / 24) };
}

function GlanceLine({ icon: Icon, tint, target, children }: { icon: LucideIcon; tint: string; target: string; children: ReactNode }) {
  const t = useTranslations("maintenanceSystem.tickets.analytics");
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
          {t("view")} <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
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
  const t = useTranslations("maintenanceSystem.tickets.analytics");
  const range = rangeLabel.toLowerCase();
  const created = summary?.created ?? [];
  const urgent = created.filter((t) => t.issues.some((i) => i.priority.value === "urgent")).length;
  const untouched = watchlist?.untouched ?? [];
  const oldest = untouched[0];
  const recurring = watchlist?.recurring ?? [];
  const top = recurring[0];
  const fixes = summary?.troubleshooting_fixes ?? [];
  const span = watchlist && watchlist.untouched_days !== 1 ? t("spanDays", { days: watchlist.untouched_days }) : t("spanHours");
  const wait = oldest ? silenceOf(oldest.last_change_at) : null;
  const b = (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>;
  const red = (chunks: ReactNode) => <strong className="font-semibold text-red-600 dark:text-red-400">{chunks}</strong>;

  return (
    <AnalyticsCard icon={ListChecks} title={t("glanceTitle")} description={t("glanceDescription")}>
      <ul className="-mx-3 -my-1.5 space-y-0.5">
        {summary && (
          <GlanceLine icon={FileText} tint={TINT_RED} target="new-tickets">
            {t.rich("glanceSubmitted", { count: created.length, range, urgent, b, red })}
          </GlanceLine>
        )}
        {watchlist && (
          <GlanceLine icon={Clock} tint={TINT_AMBER} target="untouched">
            {untouched.length === 0
              ? t("glanceUntouchedNone", { span })
              : t.rich("glanceUntouched", {
                  count: untouched.length,
                  span,
                  oldest: wait ? "yes" : "no",
                  wait: wait ? ("hours" in wait ? t("waitHours", { count: wait.hours }) : t("waitDays", { count: wait.days })) : "",
                  b,
                  red,
                })}
          </GlanceLine>
        )}
        {updated !== null && (
          <GlanceLine icon={History} tint={TINT_BLUE} target="what-changed">
            {t.rich("glanceUpdated", { count: updated, range, b })}
          </GlanceLine>
        )}
        {watchlist && (
          <GlanceLine icon={Repeat} tint={TINT_PURPLE} target="recurring">
            {recurring.length === 0
              ? t("glanceRecurringNone")
              : t.rich("glanceRecurring", {
                  count: recurring.length,
                  top: top ? "yes" : "no",
                  title: top?.title ?? "",
                  store: top?.store_number ?? "",
                  times: top?.count ?? 0,
                  days: watchlist.recurring_window.days,
                  b,
                })}
          </GlanceLine>
        )}
        {summary && (
          <GlanceLine icon={LifeBuoy} tint={TINT_CYAN} target="troubleshooting-fixes">
            {fixes.length === 0
              ? t("glanceFixesNone", { range })
              : t.rich("glanceFixes", { count: fixes.length, range, b })}
          </GlanceLine>
        )}
      </ul>
    </AnalyticsCard>
  );
}

/** The shape of the report while its first answer is on the way. */
export function AnalyticsSkeleton() {
  const t = useTranslations("maintenanceSystem.analytics");
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t("loading")}>
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
