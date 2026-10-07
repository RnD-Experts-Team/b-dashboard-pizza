"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCw, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useMaintenanceAnalytics } from "@/lib/hooks/use-maintenance-analytics";
import { daysToInstants, matchPreset, presetDays, RANGE_PRESETS, viewerTimeZone } from "@/lib/maintenance-tickets/local-range";
import { formatDateOnly } from "@/lib/utils/date-display";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import type { StoreSelection } from "@/types/business-reports.types";
import { AnalyticsControls } from "@/components/maintenance-tickets/analytics/analytics-controls";
import { AnalyticsSkeleton, AnalyticsView } from "@/components/maintenance-tickets/analytics/analytics-view";

/**
 * Maintenance analytics -- "a one-stop shop, one look, know it all".
 *
 * Opens on YESTERDAY (the viewer's yesterday) across every store the viewer
 * can see. This file only picks the days and stores and loads the report;
 * AnalyticsView lays it out.
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

  const { summary, watchlist, activity, activityPage, errors, isLoading, isLoadingMore, loadedParams, load, loadMoreActivity } =
    useMaintenanceAnalytics();

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

  const preset = matchPreset(startDate, endDate);
  const presetLabel = RANGE_PRESETS.find((p) => p.id === preset)?.label;
  const days =
    startDate === endDate
      ? formatDateOnly(startDate, "EEEE, MMMM d")
      : `${formatDateOnly(startDate, "MMM d")} to ${formatDateOnly(endDate, "MMM d, yyyy")}`;
  const zone = viewerTimeZone();
  const scope = selection === "all" ? `all ${storeOptions.length} stores` : `${stores.length} ${stores.length === 1 ? "store" : "stores"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Analytics"
        description={`${presetLabel ? `${presetLabel}, ` : ""}${days} · ${scope}${zone ? ` · days in your time zone (${zone})` : ""}`}
      >
        <Button variant="outline" onClick={reload} disabled={isLoading}>
          <RefreshCw className={isLoading ? "me-2 h-4 w-4 animate-spin" : "me-2 h-4 w-4"} aria-hidden="true" />
          Refresh
        </Button>
      </PageHeader>

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
        isUpdating={isLoading && loadedParams !== null}
      />

      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <StoreIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Pick at least one store to see its report.</p>
        </div>
      ) : !loadedParams ? (
        <AnalyticsSkeleton />
      ) : (
        <div className={isLoading ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
          <AnalyticsView
            // A new report starts every table back on its first page.
            key={JSON.stringify(loadedParams)}
            locale={locale}
            rangeLabel={presetLabel ?? "This range"}
            summary={summary}
            watchlist={watchlist}
            activity={activity}
            activityPage={activityPage}
            errors={errors}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void loadMoreActivity()}
          />
        </div>
      )}
    </div>
  );
}
