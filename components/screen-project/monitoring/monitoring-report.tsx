"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Camera, Clock, EyeOff, Lightbulb, Mic, MonitorOff, MonitorPlay, Store, UserCheck, Users,
} from "lucide-react";
import { AnalyticsCard, CardEmpty } from "@/components/maintenance-tickets/analytics/analytics-card";
import { AnalyticsBarChart } from "@/components/maintenance-tickets/analytics/analytics-bar-chart";
import { KpiTile, type Kpi } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { Pager, ReportTable, TD, TH, usePaged } from "@/components/maintenance-tickets/analytics/analytics-sections";
import { scrollToSection } from "@/lib/maintenance-tickets/scroll-to-section";
import { cn } from "@/lib/utils";
import { USAGE_COLORS, formatDuration, percent, share, toHours } from "@/lib/screen-usage/format";
import type { UsageReport, UsageScreenRow, UsageStoreRow, UsageUserRow } from "@/lib/screen-usage/types";
import { MANAGER_DAILY_TARGET_S, openSeconds, startedDays, storeOpenHours } from "@/lib/screen-usage/open-hours";
import { useAuthStore } from "@/lib/auth/auth.store";
import { daysToInstants } from "@/lib/maintenance-tickets/local-range";
import { BreakdownChart, DailyPresenceChart, HoursHeatmap, SegmentedToggle, type ChartBasis } from "./usage-charts";
import { SplitKpiTile, type SplitKpi, type SplitKpiHalf } from "./split-kpi-tile";
import { ManagersTable } from "./managers-table";
import { ManagerSheet } from "./manager-sheet";
import { MetricDefinitions, MetricNote } from "./metric-definitions";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
/** Below this, a manager's share of time is noise, not a finding. */
const MIN_ON_SCREEN_FOR_RANKING = 30 * 60;
/** Matches the bars the top-screens chart shows (its MAX_ROWS), so the two cards line up. */
const STORES_PAGE_SIZE = 8;

/**
 * The monitoring report, laid out like the maintenance analytics page: the
 * headline numbers, the charts that answer "when / how present / how
 * communicative", a few plain-language findings, then every detail in tables.
 */
