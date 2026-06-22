"use client";

import { useTranslations } from "next-intl";
import { useSensors } from "@/lib/hooks/use-sensors";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorDevice } from "@/types/sensor.types";
import type { MosSensorEntry, MosStoreSensors } from "@/types/sensor.types";
import type { SensorErrorState } from "@/lib/store/sensor.store";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Formatting helpers                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function round1(n: number): string {
  return n.toFixed(1);
}

function formatTemp(value: number | string | null | undefined, useCelsius: boolean): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${round1(num)}°${useCelsius ? "C" : "F"}`;
}

function formatDate(iso: string | null): string {
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

function SensorCard({
  sensor,
  useCelsius,
  t,
}: {
  sensor: SensorDevice | MosSensorEntry;
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const state = sensor.state as Record<string, unknown> | null;
  const isAlert = state?.state === "alert";
  const isOnline = sensor.online;
  const temp = sensor.temperature ?? (state?.temperature as number | undefined);

  return (
    <Card className={cn("transition-all", isAlert && "border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/10")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {sensor.device_name
              .replace(/\s\d+-\d+$/, '')
              .replace(/\./g, ' ')}
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {temp != null && (
          <div className="flex items-baseline gap-1">
            <Thermometer className={cn("h-5 w-5", isAlert ? "text-amber-500" : "text-blue-500")} />
            <span className="text-2xl font-bold tabular-nums">{formatTemp(temp, useCelsius)}</span>
          </div>
        )}

        {(state?.tempLimit as { min?: number; max?: number } | undefined) && (
          <p className="text-xs text-muted-foreground">
            {t("tempRange")}:{" "}
            {formatTemp((state!.tempLimit as { min: number }).min, useCelsius)} –{" "}
            {formatTemp((state!.tempLimit as { max: number }).max, useCelsius)}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {state?.battery != null && (
            <span className="flex items-center gap-1">
              <Battery className="h-3.5 w-3.5" />
              {state.battery as number}/4
            </span>
          )}
          {sensor.reported_at && (
            <span className="ml-auto">{formatDate(sensor.reported_at)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HubCard({
  hub,
  t,
}: {
  hub: SensorDevice | MosSensorEntry;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 p-4">
        <Radio className={cn("h-5 w-5 shrink-0", hub.online ? "text-green-500" : "text-red-500")} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{hub.device_name}</p>
          <p className="text-xs text-muted-foreground">{hub.model_name} · {hub.device_type}</p>
        </div>
        <Badge variant={hub.online ? "default" : "secondary"} className="text-[10px] shrink-0">
          {hub.online ? t("online") : t("offline")}
        </Badge>
      </CardContent>
    </Card>
  );
}

function SensorsPageSkeleton() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MOS multi-store section                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function MosStoreSectionCard({
  storeSensors,
  useCelsius,
  t,
}: {
  storeSensors: MosStoreSensors;
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const { store, hub, sensors } = storeSensors;
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">
        {store.store_name}
        <span className="ms-2 text-xs font-normal text-muted-foreground">{store.store_number}</span>
      </h2>
      {hub && <HubCard hub={hub} t={t} />}
      {sensors.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sensors.map((sensor) => (
            <SensorCard key={sensor.device_id} sensor={sensor} useCelsius={useCelsius} t={t} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noSensors.title")}</p>
      )}
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
    hasMos,
    sensors,
    mosSensors,
    sensorsLoading,
    sensorsError,
    useCelsius,
    refetch,
    toggleUnit,
  } = useSensors();

  /* ── Shared header actions ──────────────────────────────────────────────── */
  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={toggleUnit} title={t("toggleUnit")}>
        {useCelsius ? <ToggleRight className="h-4 w-4 me-1.5" /> : <ToggleLeft className="h-4 w-4 me-1.5" />}
        {useCelsius ? "°C" : "°F"}
      </Button>
      <Button variant="outline" size="sm" onClick={refetch} disabled={sensorsLoading}>
        <RefreshCw className={cn("me-1.5 h-4 w-4", sensorsLoading && "animate-spin")} />
        {t("refresh")}
      </Button>
    </div>
  );

  /* ── MOS mode ─────────────────────────────────────────────────────────── */
  if (hasMos) {
    const isLoading = !mosSensors && !sensorsError;
    const pageTitle = t("title");

    if (isLoading) {
      return (
        <div className="space-y-6">
          <PageHeader title={pageTitle} description={t("description")} />
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
            <span className="flex-1">Fetching sensor data…</span>
          </div>
          <SensorsPageSkeleton />
        </div>
      );
    }

    if (sensorsError && !mosSensors) {
      return (
        <div className="space-y-6">
          <PageHeader title={pageTitle} description={t("description")}>{headerActions}</PageHeader>
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

    // Aggregate stats across all stores
    const allSensors = mosSensors?.stores.flatMap((s) => s.sensors) ?? [];
    const totalDevices = allSensors.length;
    const onlineCount = allSensors.filter((s) => s.online).length;
    const offlineCount = totalDevices - onlineCount;
    const alertCount = allSensors.filter((s) => (s.state as Record<string, unknown> | null)?.state === "alert").length;
    const fetchedAt = mosSensors?.fetched_at ? formatDate(mosSensors.fetched_at) : null;

    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")}>
          {headerActions}
        </PageHeader>

        {sensorsLoading && mosSensors && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
            <span className="flex-1">Fetching latest sensor data…</span>
          </div>
        )}

        {sensorsError && mosSensors && (
          <ErrorCard error={sensorsError} onRetry={refetch} />
        )}

        {mosSensors?.missing && mosSensors.missing.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {mosSensors.missing.length} store{mosSensors.missing.length > 1 ? "s" : ""} unavailable:{" "}
              {mosSensors.missing.join(", ")}
            </span>
          </div>
        )}

        <StatsCards
          totalDevices={totalDevices}
          onlineCount={onlineCount}
          offlineCount={offlineCount}
          alertCount={alertCount}
          t={t}
        />

        {fetchedAt && (
          <p className="text-xs text-muted-foreground text-end">Updated {fetchedAt}</p>
        )}

        <div className="space-y-8">
          {(mosSensors?.stores ?? []).map((storeSensors) => (
            <MosStoreSectionCard
              key={storeSensors.store.store_number}
              storeSensors={storeSensors}
              useCelsius={useCelsius}
              t={t}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Single-store mode (unchanged) ─────────────────────────────────────── */

  const isLoading = !!selectedStore && !sensors && !sensorsError;

  const pageTitle = selectedStore
    ? `${selectedStore.name} — ${t("sensorsSection")}`
    : t("title");

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span className="flex-1">Fetching sensor data…</span>
        </div>
        <SensorsPageSkeleton />
      </div>
    );
  }

  if (sensorsError && !sensors && sensorsError.code === "NOT_FOUND") {
    return (
      <div className="space-y-6">
        <PageHeader title={pageTitle} description={t("description")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Radio className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t("notFound.title")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{t("notFound.description")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const sensorList = sensors?.sensors ?? [];
  const onlineCount = sensorList.filter((s: SensorDevice) => s.online).length;
  const offlineCount = sensorList.length - onlineCount;
  const alertCount = sensorList.filter((s: SensorDevice) => s.state?.state === "alert").length;
  const fetchedAt = sensors?.fetched_at ? formatDate(sensors.fetched_at) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={pageTitle} description={t("description")}>
        {headerActions}
      </PageHeader>

      {sensorsLoading && sensors && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span className="flex-1">Fetching latest sensor data…</span>
        </div>
      )}

      {sensorsError && sensors && (
        <ErrorCard error={sensorsError} onRetry={refetch} />
      )}

      <StatsCards
        totalDevices={sensorList.length}
        onlineCount={onlineCount}
        offlineCount={offlineCount}
        alertCount={alertCount}
        t={t}
      />

      {sensors?.hub && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Hub</h2>
          <HubCard hub={sensors.hub} t={t} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t("sensorsSection")}</h2>
          {fetchedAt && (
            <p className="text-xs text-muted-foreground">Updated {fetchedAt}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sensorList.map((sensor: SensorDevice) => (
            <SensorCard key={sensor.device_id} sensor={sensor} useCelsius={useCelsius} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
