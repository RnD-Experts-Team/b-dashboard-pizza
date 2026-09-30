"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSchedulingInsights } from "@/lib/hooks/use-scheduling-insights";
import { plannedCoverage, minutesBetween } from "@/lib/scheduling/hourly-coverage";
import { businessHourIndex } from "@/lib/scheduling/insights";
import type { DraftShift } from "@/lib/scheduling/draft.store";
import type {
  InsightAnomaly,
  InsightDay,
  InsightHour,
  Shift,
  WeekInfo,
} from "@/types/scheduling.types";

/**
 * Staffing guide: what each hour of each weekday usually sells and how many
 * people were really on the clock, from the last four finished weeks, set beside
 * the week being planned.
 *
 * Two readings of every figure, because a single odd week can mislead:
 *   Typical  leaves out the weeks flagged as odd (a sudden rush, a dead day);
 *   All days counts every week.
 * The odd weeks are always listed in words under "Keep in mind", so nothing is
 * hidden either way.
 *
 * Sales and people are drawn as two aligned panels over the same hours rather
 * than one chart with two scales, so neither can be made to look like the other.
 */

type Basis = "typical" | "avg";

const STORAGE_KEY = "scheduling.staffingGuide.open";
const PLAN_SHORTFALL = 1; // plan this many people under the usual: worth a look
const PLAN_SURPLUS = 1.5; // plan this many over the usual: worth a look

const money = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

const people = (n: number) => (Math.round(n * 10) / 10).toString();

