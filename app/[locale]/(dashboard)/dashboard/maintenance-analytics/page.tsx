"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { formatDateOnly } from "@/lib/utils/date-display";
import { viewerTimeZone } from "@/lib/maintenance-tickets/local-range";
import { AnalyticsFilterBar } from "@/components/maintenance-analytics/analytics-filter-bar";
import { CoverageTab } from "@/components/maintenance-analytics/coverage-tab";
import { FinancesTab } from "@/components/maintenance-analytics/finances-tab";
import { OverviewTab } from "@/components/maintenance-analytics/overview-tab";
import { ANALYTICS_TABS, useAnalyticsFilters, type AnalyticsTab } from "@/components/maintenance-analytics/use-analytics-filters";

/**
 * Maintenance analytics (docs/MAINTENANCE-UI.md §8):
 * `?tab=overview|finances|coverage`, one shared filter bar (days, stores,
 * technician category) — every filter in the URL.
 */
function MaintenanceAnalytics() {
  const t = useTranslations("maintenanceSystem");
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const filters = useAnalyticsFilters();

  const days =
    filters.from === filters.to
      ? formatDateOnly(filters.from, "EEEE, MMMM d")
      : `${formatDateOnly(filters.from, "MMM d")} – ${formatDateOnly(filters.to, "MMM d, yyyy")}`;
  const zone = viewerTimeZone();
  const description =
    filters.tab === "coverage" ? t("analytics.coverageDescription") : `${days}${zone ? ` · ${t("analytics.yourTimeZone", { zone })}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.analytics")} description={description} />

      <Tabs value={filters.tab} onValueChange={(v) => filters.setTab(v as AnalyticsTab)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {ANALYTICS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>{t(`analytics.tabs.${tab}`)}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4 space-y-6">
          <AnalyticsFilterBar filters={filters} />
          <TabsContent value="overview" className="mt-0">
            {filters.tab === "overview" && <OverviewTab locale={locale} filters={filters} />}
          </TabsContent>
          <TabsContent value="finances" className="mt-0">
            {filters.tab === "finances" && <FinancesTab locale={locale} filters={filters} />}
          </TabsContent>
          <TabsContent value="coverage" className="mt-0">
            {filters.tab === "coverage" && <CoverageTab filters={filters} />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function MaintenanceAnalyticsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <MaintenanceAnalytics />
    </Suspense>
  );
}
