"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, AlertCircle, RefreshCw, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedStoreStore } from "@/lib/store";
import { useCanAccessRoute } from "@/lib/auth/use-auth";
import { useScreenUsage } from "@/lib/hooks/use-screen-usage";
import { hourGrids, perScreen, summarize, timeline, usersOf } from "@/lib/screen-usage/aggregate";
import { SummaryTable } from "./summary-table";
import { HoursHeatmap } from "./hours-heatmap";
import { ScreensBreakdown } from "./screens-breakdown";
import { DayTimeline } from "./day-timeline";

const MAX_RANGE_DAYS = 62;
const ALL = "all";

/** "YYYY-MM-DD" of a local date. */
function toInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" (the viewer's own time zone). */
function fromInputDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/**
 * Screen Project monitoring — how managers use Screen Project: time on it,
 * present (camera on & uncovered) vs away, mic/talking, favorite screens, and
 * the hours they are around. Everything is shown in the viewer's time zone.
 */
export function MonitoringView() {
  const t = useTranslations("screenMonitoring");
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? "";

  const canView = useCanAccessRoute({
    service: "Screens",
    method: "GET",
    path: `/${storeId || "store"}/usage/segments`,
    storeId: selectedStore?.id,
  });

  const today = useMemo(() => new Date(), []);
  const [fromValue, setFromValue] = useState(() => toInputDate(addDays(today, -6)));
  const [toValue, setToValue] = useState(() => toInputDate(today));
  const [userFilter, setUserFilter] = useState<string>(ALL);
  const [timelineUser, setTimelineUser] = useState<string>("");
  const [timelineDay, setTimelineDay] = useState(() => toInputDate(today));

  // [from, to) in local time; the end date is inclusive for the user.
  const { from, to, rangeError } = useMemo(() => {
    const f = fromInputDate(fromValue);
    const e = addDays(fromInputDate(toValue), 1);
    const days = (e.getTime() - f.getTime()) / 86_400_000;
    if (!(days > 0)) return { from: f, to: addDays(f, 1), rangeError: t("rangeInvalid") };
    if (days > MAX_RANGE_DAYS) return { from: f, to: addDays(f, MAX_RANGE_DAYS), rangeError: t("rangeTooLong", { days: MAX_RANGE_DAYS }) };
    return { from: f, to: e, rangeError: null };
  }, [fromValue, toValue, t]);

  const { data, isLoading, error, refetch } = useScreenUsage(canView ? storeId : undefined, from, to);

  const segments = useMemo(() => data?.segments ?? [], [data]);
  const stations = useMemo(() => data?.stations ?? [], [data]);
  const users = useMemo(() => usersOf(segments), [segments]);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const filterId = userFilter === ALL ? null : Number(userFilter);

  const summary = useMemo(() => {
    const rows = summarize(segments, fromMs, toMs);
    return filterId === null ? rows : rows.filter((r) => r.user.id === filterId);
  }, [segments, fromMs, toMs, filterId]);
  const grids = useMemo(() => hourGrids(segments, fromMs, toMs, filterId), [segments, fromMs, toMs, filterId]);
  const screens = useMemo(() => perScreen(segments, stations, fromMs, toMs, filterId), [segments, stations, fromMs, toMs, filterId]);

  const effectiveTimelineUser = timelineUser || (filterId !== null ? String(filterId) : String(users[0]?.id ?? ""));
  const dayStart = fromInputDate(timelineDay).getTime();
  const dayEnd = addDays(fromInputDate(timelineDay), 1).getTime();
  const dayInRange = dayStart >= fromMs && dayEnd <= toMs;
  const day = useMemo(
    () =>
      effectiveTimelineUser
        ? timeline(segments, Number(effectiveTimelineUser), dayStart, dayEnd)
        : { bars: [], kicks: [] },
    [segments, effectiveTimelineUser, dayStart, dayEnd],
  );

  const header = (
    <PageHeader title={t("title")} description={t("description")}>
      <Button variant="outline" size="sm" onClick={refetch} disabled={!canView || isLoading} className="gap-1.5">
        <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {t("refresh")}
      </Button>
    </PageHeader>
  );

  if (!storeId || !canView) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{storeId ? t("noAccess") : t("selectStore")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <Label htmlFor="sm-from" className="text-xs">{t("from")}</Label>
          <Input id="sm-from" type="date" value={fromValue} max={toValue} onChange={(e) => setFromValue(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sm-to" className="text-xs">{t("to")}</Label>
          <Input id="sm-to" type="date" value={toValue} min={fromValue} onChange={(e) => setToValue(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("manager")}</Label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allManagers")}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="ms-auto text-xs text-muted-foreground">
          {t("timeZoneNote", { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </p>
        {rangeError && <p className="basis-full text-xs text-destructive">{rangeError}</p>}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={refetch}>{t("retry")}</Button>
        </div>
      ) : isLoading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Activity className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <Tabs defaultValue="summary">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
              <TabsTrigger value="summary">{t("tabs.summary")}</TabsTrigger>
              <TabsTrigger value="hours">{t("tabs.hours")}</TabsTrigger>
              <TabsTrigger value="screens">{t("tabs.screens")}</TabsTrigger>
              <TabsTrigger value="timeline">{t("tabs.timeline")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary" className="mt-4 space-y-2">
            <SummaryTable rows={summary} stations={stations} />
            <p className="text-xs text-muted-foreground">{t("summaryHint")}</p>
          </TabsContent>

          <TabsContent value="hours" className="mt-4">
            <HoursHeatmap present={grids.present} away={grids.away} />
          </TabsContent>

          <TabsContent value="screens" className="mt-4">
            <ScreensBreakdown rows={screens} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("manager")}</Label>
                <Select value={effectiveTimelineUser} onValueChange={setTimelineUser}>
                  <SelectTrigger className="h-9 w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sm-day" className="text-xs">{t("day")}</Label>
                <Input id="sm-day" type="date" value={timelineDay} min={fromValue} max={toValue} onChange={(e) => setTimelineDay(e.target.value)} className="h-9 w-40" />
              </div>
            </div>
            {!dayInRange ? (
              <p className="text-sm text-muted-foreground">{t("dayOutOfRange")}</p>
            ) : day.bars.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dayEmpty")}</p>
            ) : (
              <DayTimeline bars={day.bars} kicks={day.kicks} stations={stations} dayStart={dayStart} dayEnd={dayEnd} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
