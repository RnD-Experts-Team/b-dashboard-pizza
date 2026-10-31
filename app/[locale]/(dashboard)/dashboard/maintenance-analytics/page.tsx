"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { useAuthStore } from "@/lib/auth/auth.store";
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
  // Finances and Coverage are the maintenance office's view (MOS-only rules);
  // a store manager sees the Overview of their stores only.
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const tabs = ANALYTICS_TABS.filter(
    (tab) => tab === "overview" || canAccessRoute({ service: "Maintenance", method: "GET", path: `/maintenance-analytics/${tab}` }),
  );
  const tab: AnalyticsTab = tabs.includes(filters.tab) ? filters.tab : "overview";

  const days =
    filters.from === filters.to
      ? formatDateOnly(filters.from, "EEEE, MMMM d")
      : `${formatDateOnly(filters.from, "MMM d")} – ${formatDateOnly(filters.to, "MMM d, yyyy")}`;
  const zone = viewerTimeZone();
  const description =
    tab === "coverage" ? t("analytics.coverageDescription") : `${days}${zone ? ` · ${t("analytics.yourTimeZone", { zone })}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.analytics")} description={description} />

      <Tabs value={tab} onValueChange={(v) => filters.setTab(v as AnalyticsTab)}>
        {tabs.length > 1 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
              {tabs.map((name) => (
                <TabsTrigger key={name} value={name}>{t(`analytics.tabs.${name}`)}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}

        <div className="mt-4 space-y-6">
          <AnalyticsFilterBar filters={{ ...filters, tab }} />
          <TabsContent value="overview" className="mt-0">
            {tab === "overview" && <OverviewTab locale={locale} filters={filters} />}
          </TabsContent>
          <TabsContent value="finances" className="mt-0">
            {tab === "finances" && <FinancesTab locale={locale} filters={filters} />}
          </TabsContent>
          <TabsContent value="coverage" className="mt-0">
            {tab === "coverage" && <CoverageTab filters={filters} />}
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
