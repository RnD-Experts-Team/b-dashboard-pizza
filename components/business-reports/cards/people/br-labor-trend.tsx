"use client";

import { useMemo, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { DASH, TREND_METRICS, fmtDelta, type TrendMetricConfig } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { pctChangeOrNull } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { LaborReport, LaborTrendWeek } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, peopleLineOptions, safeDay } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Weekly Trend — the Labor report's trend chart over every week of the
 *  range, with the best / worst week and first-vs-last week change.
 * ────────────────────────────────────────────────────────────────────────── */

type TrendKey = Exclude<keyof LaborTrendWeek, "week_start" | "week_end">;

const TREND_KEYS: ReadonlySet<string> = new Set<TrendKey>([
  "headcount_active_end",
  "total_hours",
  "total_gross_pay",
  "turnover_rate_percent",
  "total_sales",
  "average_performance_score",
  "average_hourly_pay",
  "average_labor_percent",
]);

function isTrendKey(key: string): key is TrendKey {
  return TREND_KEYS.has(key);
}

const METRICS = TREND_METRICS.filter((m) => isTrendKey(m.key));
const CHART_PX = 190;

interface Point {
  week: LaborTrendWeek;
  value: number;
}

function Callout({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "bad" | "neutral";
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-background/55 px-2 py-1">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "flex items-center gap-1 text-[13px] font-bold leading-tight tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span className="truncate">{value}</span>
      </p>
      <p className="truncate text-[9.5px] text-muted-foreground/80">{sub}</p>
    </div>
  );
}

function deltaTone(delta: number | null, config: TrendMetricConfig): "good" | "bad" | "neutral" {
  if (delta === null || delta === 0) return "neutral";
  return delta > 0 === config.higherIsBetter ? "good" : "bad";
}

function deltaIcon(delta: number | null): typeof TrendingUp {
  if (delta === null || delta === 0) return Minus;
  return delta > 0 ? TrendingUp : TrendingDown;
}

export function BrLaborTrend({ data }: { data: LaborReport }) {
  const theme = useChartTheme();
  const [metricKey, setMetricKey] = useState<string>("headcount_active_end");
  const config = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const weeks = data.combined.trend;

  const values = useMemo(
    () => weeks.map((w) => (isTrendKey(config.key) ? w[config.key] : null)),
    [weeks, config],
  );

  const options = useMemo(
    () => peopleLineOptions(theme, weeks.map((w) => safeDay(w.week_start)), (v) => config.format(v)),
    [theme, weeks, config],
  );
  const series = useMemo(() => [{ name: config.label, data: values }], [config, values]);

  const stats = useMemo(() => {
    const points = weeks.reduce<Point[]>((acc, week, i) => {
      const value = values[i];
      return value === null || value === undefined ? acc : [...acc, { week, value }];
    }, []);
    if (points.length === 0) return null;
    const better = (a: Point, b: Point) => (config.higherIsBetter ? a.value > b.value : a.value < b.value);
    const best = points.reduce((m, p) => (better(p, m) ? p : m));
    const worst = points.reduce((m, p) => (better(m, p) ? p : m));
    const first = points[0];
    const last = points[points.length - 1];
    return { best, worst, first, last, delta: points.length > 1 ? pctChangeOrNull(last.value, first.value) : null };
  }, [weeks, values, config]);

  return (
    <V1Card
      reportId="br-labor-trend"
      title="Weekly Trend"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      headerControl={
        weeks.length > 0 ? (
          <div className="ms-1.5" onClick={(e) => e.stopPropagation()}>
            <Select value={config.key} onValueChange={setMetricKey}>
              <SelectTrigger size="sm" className="h-6! w-36 px-2 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : undefined
      }
    >
      {weeks.length === 0 ? (
        <V1Empty icon={TrendingUp}>No weekly labor data in this range</V1Empty>
      ) : (
        <div className="space-y-1">
          <ApexChart key={theme.key} options={options} series={series} type="line" height={CHART_PX} />
          {stats ? (
            <div className="grid grid-cols-3 gap-1">
              <Callout label="Best week" value={config.format(stats.best.value)} sub={safeDay(stats.best.week.week_start)} tone="good" />
              <Callout label="Worst week" value={config.format(stats.worst.value)} sub={safeDay(stats.worst.week.week_start)} tone="bad" />
              <Callout
                label="First → last week"
                value={stats.delta === null ? DASH : fmtDelta(stats.delta)}
                sub={`${config.format(stats.first.value)} → ${config.format(stats.last.value)}`}
                tone={deltaTone(stats.delta, config)}
                icon={deltaIcon(stats.delta)}
              />
            </div>
          ) : (
            <p className="text-center text-[11px] text-muted-foreground">No {config.label.toLowerCase()} recorded</p>
          )}
        </div>
      )}
    </V1Card>
  );
}