function hourLabel(hour: number, short = false): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "a" : "p";
  return short ? `${h12}${suffix}` : `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

function dateLabel(iso: string): string {
  return format(parseISO(iso), "EEE MMM d");
}

function describe(a: InsightAnomaly, dayName: string): string {
  const when = dateLabel(a.date);
  const hr = a.hour === null ? "" : hourLabel(a.hour);

  switch (a.metric) {
    case "sales": {
      const base =
        a.kind === "spike"
          ? `${when}, ${hr}: busier than usual, ${money(a.value)} vs ${money(a.usual)} on a usual ${dayName}.`
          : `${when}, ${hr}: quieter than usual, ${money(a.value)} vs ${money(a.usual)} on a usual ${dayName}.`;
      return a.staffing
        ? `${base} ${people(a.staffing.value)} people were on the clock vs a usual ${people(a.staffing.usual)}.`
        : base;
    }
    case "daily_sales": {
      const base =
        a.kind === "spike"
          ? `${when} was a very busy day: ${money(a.value)} vs ${money(a.usual)} on a usual ${dayName}.`
          : `${when} was a very slow day: ${money(a.value)} vs ${money(a.usual)} on a usual ${dayName}.`;
      return a.staffing
        ? `${base} Labor was ${Math.round(a.staffing.value)}h vs a usual ${Math.round(a.staffing.usual)}h.`
        : base;
    }
    case "headcount":
      return `${when}, ${hr}: ${people(a.value)} people on the clock vs a usual ${people(a.usual)}.`;
    case "labor_hours":
      return `${when}: ${Math.round(a.value)} labor hours vs a usual ${Math.round(a.usual)}.`;
  }
}

interface Row {
  hour: number;
  insight: InsightHour | null;
  sales: number | null;
  orders: number | null;
  onClock: number | null;
  usuallyScheduled: number | null;
  planned: number | null;
  splh: number | null;
  odd: boolean;
  volatile: boolean;
}

export interface StaffingGuideProps {
  storeId: string | null;
  week: WeekInfo;
  /** Saved plan for the week on screen. */
  shifts: Shift[];
  /** Unsaved additions: what is being decided right now. */
  drafts: DraftShift[];
  /** Day column to show first, usually today's. */
  initialDayIndex?: number;
}

export function StaffingGuide({
  storeId,
  week,
  shifts,
  drafts,
  initialDayIndex = 0,
}: StaffingGuideProps) {
  // Remembered per browser; the screen still works if storage is unavailable.
  // This mounts only after the week has loaded on the client, so reading
  // storage in the initializer cannot disagree with server-rendered markup.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [basis, setBasis] = useState<Basis>("typical");
  const [dayIndex, setDayIndex] = useState(initialDayIndex);
  const [hovered, setHovered] = useState<number | null>(null);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data, isLoading, error, retry } = useSchedulingInsights(
    storeId,
    week.start,
    open,
  );

  const cutoff = data?.businessDayCutoff ?? 5;

  // What is on the plan right now, saved and unsaved, per date and hour.
  const planned = useMemo(() => {
    const fromShifts = shifts.map((s) => ({
      shiftDate: s.shiftDate,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
    }));
    const fromDrafts = drafts.map((d) => ({
      shiftDate: week.fullDates[d.dayIndex] ?? week.start,
      startTime: d.startTime,
      durationMinutes: minutesBetween(d.startTime, d.endTime),
    }));
    return plannedCoverage([...fromShifts, ...fromDrafts], cutoff);
  }, [shifts, drafts, week.fullDates, week.start, cutoff]);

  const weekday = (week.weekStartDow + dayIndex) % 7;
  const day: InsightDay | undefined = data?.weekdays.find((d) => d.weekday === weekday);
  const date = week.fullDates[dayIndex];
  const plannedDay = planned[date];
  const hasPlan = Object.values(planned).some((slots) => slots.some((v) => v > 0));

  const dayAnomalies = useMemo(
    () => (data?.anomalies ?? []).filter((a) => a.weekday === weekday),
    [data?.anomalies, weekday],
  );

  const rows: Row[] = useMemo(() => {
    if (!day) return [];

    const oddHours = new Set(
      dayAnomalies.filter((a) => a.hour !== null).map((a) => a.hour as number),
    );
    const byHour = new Map(day.hours.map((h) => [h.hour, h]));
    const hours = new Set<number>(byHour.keys());
    plannedDay?.forEach((v, h) => {
      if (v > 0) hours.add(h);
    });

    const pick = (s: { avg: number; typical: number } | null | undefined) =>
      s ? s[basis] : null;

    return [...hours]
      .sort((a, b) => businessHourIndex(a, cutoff) - businessHourIndex(b, cutoff))
      .map((hour) => {
        const h = byHour.get(hour) ?? null;
        return {
          hour,
          insight: h,
          sales: pick(h?.sales),
          orders: pick(h?.orders),
          onClock: pick(h?.headcount),
          usuallyScheduled: h?.scheduled ?? null,
          planned: plannedDay ? plannedDay[hour] : null,
          splh: pick(h?.splh),
          odd: oddHours.has(hour),
          volatile: Boolean(h?.sales?.volatile || h?.headcount?.volatile),
        };
      });
  }, [day, dayAnomalies, plannedDay, basis, cutoff]);

  const volatileCount = rows.filter((r) => r.volatile).length;
  const unavailable = data
    ? (["sales", "staffing"] as const).filter((k) => data.sources[k] === "error")
    : [];

  return (
    <Card className="p-0" data-guide-id="sched-staffing-guide">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">Staffing guide</span>
            <span className="truncate text-xs text-muted-foreground">
              Sales and people on the clock, from the last 4 weeks
            </span>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>

          {open && (
            <div
              role="group"
              aria-label="Which weeks to count"
              className="flex overflow-hidden rounded-md border text-xs"
            >
              {(
                [
                  ["typical", "Typical"],
                  ["avg", "All days"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={basis === value}
                  onClick={() => setBasis(value)}
                  className={cn(
                    "px-2.5 py-1",
                    basis === value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {open && (
          <div className="space-y-3 border-t px-3 py-3 sm:px-4">
            {isLoading && !data && <Skeleton className="h-56 w-full" />}

            {error && !data && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={retry}>
                  Try again
                </Button>
              </div>
            )}

            {data && (
              <>
                {unavailable.length > 0 && (
                  <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {unavailable.includes("sales")
                      ? "Sales history is unavailable right now, so only staffing is shown."
                      : "Staffing history is unavailable right now, so only sales are shown."}
                  </p>
                )}

                {/* Day tabs, in the grid's own column order */}
                <div role="tablist" aria-label="Day" className="flex flex-wrap gap-1">
                  {week.dayNames.map((name, i) => {
                    const dow = (week.weekStartDow + i) % 7;
                    const d = data.weekdays.find((x) => x.weekday === dow);
                    return (
                      <button
                        key={name}
                        type="button"
                        role="tab"
                        aria-selected={dayIndex === i}
                        onClick={() => setDayIndex(i)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs",
                          dayIndex === i
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        {week.dayNamesShort?.[i] ?? name.slice(0, 3)}
                        {d && d.weeksInWindow > 0 && (
                          <span className="ml-1 opacity-70">
                            {Math.max(d.daysSampled.sales, d.daysSampled.staffing)}/
                            {d.weeksInWindow}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!day || rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No history for this day in the last 4 weeks.
                  </p>
                ) : (
                  <>
                    <DaySummary day={day} basis={basis} />

                    <p className="text-xs text-muted-foreground">
                      Based on{" "}
                      {Math.max(day.daysSampled.sales, day.daysSampled.staffing)} of{" "}
                      {day.weeksInWindow} {day.name}s
                      {day.skippedDates.length > 0 &&
                        ` (no data on ${day.skippedDates.map(dateLabel).join(", ")})`}
                      .
                    </p>

                    {dayAnomalies.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/20">
                        <p className="mb-1 text-xs font-medium">Keep in mind</p>
                        <ul className="space-y-1">
                          {dayAnomalies.slice(0, 6).map((a, i) => (
                            <li key={i} className="flex gap-2 text-xs">
                              {a.kind === "spike" ? (
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                              ) : (
                                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                              )}
                              <span>{describe(a, day.name)}</span>
                            </li>
                          ))}
                        </ul>
                        {basis === "typical" && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            The figures below leave these out. Switch to &quot;All days&quot; to count them.
                          </p>
                        )}
                      </div>
                    )}

                    {volatileCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {volatileCount} hour{volatileCount !== 1 ? "s" : ""} here vary a lot from
                        week to week, so treat those as rough.
                      </p>
                    )}

                    <HourChart rows={rows} hasPlan={hasPlan} />

                    <HourTable
                      rows={rows}
                      hasPlan={hasPlan}
                      hovered={hovered}
                      onHover={setHovered}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Day summary ─────────────────────────────────────────────────────────── */

function DaySummary({ day, basis }: { day: InsightDay; basis: Basis }) {
  const d = day.daily;
  const other: Basis = basis === "typical" ? "avg" : "typical";

  const chips: { label: string; value: string; alt?: string }[] = [];

  if (d.sales) {
    chips.push({
      label: "Sales",
      value: money(d.sales[basis]),
      alt: d.sales.avg !== d.sales.typical ? `${money(d.sales[other])} ${other === "avg" ? "with odd days" : "typical"}` : undefined,
    });
  }
  if (d.orders) chips.push({ label: "Orders", value: Math.round(d.orders[basis]).toString() });
  if (d.laborHours) {
    chips.push({
      label: "Labor hours",
      value: `${Math.round(d.laborHours[basis])}h`,
      alt: d.laborHours.avg !== d.laborHours.typical ? `${Math.round(d.laborHours[other])}h ${other === "avg" ? "with odd days" : "typical"}` : undefined,
    });
  }
  if (d.laborCost) chips.push({ label: "Labor cost", value: money(d.laborCost[basis]) });
  if (d.laborPct) chips.push({ label: "Labor %", value: `${(d.laborPct[basis] * 100).toFixed(1)}%` });
  if (d.employeesWorked) chips.push({ label: "People worked", value: people(d.employeesWorked[basis]) });

  if (chips.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {chips.map((c) => (
        <div key={c.label} className="rounded-md border px-2.5 py-1.5">
          <p className="text-[11px] text-muted-foreground">{c.label}</p>
          <p className="text-sm font-semibold tabular-nums">{c.value}</p>
          {c.alt && <p className="text-[10px] text-muted-foreground">{c.alt}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Charts: sales above, people below, same hours ───────────────────────── */

/**
 * ApexCharts, like the rest of the dashboard (see `components/dspr/sales-chart.tsx`):
 * dynamic import with no SSR, hex colors branched on the resolved theme, and the
 * same default palette. Two charts share the hour axis rather than one chart with
 * two scales, so neither measure can be made to look like the other.
 */
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full" />,
});

const SALES_COLOR = "#008FFB";
const ON_CLOCK_COLOR = "#00E396";
const PLANNED_COLOR = "#FEB019";
const USUAL_COLOR = "#94A3B8";

function HourChart({ rows, hasPlan }: { rows: Row[]; hasPlan: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const categories = useMemo(() => rows.map((r) => hourLabel(r.hour, true)), [rows]);

  const base: ApexOptions = useMemo(
    () => ({
      chart: {
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
        group: "staffing-guide",
        animations: { enabled: false },
      },
      theme: { mode: isDark ? "dark" : "light" },
      dataLabels: { enabled: false },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      legend: { position: "top", horizontalAlign: "left", fontSize: "10px", labels: { colors: isDark ? "#a1a1aa" : "#71717a" } },
      xaxis: {
        categories,
        labels: { style: { fontSize: "10px", colors: isDark ? "#a1a1aa" : "#71717a" } },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks: { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      tooltip: { shared: true, intersect: false },
    }),
    [categories, isDark],
  );

  const salesSeries = useMemo(
    () => [{ name: "Sales", data: rows.map((r) => Math.round(r.sales ?? 0)) }],
    [rows],
  );

  const salesOptions: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "bar", height: 170 },
      colors: [SALES_COLOR],
      plotOptions: { bar: { borderRadius: 4, columnWidth: "50%" } },
      fill: { opacity: 0.85 },
      yaxis: {
        labels: {
          formatter: (v: number) => (v == null ? "" : `$${v.toLocaleString()}`),
          style: { fontSize: "10px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
      },
      tooltip: { ...base.tooltip, y: { formatter: (v: number) => `$${v.toLocaleString()}` } },
    }),
    [base, isDark],
  );

  const peopleSeries = useMemo(() => {
    const s: { name: string; data: (number | null)[] }[] = [
      { name: "On the clock", data: rows.map((r) => (r.onClock === null ? null : Math.round(r.onClock * 10) / 10)) },
      { name: "Usually scheduled", data: rows.map((r) => (r.usuallyScheduled === null ? null : Math.round(r.usuallyScheduled * 10) / 10)) },
    ];
    if (hasPlan) {
      s.push({ name: "Planned this week", data: rows.map((r) => (r.planned === null ? null : Math.round(r.planned * 10) / 10)) });
    }
    return s;
  }, [rows, hasPlan]);

  const peopleOptions: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "line", height: 170 },
      colors: hasPlan ? [ON_CLOCK_COLOR, USUAL_COLOR, PLANNED_COLOR] : [ON_CLOCK_COLOR, USUAL_COLOR],
      stroke: { width: [3, 2, 3], curve: "straight", dashArray: [0, 3, 6] },
      markers: { size: 3 },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          formatter: (v: number) => (v == null ? "" : `${Math.round(v * 10) / 10}`),
          style: { fontSize: "10px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
        title: { text: "People", style: { color: isDark ? "#a1a1aa" : "#71717a" } },
      },
    }),
    [base, hasPlan, isDark],
  );

  return (
    <div className="space-y-1">
      <ReactApexChart options={salesOptions} series={salesSeries} type="bar" height={170} />
      <ReactApexChart options={peopleOptions} series={peopleSeries} type="line" height={170} />
    </div>
  );
}

/* ── Table: the same numbers, and where the plan departs from them ───────── */

function HourTable({
  rows,
  hasPlan,
  hovered,
  onHover,
}: {
  rows: Row[];
  hasPlan: boolean;
  hovered: number | null;
  onHover: (hour: number | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 pr-2 font-normal">Hour</th>
            <th className="px-2 py-1 text-right font-normal">Sales</th>
            <th className="px-2 py-1 text-right font-normal">Orders</th>
            <th className="px-2 py-1 text-right font-normal">On the clock</th>
            <th className="px-2 py-1 text-right font-normal">Usually scheduled</th>
            {hasPlan && <th className="px-2 py-1 text-right font-normal">Planned now</th>}
            <th className="px-2 py-1 text-right font-normal">Sales / person</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap =
              hasPlan && r.planned !== null && r.onClock !== null ? r.planned - r.onClock : null;
            const short = gap !== null && gap <= -PLAN_SHORTFALL;
            const over = gap !== null && gap >= PLAN_SURPLUS;
            return (
              <tr
                key={r.hour}
                onMouseEnter={() => onHover(r.hour)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "border-b last:border-0",
                  hovered === r.hour && "bg-muted/50",
                  short && "bg-amber-50 dark:bg-amber-950/30",
                  over && "bg-blue-50 dark:bg-blue-950/30",
                )}
              >
                <td className="py-1 pr-2">
                  {hourLabel(r.hour)}
                  {r.odd && <span className="ml-1 text-amber-600" title="An odd week at this hour">●</span>}
                </td>
                <td className="px-2 py-1 text-right">{r.sales === null ? "–" : money(r.sales)}</td>
                <td className="px-2 py-1 text-right">{r.orders === null ? "–" : Math.round(r.orders)}</td>
                <td className="px-2 py-1 text-right">{r.onClock === null ? "–" : people(r.onClock)}</td>
                <td className="px-2 py-1 text-right">{r.usuallyScheduled === null ? "–" : people(r.usuallyScheduled)}</td>
                {hasPlan && (
                  <td className="px-2 py-1 text-right">
                    {r.planned === null ? "–" : people(r.planned)}
                    {short && <span className="ml-1 text-amber-700 dark:text-amber-400">fewer</span>}
                    {over && <span className="ml-1 text-blue-700 dark:text-blue-400">more</span>}
                  </td>
                )}
                <td className="px-2 py-1 text-right">{r.splh === null ? "–" : money(r.splh)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasPlan && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Amber: planned at least {PLAN_SHORTFALL} person under the people usually on the clock. Blue: at least{" "}
          {PLAN_SURPLUS} over.
        </p>
      )}
    </div>
  );
}
