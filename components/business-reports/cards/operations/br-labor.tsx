"use client";

import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Gauge } from "lucide-react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useSection } from "@/components/business-reports/report-context";
import {
  LABOR_ZONES,
  fmt$,
  fmtPct,
  fmtRange,
  laborColor,
  laborLabel,
  weekLabel,
} from "@/components/business-reports/report-format";
import type { LaborReport, SalesMetrics, SalesSection } from "@/types/business-reports.types";
import { NO_VALUE, PERCENT, meanOf, useStoreFocus, useStoreRows, type StoreRow } from "./br-shared";

/** The labor gauge's scale (V1: 0–50%). */
const LABOR_SCALE = 50;
const TARGET_LOW = 19;
const TARGET_HIGH = 24;
const TARGET_BAND_OPACITY = 0.12;
const BAR_RADIUS = 3;
const LABEL_ROTATE = -45;
const TARGET_GREEN = "#22C55E";

type LaborView = "labor" | "final";

const VIEW_OPTIONS: { value: LaborView; label: string }[] = [
  { value: "labor", label: "Labor" },
  { value: "final", label: "Final" },
];

/** Average of the weeks that have a final labor figure. */
function finalAverage(report: LaborReport | null): number | null {
  return report ? meanOf(report.combined.final_labor.map((w) => w.labor)) : null;
}

interface LaborStoreRow extends StoreRow<SalesMetrics> {
  finalAvg: number | null;
}

