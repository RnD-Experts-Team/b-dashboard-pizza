"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlarmClock, BarChart3, FilePlus2, History, Repeat, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/shared/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useMaintenanceAnalytics } from "@/lib/hooks/use-maintenance-analytics";
import { daysToInstants, presetDays } from "@/lib/maintenance-tickets/local-range";
import { formatDateOnly } from "@/lib/utils/date-display";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import type { StoreSelection } from "@/types/business-reports.types";
import { AnalyticsControls } from "@/components/maintenance-tickets/analytics/analytics-controls";
import { AnalyticsKpis, hours } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { AnalyticsBarChart } from "@/components/maintenance-tickets/analytics/analytics-bar-chart";
import {
  ByStore,
  NewTickets,
  Recurring,
  SectionError,
  Untouched,
  WhatChanged,
} from "@/components/maintenance-tickets/analytics/analytics-sections";

/** Module-level: a stable function keeps the chart from rebuilding each render. */
const formatHours = (v: number) => hours(v);

/**
 * Maintenance analytics -- "a one-stop shop, one look, know it all".
 *
 * Opens on YESTERDAY (the viewer's yesterday) across every store the viewer
 * can see, and answers, top to bottom: the numbers; what was done on which
 * tickets; what was filed; what nobody has touched; what keeps coming back;
 * and the same in charts. One page, no tabs -- in this area nothing hides
 * behind a click.
 */
export default function MaintenanceAnalyticsPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const overviewStores = useAuthStore((s) => s.overviewStores);

  // The API speaks store NUMBERS ("03795-00001"), so that is the option id.
  const storeOptions: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive && s.storeId)
        .map((s) => ({ id: s.storeId as string, name: s.name ? `${s.storeId} · ${s.name}` : (s.storeId as string) })),
    [overviewStores],
  );

  const initial = useMemo(() => presetDays("yesterday"), []);
  const [selection, setSelection] = useState<StoreSelection>("all");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);

  const {
    summary,
    watchlist,
    activity,
    activityPage,
    errors,
    isLoading,
    isLoadingMore,
    loadedParams,
    load,
    loadMoreActivity,
  } = useMaintenanceAnalytics();

  const stores = useMemo(
    () => (selection === "all" ? storeOptions.map((o) => o.id) : selection),
    [selection, storeOptions],
  );

  const reload = useCallback(() => {
    const range = daysToInstants(startDate, endDate);
    if (!range || stores.length === 0) return;
    void load({ stores, from: range.from, to: range.to });
  }, [startDate, endDate, stores, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rangeText =
    startDate === endDate
      ? formatDateOnly(startDate, "EEEE, MMM d, yyyy")
      : `${formatDateOnly(startDate, "MMM d")} – ${formatDateOnly(endDate, "MMM d, yyyy")}`;
  const scopeText = selection === "all" ? `All ${storeOptions.length} stores` : `${stores.length} store${stores.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance Analytics" description={`${rangeText} · ${scopeText}`}>
        <AnalyticsControls
          storeOptions={storeOptions}
          selection={selection}
          onSelectionChange={setSelection}
          startDate={startDate}
          endDate={endDate}
          onRangeChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          disabled={isLoading}
        />
      </PageHeader>

      {stores.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <StoreIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Pick at least one store</p>
        </div>
      )}

      {stores.length > 0 && isLoading && !loadedParams && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {stores.length > 0 && loadedParams && (
        <div className={isLoading ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
          {errors.summary && <SectionError message={errors.summary} />}
          {summary && <AnalyticsKpis summary={summary} />}

          <PageSection rank="primary" accent={1} icon={History} title="What changed"
            description="Everything done on a ticket in the range, ticket by ticket -- most recently active first.">
            {errors.activity ? (
              <SectionError message={errors.activity} />
            ) : (
              <WhatChanged
                locale={locale}
                tickets={activity}
                total={activityPage.total}
                hasMore={activityPage.page < activityPage.lastPage}
                isLoadingMore={isLoadingMore}
                onLoadMore={() => void loadMoreActivity()}
              />
            )}
          </PageSection>

          <PageSection rank="secondary" icon={FilePlus2} title="New tickets"
            description="Opened in the range. A badge marks an issue that keeps coming back at that store.">
            {errors.summary ? <SectionError message={errors.summary} /> : summary && (
              <NewTickets locale={locale} tickets={summary.created} recurringDays={summary.recurring_window.days} />
            )}
          </PageSection>

          <PageSection rank="secondary" icon={AlarmClock} title="Untouched"
            description={`Open tickets nobody has done anything on for ${watchlist?.untouched_days === 1 || !watchlist ? "a day" : `${watchlist.untouched_days} days`} or more -- right now, longest silence first.`}>
            {errors.watchlist ? <SectionError message={errors.watchlist} /> : watchlist && (
              <Untouched locale={locale} tickets={watchlist.untouched} days={watchlist.untouched_days} />
            )}
          </PageSection>

          <PageSection rank="secondary" icon={Repeat} title="Recurring issues"
            description={watchlist
              ? `The same issue on ${watchlist.recurring_window.min} or more tickets at one store in the ${watchlist.recurring_window.days} days up to the end of the range.`
              : undefined}>
            {errors.watchlist ? <SectionError message={errors.watchlist} /> : watchlist && (
              <Recurring items={watchlist.recurring} min={watchlist.recurring_window.min} days={watchlist.recurring_window.days} />
            )}
          </PageSection>

          {summary && (
            <PageSection rank="tertiary" icon={BarChart3} title="In charts">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Issues reported, by issue</p>
                  <AnalyticsBarChart
                    title="Issues reported in the range, by issue"
                    rows={summary.by_issue.map((r) => ({ label: r.title, value: r.count }))}
                    valueLabel="issues"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Open work right now, by status</p>
                  <AnalyticsBarChart
                    title="Open issues right now, by status"
                    rows={summary.by_status.map((r) => ({ label: r.label, value: r.count }))}
                    valueLabel="issues"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Average time to complete, by issue</p>
                  <AnalyticsBarChart
                    title="Average time from reported to complete, by issue, for issues completed in the range"
                    rows={summary.completion_by_issue.map((r) => ({ label: `${r.title} (${r.completed})`, value: r.avg_hours }))}
                    valueLabel="hours"
                    format={formatHours}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">By store</p>
                  <ByStore rows={summary.by_store} />
                </div>
              </div>
            </PageSection>
          )}
        </div>
      )}
    </div>
  );
}
