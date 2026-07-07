"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSensors } from "@/lib/hooks/use-sensors";
import { useMosSensors } from "@/lib/hooks/use-mos-sensors";
import { useAuthStore } from "@/lib/auth/auth.store";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
  Building2,
  ChevronDown,
  LayoutGrid,
  Monitor,
  Info,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorDevice, MosSensor } from "@/types/sensor.types";
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

function formatMosTemp(
  temp: number | null,
  tempUnit: string | null | undefined,
  useCelsius: boolean,
): string {
  if (temp == null) return "—";
  const isC = (tempUnit ?? "C").toUpperCase() !== "F";
  let display = temp;
  if (!useCelsius && isC) display = (temp * 9) / 5 + 32;
  else if (useCelsius && !isC) display = ((temp - 32) * 5) / 9;
  return `${round1(display)}°${useCelsius ? "C" : "F"}`;
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

function cleanSensorName(name: string): string {
  return name.replace(/\s\d+-\d+$/, "").replace(/\./g, " ").trim();
}

/**
 * Returns a canonical lowercase key used to deduplicate and match sensor
 * columns across stores. Handles:
 *   - Store-number suffix  ("freezer 03795-00038" → "freezer")
 *   - CamelCase            ("MakingTable"         → "making table")
 *   - Hyphens / dots       ("Walk-in cooler"      → "walk in cooler")
 *   - Mixed capitalisation ("Freezer" vs "freezer"→ same key)
 */
function sensorKey(rawName: string): string {
  return rawName
    .replace(/\s[\d]+-[\d]+$/, "")        // strip store-number suffix
    .replace(/([a-z])([A-Z])/g, "$1 $2")  // CamelCase → spaced
    .replace(/[-_.]+/g, " ")              // hyphens / dots → space
    .replace(/\s+/g, " ")                 // collapse whitespace
    .trim()
    .toLowerCase();
}

/**
 * Maps known variant keys → a single canonical key.
 * Add entries here whenever two different device_name values refer to the same
 * physical sensor type across stores.
 */
const SENSOR_ALIASES: Record<string, string> = {
  "water":  "hot water",    // some stores report "Water", others "Hot Water"
  "making": "making table", // some stores report "Making", others "Making Table"
};

/** Returns temperature range labels for each canonical sensor key in the current unit. */
function getSensorRanges(useCelsius: boolean): Record<string, string> {
  return useCelsius
    ? {
        "freezer":        "-23 to -12°C",
        "walk in cooler": "<5°C",
        "making table":   "<5°C",
        "ingredients":    "<5°C",
        "hot water":      ">38°C",
      }
    : {
        "freezer":        "-10 to 10°F",
        "walk in cooler": "<41°F",
        "making table":   "<41°F",
        "ingredients":    "<41°F",
        "hot water":      ">100°F",
      };
}

/** Normalizes + resolves aliases so the same sensor type always gets the same key. */
function canonicalKey(rawName: string): string {
  const key = sensorKey(rawName);
  return SENSOR_ALIASES[key] ?? key;
}

/** Title-case a normalized sensor key for display. */
function sensorLabel(key: string): string {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  User View sub-components                                                */
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
    { label: t("stats.totalDevices"), value: totalDevices, icon: Radio,         color: "text-blue-500" },
    { label: t("stats.online"),       value: onlineCount,  icon: Wifi,          color: "text-green-500" },
    { label: t("stats.offline"),      value: offlineCount, icon: WifiOff,       color: "text-red-500" },
    { label: t("stats.alerts"),       value: alertCount,   icon: AlertTriangle, color: "text-amber-500" },
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
  sensor: SensorDevice;
  useCelsius: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const state       = sensor.state;
  const isAlert     = state?.state === "alert";
  const isStale     = sensor.stale ?? false;
  const isUnavailable = sensor.source === "unavailable" || (!sensor.success && sensor.temperature == null);
  const temp        = sensor.temperature ?? (typeof state?.temperature === "number" ? state.temperature : undefined);
  const displayTime = sensor.as_of ?? sensor.reported_at;
  // Use the same static, unit-aware ranges as the MOS view (not the backend tempLimit).
  const staticRange = getSensorRanges(useCelsius)[canonicalKey(sensor.device_name)];

  return (
    <Card className={cn(
      "transition-all",
      isAlert && "border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/10",
      isStale && !isAlert && "border-amber-300/50",
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {cleanSensorName(sensor.device_name)}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {isAlert && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {t("alert")}
              </Badge>
            )}
            {isStale && !isUnavailable && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                Last reading
              </Badge>
            )}
            {!isStale && (
              <Badge variant={sensor.online ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {sensor.online ? t("online") : t("offline")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isUnavailable ? (
          /* No reading available at all */
          <div className="flex flex-col items-center gap-1.5 py-3 text-center">
            <WifiOff className="h-7 w-7 text-red-400" />
            <p className="text-xs text-muted-foreground">No data — sensor offline</p>
            {sensor.reported_at && (
              <p className="text-[10px] text-muted-foreground/60">
                Last seen {formatDate(sensor.reported_at)}
              </p>
            )}
          </div>
        ) : (
          <>
            {temp != null && (
              <div className="flex items-baseline gap-1">
                <Thermometer className={cn("h-5 w-5", isAlert ? "text-amber-500" : "text-blue-500")} />
                <span className="text-2xl font-bold tabular-nums">{formatTemp(temp, useCelsius)}</span>
              </div>
            )}
            {staticRange && (
              <p className="text-xs text-muted-foreground">
                {t("tempRange")}: {staticRange}
              </p>
            )}
            {isStale && displayTime && (
              <div className="flex flex-col gap-0.5">
                <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3 shrink-0" />
                  Last reading · {formatDate(displayTime)}
                </p>
                {sensor.notice && (
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 ps-4">
                    {sensor.notice}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {state?.battery != null && (
                <span className="flex items-center gap-1">
                  <Battery className="h-3.5 w-3.5" />
                  {state.battery}/4
                </span>
              )}
              {!isStale && sensor.reported_at && (
                <span className="ml-auto">{formatDate(sensor.reported_at)}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HubCard({ hub, t }: { hub: SensorDevice; t: ReturnType<typeof useTranslations> }) {
  const isStale   = hub.stale ?? false;
  const asOfLabel = hub.as_of ?? hub.reported_at;
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 p-4">
        <Radio className={cn("h-5 w-5 shrink-0", hub.online ? "text-green-500" : "text-red-500")} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{hub.device_name}</p>
          <p className="text-xs text-muted-foreground">{hub.model_name} · {hub.device_type}</p>
          {isStale && asOfLabel && (
            <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
              <Clock className="h-3 w-3 shrink-0" />
              Last reading · {formatDate(asOfLabel)}
            </p>
          )}
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
/*  MOS View — pivot table (store rows × sensor columns)                   */
/* ────────────────────────────────────────────────────────────────────────── */

function MosSensorCell({ sensor }: { sensor: MosSensor | undefined; useCelsius: boolean }) {
  if (!sensor) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  if (!sensor.online) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
        Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
      {/* temperature rendered by parent so useCelsius prop is available */}
    </span>
  );
}

function MosTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-9 shrink-0" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="p-4 space-y-2.5">
          <Skeleton className="h-9 w-full" />
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MosView({ useCelsius }: { useCelsius: boolean }) {
  const { mosData, mosLoading, mosError, refetchMos } = useMosSensors(useCelsius ? "c" : "f");
  const [search, setSearch] = useState("");

  const sensorRanges = getSensorRanges(useCelsius);

  /* ── Derive pivot columns — one per unique normalized sensor key ────────── */
  const sensorColumns = useMemo<string[]>(() => {
    if (!mosData) return [];
    const keys = new Set<string>();
    mosData.stores.forEach((entry) => {
      entry.sensors.forEach((s) => keys.add(canonicalKey(s.device_name)));
    });
    return Array.from(keys).sort();
  }, [mosData]);

  /* ── Loading ── */
  if (mosLoading && !mosData) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span>Loading sensor data for all stores…</span>
        </div>
        <MosTableSkeleton />
      </div>
    );
  }

  /* ── Error ── */
  if (mosError && !mosData) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load MOS data</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{mosError.message}</p>
          {mosError.retryable && (
            <Button variant="outline" size="sm" onClick={refetchMos}>
              <RefreshCw className="h-4 w-4 me-1.5" /> Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!mosData) return null;

  const allStores = mosData.stores;

  /* ── Summary stats ── */
  const totalSensors      = allStores.reduce((n, s) => n + s.count, 0);
  const storesHubOnline   = allStores.filter((s) => s.hub?.online).length;
  const totalOffline      = allStores.reduce(
    (n, s) => n + s.sensors.filter((d) => !d.online).length, 0,
  );
  /* ── Search filter ── */
  const q = search.trim().toLowerCase();
  const filtered = q
    ? allStores.filter(
        (s) =>
          s.store.store_name.toLowerCase().includes(q) ||
          s.store.store_number.toLowerCase().includes(q),
      )
    : allStores;

  const fetchedAt = mosData.fetched_at ? formatDate(mosData.fetched_at) : null;

  return (
    <div className="space-y-4">
      {/* Background refresh */}
      {mosLoading && mosData && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
          <span>Refreshing all-store sensor data…</span>
        </div>
      )}

      {/* Partial error */}
      {mosError && mosData && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">{mosError.message}</p>
            {mosError.retryable && (
              <Button variant="outline" size="sm" onClick={refetchMos}>Retry</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Toolbar — search + info popover + meta */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search store name or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-9 text-sm"
          />
        </div>

        {/* Info popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Summary">
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Summary</p>
            <div className="space-y-1.5">
              {[
                { label: "Total Stores",    value: mosData.count,   icon: Building2, color: "text-blue-500" },
                { label: "Hubs Online",     value: storesHubOnline, icon: Wifi,      color: "text-green-500" },
                { label: "Total Sensors",   value: totalSensors,    icon: Radio,     color: "text-violet-500" },
                {
                  label: "Sensors Offline",
                  value: totalOffline,
                  icon: WifiOff,
                  color: totalOffline > 0 ? "text-red-500" : "text-muted-foreground",
                },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <c.icon className={cn("h-3.5 w-3.5 shrink-0", c.color)} />
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{c.value}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Right side meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground ms-auto">
          {fetchedAt && <span>Updated {fetchedAt}</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refetchMos}
            disabled={mosLoading}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", mosLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Pivot table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No stores match &ldquo;{search}&rdquo;</p>
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Clear search</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="border-b bg-muted/70">
                <th className="sticky left-0 z-40 bg-muted/70 min-w-[200px] border-r px-4 py-3 text-start text-sm font-medium text-foreground whitespace-nowrap">
                  Store
                </th>
                {sensorColumns.map((col) => (
                  <th
                    key={col}
                    className="min-w-[120px] px-2 py-2 text-center text-sm font-medium text-foreground bg-muted/70 whitespace-nowrap"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{sensorLabel(col)}</span>
                      {sensorRanges[col] && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {sensorRanges[col]}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="[&_tr:last-child]:border-0">
              {filtered.map((entry) => {
                const sensorMap = new Map<string, MosSensor>();
                entry.sensors.forEach((s) => {
                  sensorMap.set(canonicalKey(s.device_name), s);
                });

                const hasIssues = entry.sensors.some((s) => !s.online || !s.success);

                return (
                  <tr key={entry.store.store_number} className="border-b transition-colors hover:bg-muted/30">
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r px-4 py-3 whitespace-nowrap",
                        hasIssues ? "bg-muted/50" : "bg-background"
                      )}
                    >
                      <p className="text-sm font-semibold leading-tight">{entry.store.store_name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{entry.store.store_number}</p>
                    </td>

                    {sensorColumns.map((col) => {
                      const sensor = sensorMap.get(col);

                      /* No sensor reported for this column in this store */
                      if (!sensor) {
                        return (
                          <td key={col} className="px-2 py-3 text-center whitespace-nowrap">
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          </td>
                        );
                      }

                      /* No reading available (rate-limited with no history) */
                      if (sensor.source === "unavailable" || !sensor.success) {
                        return (
                          <td key={col} className="px-2 py-3 text-center whitespace-nowrap">
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          </td>
                        );
                      }

                      const isStale = sensor.stale ?? false;
                      const asOf    = sensor.as_of;

                      /* Stale reading — last_report, show temp with amber indicator */
                      if (isStale) {
                        return (
                          <td key={col} className="px-2 py-3 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center justify-center gap-1.5 text-sm font-medium tabular-nums">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                {formatMosTemp(sensor.temperature, sensor.temperature_unit, useCelsius)}
                              </span>
                              {asOf && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                  {formatDate(asOf)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      /* Live or cache — current data */
                      return (
                        <td key={col} className="px-2 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center gap-1.5 text-sm font-medium tabular-nums">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            {formatMosTemp(sensor.temperature, sensor.temperature_unit, useCelsius)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    sensors,
    sensorsLoading,
    sensorsError,
    useCelsius,
    refetch,
    toggleUnit,
  } = useSensors();

  const { canAccessRoute } = useAuthStore();
  const [activeView, setActiveView] = useState<"user" | "mos">("mos");

  const hasMosAccess = canAccessRoute({
    service: "Sensors",
    method: "GET",
    path: "/stores/sensors",
    storeId: (selectedStore as any)?.id,
  });

  const showUserView = !hasMosAccess || activeView === "user";
  const isUserLoading = !!selectedStore && !sensors && !sensorsError;

  const pageTitle = selectedStore
    ? `${selectedStore.name} — ${t("sensorsSection")}`
    : t("title");

  /* ── Only unconditional early return: no store selected ──────────────── */
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

  const sensorList   = sensors?.sensors ?? [];
  const onlineCount  = sensorList.filter((s: SensorDevice) => s.online).length;
  const offlineCount = sensorList.length - onlineCount;
  const alertCount   = sensorList.filter((s: SensorDevice) => s.state?.state === "alert").length;
  const fetchedAt    = sensors?.fetched_at ? formatDate(sensors.fetched_at) : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader title={pageTitle} description={t("description")}>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={toggleUnit} title={t("toggleUnit")}>
            {useCelsius
              ? <ToggleRight className="h-4 w-4 me-1.5" />
              : <ToggleLeft  className="h-4 w-4 me-1.5" />}
            {useCelsius ? "°C" : "°F"}
          </Button>

          {hasMosAccess && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {activeView === "mos"
                    ? <Monitor className="h-4 w-4 me-1.5" />
                    : <LayoutGrid className="h-4 w-4 me-1.5" />}
                  {activeView === "mos" ? "MOS View" : "User View"}
                  <ChevronDown className="h-3.5 w-3.5 ms-1.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setActiveView("user")}
                  className={cn(activeView === "user" && "font-medium")}
                >
                  <LayoutGrid className="h-4 w-4 me-2 text-muted-foreground" />
                  User View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setActiveView("mos")}
                  className={cn(activeView === "mos" && "font-medium")}
                >
                  <Monitor className="h-4 w-4 me-2 text-muted-foreground" />
                  MOS View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {showUserView && (
            <Button variant="outline" size="sm" onClick={refetch} disabled={sensorsLoading}>
              <RefreshCw className={cn("me-1.5 h-4 w-4", sensorsLoading && "animate-spin")} />
              {t("refresh")}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── MOS View — handles its own loading / error states ─────────────── */}
      {hasMosAccess && activeView === "mos" && (
        <MosView useCelsius={useCelsius} />
      )}

      {/* ── User View — all states handled inline ─────────────────────────── */}
      {showUserView && (
        <>
          {/* Initial load skeleton */}
          {isUserLoading && <SensorsPageSkeleton />}

          {/* 404 */}
          {!isUserLoading && sensorsError && !sensors && sensorsError.code === "NOT_FOUND" && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Radio className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{t("notFound.title")}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">{t("notFound.description")}</p>
              </CardContent>
            </Card>
          )}

          {/* Other errors (no existing data) */}
          {!isUserLoading && sensorsError && !sensors && sensorsError.code !== "NOT_FOUND" && (
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
          )}

          {/* No sensors */}
          {!isUserLoading && sensors && sensors.count === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Thermometer className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{t("noSensors.title")}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">{t("noSensors.description")}</p>
              </CardContent>
            </Card>
          )}

          {/* Data */}
          {!isUserLoading && sensors && sensors.count > 0 && (
            <>
              {/* Background refresh indicator */}
              {sensorsLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                >
                  <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
                  <span className="flex-1">Fetching latest sensor data…</span>
                </div>
              )}

              {/* Partial refresh error */}
              {sensorsError && <ErrorCard error={sensorsError} onRetry={refetch} />}

              <StatsCards
                totalDevices={sensorList.length}
                onlineCount={onlineCount}
                offlineCount={offlineCount}
                alertCount={alertCount}
                t={t}
              />

              {sensors.hub && (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