function LaborByWeekChart({ sales }: { sales: SalesSection }) {
  const theme = useChartTheme();
  const weeks = sales.by_week;
  const series = useMemo(
    () => [{ name: "Labor %", data: weeks.map((w) => Number(w.labor_percent.toFixed(1))) }],
    [weeks],
  );
  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent", foreColor: theme.label },
      theme: { mode: theme.mode },
      colors: weeks.map((w) => laborColor(w.labor_percent)),
      plotOptions: { bar: { distributed: true, borderRadius: BAR_RADIUS, columnWidth: "60%" } },
      dataLabels: { enabled: false },
      legend: { show: false },
      xaxis: {
        categories: weeks.map((w) => weekLabel(w)),
        labels: { rotate: LABEL_ROTATE, style: { fontSize: "9px", colors: theme.label } },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}%`, style: { fontSize: "10px", colors: theme.label } } },
      grid: { borderColor: theme.grid },
      annotations: {
        yaxis: [{ y: TARGET_LOW, y2: TARGET_HIGH, fillColor: TARGET_GREEN, opacity: TARGET_BAND_OPACITY, borderColor: "transparent" }],
      },
      tooltip: { theme: theme.mode, y: { formatter: (v: number) => `${v.toFixed(1)}% · ${laborLabel(v)}` } },
    }),
    [weeks, theme.label, theme.axis, theme.grid, theme.mode],
  );
  return <ApexChart key={theme.key} type="bar" height={220} options={options} series={series} />;
}

function FinalLaborWeeks({ report }: { report: LaborReport }) {
  return (
    <div className="space-y-1">
      {report.combined.final_labor.map((entry) => {
        const labor = entry.labor;
        const color = labor === null ? undefined : laborColor(labor);
        const barPct = labor === null ? 0 : Math.min(PERCENT, (labor / LABOR_SCALE) * PERCENT);
        return (
          <div key={entry.week_start} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/40">
            <span className="w-32 shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {fmtRange(entry.week_start, entry.week_end)}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              {labor !== null && (
                <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
              )}
            </div>
            <span className="w-12 text-end text-[11px] font-semibold tabular-nums" style={{ color }}>
              {labor === null ? NO_VALUE : fmtPct(labor)}
            </span>
            <span className="hidden w-20 text-end text-[9px] text-muted-foreground sm:block">
              {labor === null ? "" : laborLabel(labor)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LaborDialog({
  sales,
  labor,
  onClose,
}: {
  sales: SalesSection;
  labor: LaborReport | null;
  onClose: () => void;
}) {
  const base = useStoreRows(sales.by_store);
  const rows = useMemo<LaborStoreRow[]>(
    () =>
      base.map((r) => ({
        ...r,
        finalAvg: labor ? meanOf((labor.by_store[r.store]?.final_labor ?? []).map((w) => w.labor)) : null,
      })),
    [base, labor],
  );
  const focus = useStoreFocus<LaborStoreRow>();
  const finalAvg = finalAverage(labor);

  const columns = useMemo<PagedColumn<LaborStoreRow>[]>(
    () => [
      { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
      { key: "labor_cost", header: "Labor $", numeric: true, sortValue: (r) => r.data.labor_cost, render: (r) => fmt$(r.data.labor_cost) },
      {
        key: "labor_pct",
        header: "Labor %",
        numeric: true,
        sortValue: (r) => r.data.labor_percent,
        render: (r) => <span style={{ color: laborColor(r.data.labor_percent) }}>{fmtPct(r.data.labor_percent)}</span>,
      },
      {
        key: "final",
        header: "Final Avg",
        numeric: true,
        sortValue: (r) => r.finalAvg,
        render: (r) =>
          r.finalAvg === null ? NO_VALUE : <span style={{ color: laborColor(r.finalAvg) }}>{fmtPct(r.finalAvg)}</span>,
      },
    ],
    [],
  );

  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Labor" badgeText="Labor % · Final labor · By store">
      <div className="space-y-5">
        <V1MetricGrid cols={3}>
          <V1Metric label="Labor %" value={fmtPct(sales.totals.labor_percent)} sub={laborLabel(sales.totals.labor_percent)} />
          <V1Metric label="Final Avg" value={finalAvg === null ? NO_VALUE : fmtPct(finalAvg)} sub={labor ? "weeks with a figure" : "loading…"} />
          <V1Metric label="Labor $" value={fmt$(sales.totals.labor_cost)} sub="Target 19–24%" />
        </V1MetricGrid>
        <div>
          <V1SubLabel className="mb-1">Labor % by week</V1SubLabel>
          <LaborByWeekChart sales={sales} />
        </div>
        {labor && (
          <div>
            <V1SubLabel className="mb-1 flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Final labor by week
            </V1SubLabel>
            <FinalLaborWeeks report={labor} />
          </div>
        )}
        <div>
          <V1SubLabel className="mb-1">By store</V1SubLabel>
          <PagedTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.store}
            initialSort="labor_pct"
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        </div>
      </div>
    </WbrDetailDialog>
  );
}

/** Labor % (labor ÷ sales) gauge; "Final" shows Hiring's final labor once the labor report lands. */
export function BrLaborCard({ data }: { data: SalesSection }) {
  const labor = useSection("labor").data;
  const [view, setView] = useState<LaborView>("labor");
  const [open, setOpen] = useState(false);
  const finalAvg = useMemo(() => finalAverage(labor), [labor]);
  const hasFinal = finalAvg !== null;
  const showFinal = view === "final" && hasFinal;
  const value = showFinal ? finalAvg : data.totals.labor_percent;

  return (
    <V1Card
      reportId="br-labor"
      title="Labor"
      category="operations"
      period="R"
      span={1}
      showPeriodBadge={!hasFinal}
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
      headerControl={
        hasFinal ? <V1Toggle className="ms-1" options={VIEW_OPTIONS} value={view} onChange={setView} /> : undefined
      }
    >
      <div className="flex flex-col">
        <div className="mx-auto w-full max-w-[260px]">
          <SpeedometerGauge
            value={value}
            max={50}
            zones={LABOR_ZONES}
            statusLabel={laborLabel(value)}
            statusColor="#DC2626"
            valueDisplay={fmtPct(value)}
          />
        </div>
        <p className="text-center text-[9px] font-medium text-muted-foreground">
          {showFinal ? "Final labor, avg of weeks · " : ""}Target range:{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">19–24%</span>
        </p>
      </div>
      {open && <LaborDialog sales={data} labor={labor} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