export function MonitoringReport({
  report,
  stores,
  startDate,
  endDate,
}: {
  report: UsageReport;
  /** Store numbers in scope. */
  stores: string[];
  startDate: string;
  endDate: string;
}) {
  const t = useTranslations("screenMonitoring");
  const [openUser, setOpenUser] = useState<UsageUserRow | null>(null);
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const k = report.totals;

  // Store opening hours come from the stores' metadata the auth calls already loaded.
  const { openByStore, openByDay, chartDays, openSoFar } = useMemo(() => {
    const from = Date.parse(report.range.from);
    const end = Date.parse(report.range.to);
    // Hours still to come are not owed yet; a refetched report (new range object) moves "now" on.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const to = Math.min(end, now);
    const hours = new Map((overviewStores ?? []).map((s) => [s.storeId, storeOpenHours(s.metadata)]));
    const inScope = stores.flatMap((code) => {
      const h = hours.get(code);
      return h ? [[code, h] as const] : [];
    });
    const byStore = Object.fromEntries(inScope.map(([code, h]) => [code, openSeconds(h, from, to)])) as Record<string, number>;
    // The report lists only days with activity; a day nobody connected still owed its open hours.
    const seen = new Map(report.days.map((d) => [d.date, d]));
    const lastDay = format(new Date(Math.min(end - 1, now)), "yyyy-MM-dd");
    const days = lastDay < startDate
      ? report.days
      : eachDayOfInterval({ start: parseISO(startDate), end: parseISO(lastDay) }).map((date) => {
          const key = format(date, "yyyy-MM-dd");
          return seen.get(key) ?? { date: key, on_screen: 0, present: 0, talking: 0, managers: 0 };
        });
    // The daily chart's days are the viewer's local days, like the report's own.
    const byDay = Object.fromEntries(
      days.map((d) => {
        const day = daysToInstants(d.date, d.date);
        const dayFrom = day ? Math.max(Date.parse(day.from), from) : 0;
        const dayTo = day ? Math.min(Date.parse(day.to), to) : 0;
        return [d.date, inScope.reduce((sum, [, h]) => sum + openSeconds(h, dayFrom, dayTo), 0)];
      }),
    ) as Record<string, number>;
    return { openByStore: byStore, openByDay: byDay, chartDays: days, openSoFar: end > now };
  }, [overviewStores, stores, report.range, report.days, startDate]);
  const openTotal = Object.values(openByStore).reduce((a, b) => a + b, 0);
  const withHours = report.stores.filter((s) => s.store in openByStore);
  const openConnected = withHours.reduce((a, s) => a + s.on_screen, 0);
  const openPresent = withHours.reduce((a, s) => a + s.present, 0);
  const openTalking = withHours.reduce((a, s) => a + s.talking, 0);
  const hasOpenHours = openTotal > 0;
  const [basis, setBasis] = useState<ChartBasis>("open");
  const chartBasis: ChartBasis = hasOpenHours ? basis : "connected";
  const managerTarget = MANAGER_DAILY_TARGET_S * startedDays(startDate, endDate);
  const avgOnScreen = k.managers ? k.on_screen / k.managers : 0;

  // The priority numbers: present and talking out of the stores' open hours, then out of connected time.
  const ofOpen = (part: number): SplitKpiHalf => ({
    caption: t(openSoFar ? "kpi.ofOpenSoFar" : "kpi.ofOpen"),
    value: percent(part, openTotal),
    note: hasOpenHours ? t("kpi.partOf", { part: formatDuration(part), whole: formatDuration(openTotal) }) : t("kpi.noOpenHours"),
  });
  const ofConnected = (part: number): SplitKpiHalf => ({
    caption: t("kpi.ofConnected"),
    value: percent(part, k.on_screen),
    note: t("kpi.partOf", { part: formatDuration(part), whole: formatDuration(k.on_screen) }),
  });
  const splitKpis: SplitKpi[] = [
    {
      label: t("kpi.present"),
      icon: UserCheck,
      tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      halves: [ofOpen(openPresent), ofConnected(k.present)],
      target: "presence",
    },
    {
      label: t("kpi.talking"),
      icon: Mic,
      tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      halves: [ofOpen(openTalking), ofConnected(k.talking)],
      target: "mic",
    },
  ];

  const kpis: Kpi[] = [
    {
      label: t("kpi.openCovered"),
      value: percent(openConnected, openTotal),
      icon: Store,
      tint: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
      note:
        openTotal > 0
          ? t(openSoFar ? "kpi.openCoveredNoteSoFar" : "kpi.openCoveredNote", {
              connected: formatDuration(openConnected),
              open: formatDuration(openTotal),
              count: Object.keys(openByStore).length,
            })
          : t("kpi.openCoveredNone"),
      target: "stores",
    },
    {
      label: t("kpi.managerTarget"),
      value: percent(avgOnScreen, managerTarget),
      icon: Clock,
      tint: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      note: t("kpi.managerTargetNote", { avg: formatDuration(avgOnScreen), target: formatDuration(managerTarget) }),
      target: "managers",
    },
    {
      label: t("kpi.managers"),
      value: k.managers,
      icon: Users,
      tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      note: t("kpi.managersNote", { visits: k.visits }),
      target: "managers",
    },
    {
      label: t("kpi.onScreen"),
      value: formatDuration(k.on_screen),
      icon: MonitorPlay,
      tint: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      note: t("kpi.onScreenNote", { avg: formatDuration(avgOnScreen) }),
    },
    {
      label: t("kpi.away"),
      value: formatDuration(k.away),
      icon: EyeOff,
      tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      note: t("kpi.awayNote", { noFace: formatDuration(k.no_face), covered: formatDuration(k.covered) }),
      target: "camera",
    },
    {
      label: t("kpi.kicks"),
      value: k.kicks,
      icon: AlertTriangle,
      tint: "bg-red-500/10 text-red-600 dark:text-red-400",
      note: t("kpi.kicksNote"),
      target: "managers",
    },
  ];

  const findings = useMemo(() => {
    const out: { text: string; target?: string; tone?: "good" | "warn" }[] = [];
    const ranked = report.users.filter((u) => u.on_screen >= MIN_ON_SCREEN_FOR_RANKING);
    if (ranked.length > 0) {
      const byShare = [...ranked].sort((a, b) => share(b.present, b.on_screen) - share(a.present, a.on_screen));
      const best = byShare[0];
      out.push({ text: t("glance.mostPresent", { name: best.name, share: percent(best.present, best.on_screen) }), target: "managers", tone: "good" });
      if (byShare.length > 1) {
        const worst = byShare[byShare.length - 1];
        out.push({ text: t("glance.leastPresent", { name: worst.name, share: percent(worst.present, worst.on_screen) }), target: "managers", tone: "warn" });
      }
    }
    let peak = { day: 0, hour: 0, seconds: 0 };
    report.hours.present.forEach((row, day) => row.forEach((seconds, hour) => {
      if (seconds > peak.seconds) peak = { day, hour, seconds };
    }));
    if (peak.seconds > 0) {
      out.push({ text: t("glance.peakHour", { day: t(`daysLong.${DAY_KEYS[peak.day]}`), hour: `${String(peak.hour).padStart(2, "0")}:00` }), target: "hours" });
    }
    const top = report.screens[0];
    if (top && top.main > 0) out.push({ text: t("glance.topScreen", { name: top.name, store: top.store ?? "", duration: formatDuration(top.main) }), target: "screens" });
    const neglected = report.screens.filter((s) => s.main === 0).length;
    if (neglected > 0) out.push({ text: t("glance.neglected", { count: neglected, total: report.screens.length }), target: "screens", tone: "warn" });
    const trouble = k.no_face + k.covered;
    if (trouble > 0) out.push({ text: t("glance.cameraTrouble", { duration: formatDuration(trouble) }), target: "camera", tone: "warn" });
    if (k.dead_mic > 0) out.push({ text: t("glance.deadMic", { duration: formatDuration(k.dead_mic) }), target: "mic", tone: "warn" });
    return out;
  }, [report, k, t]);

  const onScreen = k.on_screen;
  const byOpen = chartBasis === "open";
  // Of open hours, the donuts gain the open time nobody was connected for, so they add up to the open hours.
  const notConnected = byOpen
    ? [{ label: t("legend.notConnected"), seconds: Math.max(0, openTotal - onScreen), color: USAGE_COLORS.gap }]
    : [];
  const totalLabel = t(byOpen ? "columns.openHours" : "columns.onScreen");
  const cameraSlices = [
    { label: t("legend.present"), seconds: report.camera.present, color: USAGE_COLORS.good },
    { label: t("legend.noFace"), seconds: report.camera.no_face, color: USAGE_COLORS.attention },
    { label: t("legend.covered"), seconds: report.camera.covered, color: USAGE_COLORS.problem },
    { label: t("legend.cameraOff"), seconds: report.camera.off, color: USAGE_COLORS.off },
    ...notConnected,
  ];
  const micSlices = [
    { label: t("legend.talking"), seconds: report.mic.talking, color: USAGE_COLORS.good },
    { label: t("legend.silent"), seconds: report.mic.silent, color: USAGE_COLORS.attention },
    { label: t("legend.deadMic"), seconds: report.mic.dead, color: USAGE_COLORS.problem },
    { label: t("legend.micOff"), seconds: report.mic.off, color: USAGE_COLORS.off },
    ...notConnected,
  ];

  return (
    <div className="@container space-y-6">
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
        {splitKpis.map((kpi) => <SplitKpiTile key={kpi.label} kpi={kpi} />)}
        {kpis.map((kpi) => <KpiTile key={kpi.label} kpi={kpi} />)}
      </div>

      <MetricDefinitions />

      {hasOpenHours && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("charts.basis")}</span>
          <SegmentedToggle
            label={t("charts.basis")}
            value={basis}
            onChange={setBasis}
            options={[
              { value: "open", label: t(openSoFar ? "kpi.ofOpenSoFar" : "kpi.ofOpen") },
              { value: "connected", label: t("kpi.ofConnected") },
            ]}
          />
        </div>
      )}

      <div className="grid gap-6 @4xl:grid-cols-2">
        <AnalyticsCard id="presence" icon={CalendarClock} title={t("sections.daily")} description={t("sections.dailyHint")}>
          {report.days.length > 0 || byOpen ? (
            <DailyPresenceChart days={chartDays} openByDay={byOpen ? openByDay : null} />
          ) : (
            <CardEmpty icon={CalendarClock}>{t("empty")}</CardEmpty>
          )}
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <MetricNote metric="present" />
            <MetricNote metric="away" />
          </div>
        </AnalyticsCard>
        <AnalyticsCard id="hours" icon={Clock} title={t("sections.hours")} description={t("sections.hoursHint")}>
          <HoursHeatmap present={report.hours.present} away={report.hours.away} />
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <MetricNote metric="timeZone" />
          </div>
        </AnalyticsCard>
        <AnalyticsCard id="camera" icon={Camera} title={t("sections.camera")} description={t("sections.cameraHint")} center>
          {onScreen > 0 || byOpen ? <BreakdownChart slices={cameraSlices} totalLabel={totalLabel} /> : <CardEmpty icon={Camera}>{t("empty")}</CardEmpty>}
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <MetricNote metric="present" />
            <MetricNote metric="noFace" />
            <MetricNote metric="covered" />
            <MetricNote metric="cameraOff" />
          </div>
        </AnalyticsCard>
        <AnalyticsCard id="mic" icon={Mic} title={t("sections.mic")} description={t("sections.micHint")} center>
          {onScreen > 0 || byOpen ? <BreakdownChart slices={micSlices} totalLabel={totalLabel} /> : <CardEmpty icon={Mic}>{t("empty")}</CardEmpty>}
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <MetricNote metric="talking" />
            <MetricNote metric="silent" />
            <MetricNote metric="deadMic" />
          </div>
        </AnalyticsCard>
      </div>

      {findings.length > 0 && (
        <AnalyticsCard icon={Lightbulb} title={t("sections.glance")} flush>
          <ul className="divide-y">
            {findings.map((f) => (
              <li key={f.text}>
                <button
                  type="button"
                  disabled={!f.target}
                  onClick={() => f.target && scrollToSection(f.target)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-start text-sm hover:bg-muted/30 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      f.tone === "good" ? "bg-teal-600" : f.tone === "warn" ? "bg-amber-600" : "bg-blue-600",
                    )}
                    aria-hidden="true"
                  />
                  {f.text}
                </button>
              </li>
            ))}
          </ul>
        </AnalyticsCard>
      )}

      <ManagersTable users={report.users} targetSeconds={managerTarget} onOpen={setOpenUser} />

      <div className="grid gap-6 @4xl:grid-cols-2">
        <AnalyticsCard icon={MonitorPlay} title={t("sections.topScreens")} description={t("sections.topScreensHint")} center>
          {report.screens.some((s) => s.main > 0) ? (
            <AnalyticsBarChart
              title={t("sections.topScreens")}
              rows={report.screens.filter((s) => s.main > 0).map((s) => ({ label: `${s.name} · ${s.store ?? ""}`, value: toHours(s.main) }))}
              valueLabel={t("units.hours")}
              format={(v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`}
            />
          ) : (
            <CardEmpty icon={MonitorOff}>{t("noScreenTime")}</CardEmpty>
          )}
        </AnalyticsCard>
        <StoresCard report={report} openByStore={openByStore} openSoFar={openSoFar} />
      </div>

      <ScreensTable report={report} />

      <ManagerSheet
        key={openUser?.user_id ?? "none"}
        user={openUser}
        stores={stores}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setOpenUser(null)}
      />
    </div>
  );
}

/**
 * Click-to-sort for the report's tables: numbers start highest first, text
 * columns (`textKeys`) A to Z; clicking the active column reverses it.
 */
function useSortable<T, K extends keyof T & string>(rows: T[], initial: K, textKeys: K[]) {
  const [sort, setSort] = useState<{ key: K; desc: boolean }>({ key: initial, desc: !textKeys.includes(initial) });
  const sorted = useMemo(() => {
    const get = (r: T) => {
      const v = r[sort.key];
      return typeof v === "string" ? v.toLowerCase() : (v ?? "");
    };
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const c = x < y ? -1 : Number(x > y);
      return sort.desc ? -c : c;
    });
  }, [rows, sort]);

  const head = (key: K, label: string, className?: string) => {
    const active = sort.key === key;
    const direction = sort.desc ? { Icon: ArrowDown, aria: "descending" as const } : { Icon: ArrowUp, aria: "ascending" as const };
    const { Icon, aria } = active ? direction : { Icon: ArrowUpDown, aria: "none" as const };
    return (
      <th className={cn(TH, className)} aria-sort={aria}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : !textKeys.includes(key) }))}
          className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-foreground", active && "text-foreground")}
        >
          {label}
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </th>
    );
  };

  return { rows: sorted, head };
}

/** A store row with its opening hours in the range and shares of them (null: none set in the store's metadata). */
type StoreRowView = UsageStoreRow & {
  open_hours: number | null;
  open_share: number | null;
  present_open_share: number | null;
  talking_open_share: number | null;
};

const STORE_TEXT_KEYS: (keyof StoreRowView)[] = ["store"];
const SCREEN_TEXT_KEYS: (keyof UsageScreenRow & string)[] = ["name", "store"];

function StoresCard({
  report,
  openByStore,
  openSoFar,
}: {
  report: UsageReport;
  openByStore: Record<string, number>;
  /** The range runs past now: open hours count only up to now. */
  openSoFar: boolean;
}) {
  const t = useTranslations("screenMonitoring");
  const withOpen = useMemo<StoreRowView[]>(
    () =>
      report.stores.map((s) => {
        const open = openByStore[s.store] ?? null;
        const ofOpen = (seconds: number) => (open === null ? null : share(seconds, open));
        return {
          ...s,
          open_hours: open,
          open_share: ofOpen(s.on_screen),
          present_open_share: ofOpen(s.present),
          talking_open_share: ofOpen(s.talking),
        };
      }),
    [report.stores, openByStore],
  );
  const { rows, head } = useSortable(withOpen, "present_open_share", STORE_TEXT_KEYS);
  // Same page size as the top-screens chart beside it, so both show the same number of rows.
  const paged = usePaged(rows, rows.length, STORES_PAGE_SIZE);

  return (
    <AnalyticsCard id="stores" icon={Store} title={t("sections.stores")} count={rows.length} flush>
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_td]:whitespace-nowrap [&_td]:px-3 [&_th]:px-3">
          <thead className="border-b bg-muted/40">
            <tr>
              {head("store", t("columns.store"))}
              {head("present_open_share", t("columns.presentOpenShare"), "text-end")}
              {head("talking_open_share", t("columns.talkingOpenShare"), "text-end")}
              {head("open_share", t("columns.openShare"), "text-end")}
              {head("present", t("columns.present"), "text-end")}
              {head("talking", t("columns.talking"), "text-end")}
              {head("on_screen", t("columns.onScreen"), "text-end")}
              {head("open_hours", t(openSoFar ? "columns.openHoursSoFar" : "columns.openHours"), "text-end")}
              {head("managers", t("columns.managers"), "text-end")}
              {head("kicks", t("columns.kicks"), "text-end")}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.rows.map((s) => (
              <tr key={s.store} className="hover:bg-muted/30">
                <td className={cn(TD, "font-medium")}>{s.store}</td>
                <td className={cn(TD, "text-end font-semibold tabular-nums")}>{s.open_hours === null ? "—" : percent(s.present, s.open_hours)}</td>
                <td className={cn(TD, "text-end font-semibold tabular-nums")}>{s.open_hours === null ? "—" : percent(s.talking, s.open_hours)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{s.open_hours === null ? "—" : percent(s.on_screen, s.open_hours)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(s.present)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(s.talking)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(s.on_screen)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{s.open_hours === null ? "—" : formatDuration(s.open_hours)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{s.managers}</td>
                <td className={cn(TD, "text-end tabular-nums", s.kicks > 0 && "text-red-600 dark:text-red-400")}>{s.kicks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={paged.page} pages={paged.pages} from={paged.from} to={paged.to} total={paged.total} onPage={paged.setPage} />
    </AnalyticsCard>
  );
}

function ScreensTable({ report }: { report: UsageReport }) {
  const t = useTranslations("screenMonitoring");
  const { rows, head } = useSortable(report.screens, "main", SCREEN_TEXT_KEYS);
  const paged = usePaged(rows, rows.length, 10);
  const maxMain = Math.max(1, ...report.screens.map((s) => s.main));
  return (
    <ReportTable
      id="screens"
      title={t("sections.screens")}
      count={report.screens.length}
      unit={t("units.screens")}
      description={t("sections.screensHint", { watched: report.totals.screens_watched, total: report.totals.screens })}
    >
      <table className="w-full text-sm [&_td]:whitespace-nowrap">
        <thead className="border-b bg-muted/40">
          <tr>
            {head("name", t("columns.screen"))}
            {head("store", t("columns.store"))}
            {head("main", t("columns.mainTile"), "w-1/3")}
            {head("mic", t("columns.micOpen"), "text-end")}
            {head("camera", t("columns.camera"), "text-end")}
            {head("managers", t("columns.managers"), "text-end")}
          </tr>
        </thead>
        <tbody className="divide-y">
          {paged.rows.map((s) => (
            <tr key={s.station_id} className="hover:bg-muted/30">
              <td className={cn(TD, "font-medium")}>
                {s.name}
                {s.main === 0 && (
                  <span className="ms-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                    {t("neverWatched")}
                  </span>
                )}
              </td>
              <td className={cn(TD, "text-muted-foreground")}>{s.store}</td>
              <td className={TD}>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${(s.main / maxMain) * 100}%` }} />
                  </div>
                  <span className="w-16 text-end text-xs tabular-nums">{formatDuration(s.main)}</span>
                </div>
              </td>
              <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(s.mic)}</td>
              <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(s.camera)}</td>
              <td className={cn(TD, "text-end tabular-nums")}>{s.managers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={paged.page} pages={paged.pages} from={paged.from} to={paged.to} total={paged.total} onPage={paged.setPage} />
    </ReportTable>
  );
}
