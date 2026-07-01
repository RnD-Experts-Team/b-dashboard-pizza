"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/auth/auth.store";
import { monthToDateRange, daysBetween } from "@/lib/utils/date-range";
import { useBusinessReports } from "@/lib/hooks/use-business-reports";
import type {
  BusinessReportsParams,
  StoreSelection,
} from "@/types/business-reports.types";
import { BusinessReportsControls } from "@/components/business-reports/business-reports-controls";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import { KpiSummary } from "@/components/business-reports/kpi-summary";
import { BusinessReportsSkeleton } from "@/components/business-reports/skeleton";
import { SalesOpsTab } from "@/components/business-reports/tabs/sales-ops-tab";
import { LaborTab } from "@/components/business-reports/tabs/labor-tab";
import { FeedbackTab } from "@/components/business-reports/tabs/feedback-tab";

const TABS = [
  { id: "sales", label: "Sales & Operations" },
  { id: "labor", label: "Labor & Employees" },
  { id: "feedback", label: "Feedback & Complaints" },
] as const;

export default function BusinessReportsPage() {
  const overviewStores = useAuthStore((s) => s.overviewStores);

  const storeOptions: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({ id: s.id, name: s.name })),
    [overviewStores],
  );

  // Controls state
  const initialRange = useMemo(() => monthToDateRange(), []);
  const [selection, setSelection] = useState<StoreSelection>("all");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  // Live data (populated only on Load — this page is heavy).
  const { data, errors, isLoading, isRefreshing, loadedParams, load } =
    useBusinessReports();
  const busy = isLoading || isRefreshing;

  function handleLoad() {
    const params: BusinessReportsParams = {
      startDate,
      endDate,
      stores: selection,
    };
    load(params);
  }

  const scopeText =
    loadedParams === null
      ? storeOptions.length
        ? `${storeOptions.length} store${storeOptions.length === 1 ? "" : "s"} available`
        : "No stores available"
      : loadedParams.stores === "all"
        ? "All stores"
        : `${loadedParams.stores.length} store${loadedParams.stores.length === 1 ? "" : "s"}`;

  const rangeText = loadedParams
    ? `${loadedParams.startDate} → ${loadedParams.endDate} · ${daysBetween(loadedParams.startDate, loadedParams.endDate)} days`
    : "Select a range and load";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Reports"
        description={`${rangeText} · ${scopeText}`}
      >
        <BusinessReportsControls
          storeOptions={storeOptions}
          selection={selection}
          onSelectionChange={setSelection}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          onLoad={handleLoad}
          isLoading={busy}
          hasLoaded={loadedParams !== null}
        />
      </PageHeader>

      {isLoading && <BusinessReportsSkeleton />}

      {!busy && data === null && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No report loaded yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Choose your stores and date range above, then click{" "}
              <span className="font-medium">Load</span>. Large ranges across many
              stores may take a moment.
            </p>
          </div>
        </div>
      )}

      {!isLoading && data !== null && (
        <>
          <KpiSummary data={data.sales} />

          <Tabs defaultValue="sales" className="gap-4">
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="whitespace-nowrap px-3 py-1.5"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="sales">
              <SalesOpsTab data={data.sales} error={errors.sales} />
            </TabsContent>
            <TabsContent value="labor">
              <LaborTab data={data.labor} error={errors.labor} />
            </TabsContent>
            <TabsContent value="feedback">
              <FeedbackTab data={data.feedback} error={errors.feedback} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
