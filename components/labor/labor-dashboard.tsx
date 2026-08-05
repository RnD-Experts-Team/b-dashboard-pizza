"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { format, subDays } from "date-fns";
import { AlertCircle, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useLaborDashboard } from "@/lib/hooks/use-labor-dashboard";
import { LaborHeader } from "./labor-header";
import { LaborSummaryStrip } from "./labor-summary-strip";
import { LaborHeadcount } from "./labor-headcount";
import { LaborTenure } from "./labor-tenure";
import { LaborTurnover } from "./labor-turnover";
import { LaborMetrics } from "./labor-metrics";
import { LaborOvertime } from "./labor-overtime";
import { LaborTrend } from "./labor-trend";
import { LaborRoster } from "./labor-roster";
import { LaborSkeleton } from "./labor-skeleton";
import { buildEmployeeBadges } from "./labor-badges";

const toApiDate = (date: Date) => format(date, "yyyy-MM-dd");

/** A store with no employees and no metric data at all this week. */
function isEmptyReport(headcount: number, employees: number): boolean {
  return headcount === 0 && employees === 0;
}

export function LaborDashboard() {
  const { selectedStore } = useSelectedStoreStore();
  // The store_number (e.g. "03795-00021"), not the numeric internal id.
  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;

  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [trendWeeks, setTrendWeeks] = useState(6);

  const { data, isLoading, error, refetch } = useLaborDashboard(
    storeId ? String(storeId) : null,
    toApiDate(selectedDate),
    trendWeeks,
  );

  const overtimeRef = useRef<HTMLDivElement | null>(null);
  const jumpToOvertime = useCallback(() => {
    overtimeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Built once per response — the roster reads it instead of re-scanning the
  // other sections for every row.
  const badgesByEmployee = useMemo(
    () => (data ? buildEmployeeBadges(data) : new Map()),
    [data],
  );

  if (!storeId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No store selected</p>
          <p className="text-xs text-muted-foreground">
            Pick a store from the sidebar to see its labor report.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <LaborHeader
        storeNumber={data?.store ?? String(storeId)}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        trendWeeks={trendWeeks}
        onTrendWeeksChange={setTrendWeeks}
        weekStart={data?.week_start}
        weekEnd={data?.week_end}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && !data && <LaborSkeleton />}

      {data &&
        (isEmptyReport(data.summary.headcount_current, data.employees.length) ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                No labor data for this week
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Store {data.store} has no active employees and no recorded
                metrics for {data.week_start} – {data.week_end}. Try another
                week once payroll data has been imported.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <LaborSummaryStrip
              summary={data.summary}
              onJumpToOvertime={jumpToOvertime}
            />

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <LaborHeadcount
                headcount={data.headcount}
                weekStart={data.week_start}
                weekEnd={data.week_end}
              />
              <LaborTenure tenure={data.tenure} />
            </div>

            <LaborTurnover turnover={data.turnover} />

            <LaborMetrics labor={data.labor} />

            <div ref={overtimeRef} className="scroll-mt-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <LaborOvertime overtime={data.overtime} />
                <LaborTrend trend={data.trend} />
              </div>
            </div>

            <LaborRoster
              employees={data.employees}
              badgesByEmployee={badgesByEmployee}
            />
          </>
        ))}
    </div>
  );
}
