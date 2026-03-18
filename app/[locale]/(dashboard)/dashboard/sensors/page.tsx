"use client";

import { useTranslations } from "next-intl";
import { useSensors } from "@/lib/hooks/use-sensors";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Thermometer,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  Battery,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SensorDevice,
  ReportTimeBucket,
  ReportDeviceSummary,
  AlertRecord,
  HistoryRecord,
} from "@/types/sensor.types";
import type { SensorErrorState } from "@/lib/store/sensor.store";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Formatting helpers                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Round to one decimal place for display */
function round1(n: number): string {
  return n.toFixed(1);
}

/**
 * Format a temperature value.
 * The API now returns the correct unit based on our `unit` parameter,
 * so we no longer need to manually convert on the client.
 */
function formatTemp(value: number | string | null | undefined, useCelsius: boolean): string {
  // Explicitly guard null/undefined before parseFloat — isNaN(null) returns false
  // (JS coerces null → 0), which would pass the guard and crash at toFixed.
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${round1(num)}°${useCelsius ? "C" : "F"}`;
}

/** Format an ISO timestamp into a short, locale-friendly string */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/** Reusable inline error card with optional retry */
function ErrorCard({
  error,
  onRetry,
  className,
}: {
  error: SensorErrorState;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("border-destructive/50", className)}>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error.message}</p>
        {error.retryable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Stats cards row: total devices, online, offline, alerts */
function StatsCards({
  totalDevices,
  onlineCount,
  offlineCount,
  alertCount,
  t,
}: {
  totalDevices: number;
  onlineCount: number;
  offlineCount: number;
  alertCount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const cards = [
    { label: t("stats.totalDevices"), value: totalDevices, icon: Radio, color: "text-blue-500" },
    { label: t("stats.online"), value: onlineCount, icon: Wifi, color: "text-green-500" },
    { label: t("stats.offline"), value: offlineCount, icon: WifiOff, color: "text-red-500" },
    { label: t("stats.alerts"), value: alertCount, icon: AlertTriangle, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <c.icon className={cn("h-8 w-8 shrink-0", c.color)} />
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Individual sensor card showing live temperature, status, battery, alarms */
function SensorCard({
  sensor,
  useCelsius,
  t,
}: {
  sensor: SensorDevice;
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const state = sensor.state;
  const isAlert = state?.state === "alert";
  const isOnline = sensor.online;
  const temp = state?.temperature;

  return (
    <Card className={cn("transition-all", isAlert && "border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/10")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{sensor.device_name}</CardTitle>
          <div className="flex items-center gap-1.5">
            {isAlert && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {t("alert")}
              </Badge>
            )}
            <Badge variant={isOnline ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
              {isOnline ? t("online") : t("offline")}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          {sensor.model_name} · {sensor.device_type}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* Temperature display */}
        {temp != null && (
          <div className="flex items-baseline gap-1">
            <Thermometer className={cn("h-5 w-5", isAlert ? "text-amber-500" : "text-blue-500")} />
            <span className="text-2xl font-bold tabular-nums">{formatTemp(temp, useCelsius)}</span>
          </div>
        )}

        {/* Temp limits */}
        {state?.tempLimit && (
          <p className="text-xs text-muted-foreground">
            {t("tempRange")}: {formatTemp(state.tempLimit.min, useCelsius)} – {formatTemp(state.tempLimit.max, useCelsius)}
          </p>
        )}

        {/* Battery + last report */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Battery className="h-3.5 w-3.5" />
            {state?.battery ?? "—"}/4
          </span>
          {sensor.reported_at && (
            <span>{formatDate(sensor.reported_at)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Report overview card (summary stats for the selected period) */
function ReportOverviewCard({
  reports,
  useCelsius,
  t,
}: {
  reports: NonNullable<ReturnType<typeof useSensors>["reports"]>;
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const o = reports.overall;
  const periodKey =
    reports.period === "daily"
      ? "todayReport"
      : reports.period === "weekly"
        ? "weeklyReport"
        : "monthlyReport";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t(`report.${periodKey}`)}</CardTitle>
        <CardDescription className="text-xs">
          {o.total_readings} {t("report.totalReadings")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("report.avgTemp")} value={formatTemp(o.avg_temp, useCelsius)} />
          <Stat label={t("report.avgHumidity")} value={`${parseFloat(o.avg_humidity).toFixed(1)}%`} />
          <Stat
            label={t("report.alarms")}
            value={o.total_alarms}
            sub={Number(o.total_alarms) > 0 ? t("report.eventsDetected") : undefined}
            alert={Number(o.total_alarms) > 0}
          />
          <Stat
            label={t("report.offlineEvents")}
            value={o.total_offline}
            sub={Number(o.total_offline) === 0 ? t("report.allOnline") : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Small stat display used inside summary cards */
function Stat({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", alert && "text-amber-600 dark:text-amber-400")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Time-series table: hourly temperature / humidity buckets */
function TimeSeriesTable({
  data,
  useCelsius,
  t,
}: {
  data: ReportTimeBucket[];
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("report.timeSeries")}</CardTitle>
        <CardDescription className="text-xs">{t("report.timeSeriesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("report.columns.time")}</TableHead>
              <TableHead>{t("report.columns.avgTemp")}</TableHead>
              <TableHead>{t("report.columns.minMax")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("report.columns.avgHumidity")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("report.columns.readings")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.time_bucket}>
                <TableCell className="font-mono text-xs">{row.time_bucket}</TableCell>
                <TableCell className="tabular-nums">{formatTemp(row.avg_temp, useCelsius)}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatTemp(row.min_temp, useCelsius)} / {formatTemp(row.max_temp, useCelsius)}
                </TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">{parseFloat(row.avg_humidity).toFixed(1)}%</TableCell>
                <TableCell className="hidden sm:table-cell">{row.reading_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Per-device summary table */
function DeviceSummaryTable({
  data,
  useCelsius,
  t,
}: {
  data: ReportDeviceSummary[];
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("report.perDevice")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>{t("report.temperature")}</TableHead>
              <TableHead>{t("report.columns.minMax")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("report.humidity")}</TableHead>
              <TableHead>{t("report.columns.readings")}</TableHead>
              <TableHead>{t("report.alarmsLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.device_id}>
                <TableCell className="font-medium">{d.device_name}</TableCell>
                <TableCell className="tabular-nums">{formatTemp(d.avg_temp, useCelsius)}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatTemp(d.min_temp, useCelsius)} / {formatTemp(d.max_temp, useCelsius)}
                </TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">{parseFloat(d.avg_humidity).toFixed(1)}%</TableCell>
                <TableCell>{d.reading_count}</TableCell>
                <TableCell>
                  {Number(d.alarm_count) > 0 ? (
                    <Badge variant="destructive" className="text-[10px]">{d.alarm_count}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Alerts table — shows recent alarm events */
function AlertsTable({
  alerts,
  useCelsius,
  t,
}: {
  alerts: AlertRecord[];
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  // Show max 50 alerts to avoid overwhelming the DOM
  const visible = alerts.slice(0, 50);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("alerts.title")}</CardTitle>
        {alerts.length > 50 && (
          <CardDescription className="text-xs">
            {t("alerts.showingFirst", { count: 50, total: alerts.length })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("alerts.columns.device")}</TableHead>
              <TableHead>{t("alerts.columns.temperature")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("alerts.columns.humidity")}</TableHead>
              <TableHead>{t("alerts.columns.state")}</TableHead>
              <TableHead>{t("alerts.columns.recordedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((a, i) => (
              <TableRow key={`${a.device_id}-${a.recorded_at}-${i}`}>
                <TableCell className="font-medium">{a.device_name}</TableCell>
                <TableCell className="tabular-nums">{formatTemp(a.temperature, useCelsius)}</TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">{parseFloat(a.humidity).toFixed(1)}%</TableCell>
                <TableCell>
                  <Badge variant="destructive" className="text-[10px]">{a.state}</Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(a.recorded_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** History table with pagination */
function HistoryTable({
  history,
  useCelsius,
  onPageChange,
  loading,
}: {
  history: NonNullable<ReturnType<typeof useSensors>["history"]>;
  useCelsius: boolean;
  onPageChange: (page: number) => void;
  loading: boolean;
}) {
  const pag = history.reports;
  const records = pag.data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reading History</CardTitle>
        <CardDescription className="text-xs">
          Page {pag.current_page} of {pag.last_page} · {pag.total} records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Temp</TableHead>
              <TableHead className="hidden sm:table-cell">Humidity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Battery</TableHead>
              <TableHead>Recorded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r: HistoryRecord) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.device_name}</TableCell>
                <TableCell className="tabular-nums">{formatTemp(r.temperature, useCelsius)}</TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">{parseFloat(r.humidity).toFixed(1)}%</TableCell>
                <TableCell>
                  {r.alarm ? (
                    <Badge variant="destructive" className="text-[10px]">{r.state}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{r.state}</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{r.battery_level}/4</TableCell>
                <TableCell className="text-xs">{formatDate(r.recorded_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pag.current_page <= 1 || loading}
            onClick={() => onPageChange(pag.current_page - 1)}
          >
            <ChevronLeft className="h-4 w-4 me-1" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            {pag.current_page} / {pag.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pag.current_page >= pag.last_page || loading}
            onClick={() => onPageChange(pag.current_page + 1)}
          >
            Next <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading skeleton for the full page */
function SensorsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Sensor cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Report skeleton */}
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Page Component                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export default function SensorsPage() {
  const t = useTranslations("sensors");
  const {
    selectedStore,
    sensors,
    sensorsLoading,
    sensorsError,
    reports,
    reportsLoading,
    reportsError,
    reportPeriod,
    history,
    historyLoading,
    historyError,
    alerts,
    alertsLoading,
    alertsError,
    useCelsius,
    refetch,
    changePeriod,
    goToHistoryPage,
    toggleUnit,
  } = useSensors();

  // Show the skeleton whenever we have a store but no sensor data yet.
  // Must also check !sensorsError — if the fetch failed (e.g. 404), sensors
  // stays null but we should fall through to the error UI, not loop forever.
  const isAnyLoading = !!selectedStore && !sensors && !sensorsError;

  // ── Derived display values ─────────────────────────────────────────────
  // Show "StoreName — Sensors" once a store is selected; fall back to the
  // generic title while nothing is chosen yet.
  const pageTitle = selectedStore
    ? `${selectedStore.name} \u2014 ${t("sensorsSection")}`
    : t("title");

  // True whenever ANY endpoint is actively fetching (first load or refresh).
  const isAnyFetching =
    sensorsLoading || reportsLoading || historyLoading || alertsLoading;

  /* ── No store selected ────────────────────────────────────────────────── */
  if (!selectedStore) {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t("noStore.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{t("noStore.description")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Full-page loading (first load) ───────────────────────────────────── */
  if (isAnyLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        {/* Loading label shown above the skeleton so the user knows a fetch is in progress */}
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span className="flex-1">Fetching sensor data…</span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-primary/10 hidden sm:block">
            <div className="h-full w-full animate-pulse bg-primary/60" />
          </div>
        </div>
        <SensorsPageSkeleton />
      </div>
    );
  }

  /* ── 404: store has no sensor data on the remote API ─────────────────── */
  if (sensorsError && !sensors && sensorsError.code === "NOT_FOUND") {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Radio className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t("notFound.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("notFound.description")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Top-level error: sensors endpoint failed and we have no data ──── */
  if (sensorsError && !sensors) {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="text-lg font-semibold">{t("error.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{sensorsError.message}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              {t("error.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Store has no sensors ─────────────────────────────────────────────── */
  if (sensors && sensors.count === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Thermometer className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t("noSensors.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{t("noSensors.description")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Derive stats from live sensor data ───────────────────────────────── */
  const sensorList = sensors?.sensors ?? [];
  const onlineCount = sensorList.filter((s: SensorDevice) => s.online).length;
  const offlineCount = sensorList.length - onlineCount;
  const alertCount = sensorList.filter((s: SensorDevice) => s.state?.state === "alert").length;

  return (
    <div className="space-y-6">
      {/* Page header with refresh + unit toggle */}
      <PageHeader title={pageTitle} description={t("description")}>
        <div className="flex items-center gap-2 flex-wrap">
          {/* °F / °C toggle */}
          <Button variant="outline" size="sm" onClick={toggleUnit} title={t("toggleUnit")}>
            {useCelsius ? <ToggleRight className="h-4 w-4 me-1.5" /> : <ToggleLeft className="h-4 w-4 me-1.5" />}
            {useCelsius ? "°C" : "°F"}
          </Button>
          {/* Refresh all data */}
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isAnyFetching}
          >
            <RefreshCw className={cn("me-1.5 h-4 w-4", isAnyFetching && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
      </PageHeader>

      {/* Loading indicator — visible during background refreshes while data is already shown.
          Uses a subtle banner + animated bar so the user knows a fetch is in flight
          without hiding existing content behind a full skeleton. */}
      {isAnyFetching && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span className="flex-1">Fetching latest sensor data…</span>
          {/* Pulsing bar — gives a sense of ongoing progress */}
          <div className="h-1 w-24 overflow-hidden rounded-full bg-primary/10 hidden sm:block">
            <div className="h-full w-full animate-pulse bg-primary/60" />
          </div>
        </div>
      )}

      {/* ── Stats summary row ───────────────────────────────────────────── */}
      <StatsCards
        totalDevices={sensorList.length}
        onlineCount={onlineCount}
        offlineCount={offlineCount}
        alertCount={alertCount}
        t={t}
      />

      {/* ── Live sensor cards ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("sensorsSection")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sensorList.map((sensor: SensorDevice) => (
            <SensorCard key={sensor.device_id} sensor={sensor} useCelsius={useCelsius} t={t} />
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Reports section (tabs for period selection) ─────────────────── */}
      <Tabs
        value={reportPeriod}
        onValueChange={(v) => changePeriod(v as "daily" | "weekly" | "monthly")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold">{t("report.todayReport")}</h2>
          <TabsList>
            <TabsTrigger value="daily">{t("period.daily")}</TabsTrigger>
            <TabsTrigger value="weekly">{t("period.weekly")}</TabsTrigger>
            <TabsTrigger value="monthly">{t("period.monthly")}</TabsTrigger>
          </TabsList>
        </div>

        {/* All three tabs share the same content structure;
            only the data from the API changes based on the period. */}
        {(["daily", "weekly", "monthly"] as const).map((period) => (
          <TabsContent key={period} value={period} className="space-y-4 mt-0">
            {reportsLoading && !reports && (
              <Card>
                <CardContent className="py-8">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            )}
            {reportsError && <ErrorCard error={reportsError} onRetry={refetch} />}
            {reports && (
              <>
                <ReportOverviewCard reports={reports} useCelsius={useCelsius} t={t} />
                {reports.time_series.length > 0 && (
                  <TimeSeriesTable data={reports.time_series} useCelsius={useCelsius} t={t} />
                )}
                {reports.device_summary.length > 0 && (
                  <DeviceSummaryTable data={reports.device_summary} useCelsius={useCelsius} t={t} />
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* <Separator /> */}

      {/* ── Alerts section ──────────────────────────────────────────────── */}
      {/* {alertsLoading && !alerts && (
        <Card><CardContent className="py-8"><Skeleton className="h-32 w-full" /></CardContent></Card>
      )}
      {alertsError && <ErrorCard error={alertsError} onRetry={refetch} />}
      {alerts && alerts.alarms.length > 0 && (
        <AlertsTable alerts={alerts.alarms} useCelsius={useCelsius} t={t} />
      )} */}

      {/* <Separator /> */}

      {/* ── History section ─────────────────────────────────────────────── */}
      {historyLoading && !history && (
        <Card><CardContent className="py-8"><Skeleton className="h-32 w-full" /></CardContent></Card>
      )}
      {historyError && <ErrorCard error={historyError} onRetry={refetch} />}
      {history && history.reports.data.length > 0 && (
        <HistoryTable
          history={history}
          useCelsius={useCelsius}
          onPageChange={goToHistoryPage}
          loading={historyLoading}
        />
      )}
    </div>
  );
}
