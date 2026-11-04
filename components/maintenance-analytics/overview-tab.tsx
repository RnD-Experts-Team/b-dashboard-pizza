"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Store as StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMaintenanceAnalytics } from "@/lib/hooks/use-maintenance-analytics";
import { daysToInstants, matchPreset, RANGE_PRESETS } from "@/lib/maintenance-tickets/local-range";
import { AnalyticsSkeleton, AnalyticsView } from "@/components/maintenance-tickets/analytics/analytics-view";
import type { AnalyticsFilters } from "./use-analytics-filters";

/**
 * Overview: the existing ticket analytics (KPIs, charts, what changed, the
 * watch list), now on the new statuses, driven by the page's shared filters.
 * The summary API needs an explicit store list, so "All stores" sends every
 * store the viewer can see; the range goes as the viewer's local midnights.
 */
export function OverviewTab({ locale, filters }: { locale: string; filters: AnalyticsFilters }) {
  const t = useTranslations("maintenanceSystem.analytics");
  const { summary, watchlist, activity, activityPage, errors, isLoading, isLoadingMore, loadedParams, load, loadMoreActivity } =
    useMaintenanceAnalytics();

  const allStores = useMemo(() => filters.storeOptions.map((o) => o.value), [filters.storeOptions]);
  const stores = filters.stores.length ? filters.stores : allStores;
  const storesKey = stores.join(",");

  const reload = useCallback(() => {
    const range = daysToInstants(filters.from, filters.to);
    if (!range || storesKey === "") return;
    void load({ stores: storesKey.split(","), from: range.from, to: range.to });
  }, [filters.from, filters.to, storesKey, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <StoreIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("noStores")}</p>
      </div>
    );
  }

  if (!loadedParams) return <AnalyticsSkeleton />;

  const preset = matchPreset(filters.from, filters.to);
  const rangeLabel = RANGE_PRESETS.find((p) => p.id === preset)?.label ?? "This range";

  return (
    <div className={isLoading ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
      <AnalyticsView
        // A new report starts every table back on its first page.
        key={JSON.stringify(loadedParams)}
        locale={locale}
        rangeLabel={rangeLabel}
        summary={summary}
        watchlist={watchlist}
        activity={activity}
        activityPage={activityPage}
        errors={errors}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => void loadMoreActivity()}
      />
    </div>
  );
}
