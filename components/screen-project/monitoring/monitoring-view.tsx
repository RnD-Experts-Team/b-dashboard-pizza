"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, RefreshCw, ShieldOff, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/daily-pay/multi-select";
import { AnalyticsControls } from "@/components/maintenance-tickets/analytics/analytics-controls";
import { SectionError } from "@/components/maintenance-tickets/analytics/analytics-sections";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import type { StoreSelection } from "@/types/business-reports.types";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useScreenUsageReport } from "@/lib/hooks/use-screen-usage";
import { daysToInstants, matchPreset, presetDays, RANGE_PRESETS, viewerTimeZone } from "@/lib/maintenance-tickets/local-range";
import { formatDateOnly } from "@/lib/utils/date-display";
import { MonitoringReport } from "./monitoring-report";

/**
 * Screen Project monitoring — how managers use Screen Project, across the
 * stores the viewer may see: presence (a face on camera), time on screens,
 * mic and talking, favourite screens, hours, every detail per manager.
 *
 * Same shape as Maintenance Analytics: days in the viewer's clock, stores the
 * viewer holds `screens manager` at, the report aggregated upstream.
 */
export function MonitoringView() {
  const t = useTranslations("screenMonitoring");
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);

  // Only stores where the report is allowed: one refused store would refuse the whole request.
  // The API speaks store NUMBERS ("03795-00001"), so that is the option id.
  const storeOptions: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive && s.storeId)
        .filter((s) => canAccessRoute({ service: "Screens", method: "GET", path: "/usage/report", storeId: s.id }))
        .map((s) => ({ id: s.storeId as string, name: s.name ? `${s.storeId} · ${s.name}` : (s.storeId as string) })),
    [overviewStores, canAccessRoute],
  );

  const initial = useMemo(() => presetDays("last7"), []);
  const [selection, setSelection] = useState<StoreSelection>("all");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [users, setUsers] = useState<number[]>([]);

  const stores = useMemo(
    () => (selection === "all" ? storeOptions.map((o) => o.id) : selection),
    [selection, storeOptions],
  );
  const zone = viewerTimeZone() || "UTC";
  const params = useMemo(() => {
    const range = daysToInstants(startDate, endDate);
    if (!range || stores.length === 0) return null;
    return { stores, from: range.from, to: range.to, tz: zone, users: users.length ? users : undefined };
  }, [startDate, endDate, stores, zone, users]);

  const { data: report, isLoading, error, refetch } = useScreenUsageReport(params);

  const managerOptions = useMemo(
    () => (report?.managers ?? []).map((m) => ({ value: m.user_id, label: m.name })),
    [report],
  );

  const preset = matchPreset(startDate, endDate);
  const presetLabel = RANGE_PRESETS.find((p) => p.id === preset)?.label;
  const days =
    startDate === endDate
      ? formatDateOnly(startDate, "EEEE, MMMM d")
      : `${formatDateOnly(startDate, "MMM d")} – ${formatDateOnly(endDate, "MMM d, yyyy")}`;
  const scope = selection === "all" ? t("scopeAll", { count: storeOptions.length }) : t("scopeSome", { count: stores.length });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={`${presetLabel ? `${presetLabel}, ` : ""}${days} · ${scope} · ${t("timeZoneNote", { zone })}`}
      >
        <Button variant="outline" onClick={refetch} disabled={isLoading || !params}>
          <RefreshCw className={isLoading ? "me-2 h-4 w-4 animate-spin" : "me-2 h-4 w-4"} aria-hidden="true" />
          {t("refresh")}
        </Button>
      </PageHeader>

      {storeOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">{t("noAccess")}</p>
        </div>
      ) : (
        <>
          <AnalyticsControls
            storeOptions={storeOptions}
            selection={selection}
            onSelectionChange={(value) => {
              setSelection(value);
              setUsers([]);
            }}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            isUpdating={isLoading && report !== null}
          >
            <MultiSelect<number>
              options={managerOptions}
              selected={users}
              onChange={setUsers}
              placeholder={t("allManagers")}
              searchPlaceholder={t("searchManagers")}
              emptyText={t("noManagers")}
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              className="w-56"
            />
          </AnalyticsControls>

          {stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t("pickStores")}</p>
            </div>
          ) : error && !report ? (
            <div className="rounded-xl border bg-card shadow-sm">
              <SectionError message={t("loadError")} />
              <div className="px-5 pb-5">
                <Button variant="outline" size="sm" onClick={refetch}>{t("retry")}</Button>
              </div>
            </div>
          ) : !report ? (
            <MonitoringSkeleton />
          ) : report.totals.managers === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {error && <SectionError message={t("loadError")} />}
              <MonitoringReport report={report} stores={stores} startDate={startDate} endDate={endDate} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MonitoringSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
