"use client";

import { useCallback, useMemo, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useBusinessReports } from "@/lib/hooks/use-business-reports";
import type { BusinessReportsParams, StoreSelection } from "@/types/business-reports.types";
import { BusinessReportsControls } from "@/components/business-reports/business-reports-controls";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import { lastCompleteWeeks, rangeDays, type DateRange } from "@/components/business-reports/range-presets";
import { weekLabel } from "@/components/business-reports/report-format";
import { businessWeekStart } from "@/lib/utils/business-week";
import { ReportProvider, type ReportContextValue } from "@/components/business-reports/report-context";
import { KpiStrip } from "@/components/business-reports/kpi-strip";
import { SalesSection } from "@/components/business-reports/sections/sales-section";
import { OperationsSection } from "@/components/business-reports/sections/operations-section";
import { MenuSection } from "@/components/business-reports/sections/menu-section";
import { PeopleSection } from "@/components/business-reports/sections/people-section";
import { FinanceSection } from "@/components/business-reports/sections/finance-section";
import { QualitySection } from "@/components/business-reports/sections/quality-section";
import { StoresSection } from "@/components/business-reports/sections/stores-section";

function describeRange(params: BusinessReportsParams): string {
  const days = rangeDays({ start: params.startDate, end: params.endDate });
  const fmt = (d: string) => format(parseISO(d), "MMM d, yyyy");
  const stores = params.stores.length;
  const fromWeek = weekLabel({ week_start: businessWeekStart(params.startDate) }, true);
  const toWeek = weekLabel({ week_start: businessWeekStart(params.endDate) }, true);
  const weeks = fromWeek === toWeek ? fromWeek : `${fromWeek} → ${toWeek}`;
  return `${weeks} (${fmt(params.startDate)} → ${fmt(params.endDate)}) · ${days} day${days === 1 ? "" : "s"} · ${stores} store${stores === 1 ? "" : "s"}`;
}

/**
 * Business Reports — Dashboard V1 and the Labor report for any set of stores
 * over any date range. Every section loads on its own and appears as soon as
 * it lands; nothing is fetched until Load.
 */
export default function BusinessReportsPage() {
  const overviewStores = useAuthStore((s) => s.overviewStores);

  // The endpoints take store numbers ("03795-00001"), never the numeric ids,
  // and stores are shown by number first — the number is what people use.
  const storeOptions: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive && s.storeId)
        .map((s) => ({ id: s.storeId as string, name: s.name ? `${s.storeId} · ${s.name}` : (s.storeId as string) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [overviewStores],
  );
  const storeNames = useMemo(
    () => new Map(storeOptions.map((o) => [o.id, o.name])),
    [storeOptions],
  );

  const [selection, setSelection] = useState<StoreSelection>("all");
  const [range, setRange] = useState<DateRange>(() => lastCompleteWeeks());
  // Store scores are slow on big ranges: off unless asked for.
  const [withStoreScore, setWithStoreScore] = useState(false);
  // The full selection to go back to after focusing one store.
  const [beforeFocus, setBeforeFocus] = useState<{ params: BusinessReportsParams; selection: StoreSelection } | null>(null);

  const { sections, loadedParams, loadedAt, busy, load, stop } = useBusinessReports();

  const storesFor = useCallback(
    (sel: StoreSelection) => (sel === "all" ? storeOptions.map((o) => o.id) : sel),
    [storeOptions],
  );

  const handleLoad = () => {
    setBeforeFocus(null);
    load({ startDate: range.start, endDate: range.end, stores: storesFor(selection), withStoreScore });
  };

  const focusStore = useCallback(
    (store: string) => {
      if (!loadedParams || loadedParams.stores.length <= 1) return;
      setBeforeFocus({ params: loadedParams, selection });
      setSelection([store]);
      load({ ...loadedParams, stores: [store] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [loadedParams, selection, load],
  );

  const unfocus = () => {
    if (!beforeFocus) return;
    setSelection(beforeFocus.selection);
    load(beforeFocus.params);
    setBeforeFocus(null);
  };

  const context: ReportContextValue | null = useMemo(
    () =>
      loadedParams && {
        sections,
        params: loadedParams,
        storeName: (store: string) => storeNames.get(store) ?? store,
        focusStore,
        rangeLabel: describeRange(loadedParams),
      },
    [loadedParams, sections, storeNames, focusStore],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Reports"
        description={
          loadedParams
            ? `${describeRange(loadedParams)}${loadedAt ? ` · loaded ${format(loadedAt, "h:mm a")}` : ""}`
            : "Dashboard V1 and the Labor report for any stores over any range"
        }
      />

      <BusinessReportsControls
        storeOptions={storeOptions}
        selection={selection}
        onSelectionChange={setSelection}
        range={range}
        onRangeChange={setRange}
        onLoad={handleLoad}
        onStop={stop}
        withStoreScore={withStoreScore}
        onWithStoreScoreChange={setWithStoreScore}
        busy={busy}
        hasLoaded={loadedParams !== null}
      />

      {!context && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No report loaded yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Choose stores and a range above, then click <span className="font-medium">Load</span>.
              Each part of the report appears as soon as it is ready.
            </p>
          </div>
        </div>
      )}

      {context && (
        <ReportProvider value={context}>
          <div className="relative space-y-2">
            {busy && (
              <div className="absolute inset-x-0 -top-3 h-0.5 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
              </div>
            )}

            {beforeFocus && (
              <Badge variant="secondary" className="gap-1.5 py-1 text-[11px]">
                Focused on {context.storeName(context.params.stores[0])}
                <button
                  type="button"
                  onClick={unfocus}
                  className="rounded-sm opacity-70 hover:opacity-100"
                  aria-label="Back to all selected stores"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <KpiStrip />
            <StoresSection />
            <SalesSection />
            <OperationsSection />
            <MenuSection />
            <PeopleSection />
            <FinanceSection />
            <QualitySection />
          </div>
        </ReportProvider>
      )}
    </div>
  );
}
