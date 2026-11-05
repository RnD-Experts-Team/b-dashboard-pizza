"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric } from "@/components/dashboard-v1/v1-ui";
import { fmtCurrency, fmtHours, fmtNumber, fmtPercent } from "@/components/labor/labor-format";
import { preferFinal, useFinalLabor, type FinalLabor } from "@/components/business-reports/final-labor";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { weekLabel } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { LaborBlock, LaborReport, LaborTrendWeek } from "@/types/business-reports.types";
import { LaborPctValue, fmtMoneyTile } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Labor Summary — the Labor report's KPI strip as V1 tiles, for every
 *  loaded store over the range. Expanding shows the same figures per store
 *  and per week, with FINAL labor % (Hiring) where it exists.
 * ────────────────────────────────────────────────────────────────────────── */

const AMBER = "text-amber-600 dark:text-amber-400";
const ROSE = "text-rose-600 dark:text-rose-400";
const EMERALD = "text-emerald-600 dark:text-emerald-400";

interface StoreRow {
  store: string;
  block: LaborBlock;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtNumber(n)}`;
}

function netAccent(n: number): string | undefined {
  if (n > 0) return EMERALD;
  if (n < 0) return ROSE;
  return undefined;
}

/** A store's or week's labor %: final when Hiring has it, else the derived one. */
function laborOf(final: number | null | undefined, derived: number | null): { value: number | null; isFinal: boolean } {
  if (derived === null) return { value: final ?? null, isFinal: final !== null && final !== undefined };
  return preferFinal(final, derived);
}

function storeLabor(final: FinalLabor | null, r: StoreRow) {
  return laborOf(final?.byStore.get(r.store), r.block.labor.highlights.average_labor_percent);
}

function LaborSummaryDialog({ data, rows, onClose }: { data: LaborReport; rows: StoreRow[]; onClose: () => void }) {
  const { storeName } = useReport();
  const final = useFinalLabor();
  const s = data.combined.summary;
  const overall = laborOf(final?.overall, data.combined.labor.highlights.average_labor_percent);

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
        sortValue: (r) => storeName(r.store),
      },
      {
        key: "start",
        header: "Start",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.headcount_start),
        sortValue: (r) => r.block.summary.headcount_start,
      },
      {
        key: "end",
        header: "End",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.headcount_end),
        sortValue: (r) => r.block.summary.headcount_end,
      },
      {
        key: "net",
        header: "Net",
        numeric: true,
        render: (r) => {
          const n = r.block.summary.headcount_end - r.block.summary.headcount_start;
          return <span className={netAccent(n)}>{signed(n)}</span>;
        },
        sortValue: (r) => r.block.summary.headcount_end - r.block.summary.headcount_start,
      },
      {
        key: "hires",
        header: "Hires",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.new_hires),
        sortValue: (r) => r.block.summary.new_hires,
      },
      {
        key: "seps",
        header: "Separations",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.separations),
        sortValue: (r) => r.block.summary.separations,
      },
      {
        key: "notable",
        header: "Notable",
        numeric: true,
        render: (r) => (
          <span className={cn(r.block.summary.notable_departures > 0 && AMBER)}>
            {fmtNumber(r.block.summary.notable_departures)}
          </span>
        ),
        sortValue: (r) => r.block.summary.notable_departures,
      },
      {
        key: "turnover",
        header: "Turnover",
        numeric: true,
        render: (r) => fmtPercent(r.block.summary.turnover_rate_percent),
        sortValue: (r) => r.block.summary.turnover_rate_percent,
      },
      {
        key: "labor",
        header: "Labor %",
        numeric: true,
        render: (r) => {
          const l = storeLabor(final, r);
          return <LaborPctValue value={l.value} isFinal={l.isFinal} />;
        },
        sortValue: (r) => storeLabor(final, r).value,
      },
      {
        key: "gross",
        header: "Avg Wk Gross",
        numeric: true,
        render: (r) => fmtCurrency(r.block.summary.avg_weekly_gross_pay, 0),
        sortValue: (r) => r.block.summary.avg_weekly_gross_pay,
      },
      {
        key: "hours",
        header: "Avg Wk Hours",
        numeric: true,
        render: (r) => fmtHours(r.block.summary.avg_weekly_hours),
        sortValue: (r) => r.block.summary.avg_weekly_hours,
      },
      {
        key: "o40",
        header: "Wks >40h",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.employee_weeks_over_40),
        sortValue: (r) => r.block.summary.employee_weeks_over_40,
      },
      {
        key: "o60",
        header: "Wks >60h",
        numeric: true,
        render: (r) => (
          <span className={cn(r.block.summary.employee_weeks_over_60 > 0 && ROSE)}>
            {fmtNumber(r.block.summary.employee_weeks_over_60)}
          </span>
        ),
        sortValue: (r) => r.block.summary.employee_weeks_over_60,
      },
    ],
    [storeName, final],
  );

  const weekColumns = useMemo<PagedColumn<LaborTrendWeek>[]>(
    () => [
      { key: "week", header: "Week", render: (w) => <span className="font-medium">{weekLabel(w, true)}</span>, sortValue: (w) => w.week_start },
      { key: "headcount", header: "Headcount", numeric: true, render: (w) => fmtNumber(w.headcount_active_end), sortValue: (w) => w.headcount_active_end },
      { key: "hours", header: "Hours", numeric: true, render: (w) => fmtHours(w.total_hours, 0), sortValue: (w) => w.total_hours },
      { key: "gross", header: "Gross Pay", numeric: true, render: (w) => fmtCurrency(w.total_gross_pay, 0), sortValue: (w) => w.total_gross_pay },
      { key: "sales", header: "Sales", numeric: true, render: (w) => fmtCurrency(w.total_sales, 0), sortValue: (w) => w.total_sales },
      {
        key: "labor",
        header: "Labor %",
        numeric: true,
        render: (w) => {
          const l = laborOf(final?.byWeek.get(w.week_start), w.average_labor_percent);
          return <LaborPctValue value={l.value} isFinal={l.isFinal} />;
        },
        sortValue: (w) => laborOf(final?.byWeek.get(w.week_start), w.average_labor_percent).value,
      },
      { key: "turnover", header: "Turnover", numeric: true, render: (w) => fmtPercent(w.turnover_rate_percent), sortValue: (w) => w.turnover_rate_percent },
      { key: "pay", header: "Avg Hourly", numeric: true, render: (w) => fmtCurrency(w.average_hourly_pay), sortValue: (w) => w.average_hourly_pay },
    ],
    [final],
  );

  const net = s.headcount_end - s.headcount_start;
  const stats: ReportStat[] = [
    { label: "Headcount", value: `${fmtNumber(s.headcount_start)} → ${fmtNumber(s.headcount_end)}`, sub: `${signed(net)} net`, tone: netAccent(net) },
    { label: "New hires", value: fmtNumber(s.new_hires), tone: s.new_hires > 0 ? EMERALD : undefined },
    { label: "Separations", value: fmtNumber(s.separations), sub: `${fmtNumber(s.notable_departures)} notable`, tone: s.separations > 0 ? ROSE : undefined },
    { label: "Turnover", value: fmtPercent(s.turnover_rate_percent) },
    { label: "Avg weekly gross", value: fmtMoneyTile(s.avg_weekly_gross_pay), sub: `${fmtHours(s.avg_weekly_hours, 0)} / week` },
    {
      label: overall.isFinal ? "Final labor" : "Labor (est.)",
      value: <LaborPctValue value={overall.value} isFinal={overall.isFinal} tagClassName="text-[10px]" />,
    },
  ];
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Labor Summary"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "stores",
          label: `By store (${rows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={rows}
              columns={columns}
              rowKey={(r) => r.store}
              initialSort="end"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "weeks",
          label: `By week (${data.combined.trend.length})`,
          content: (
            <PagedTable size="lg" rows={data.combined.trend} columns={weekColumns} rowKey={(w) => w.week_start} initialSort="week" initialDir="asc" />
          ),
        },
      ]}
    />
  );
}

export function BrLaborSummary({ data }: { data: LaborReport }) {
  const [open, setOpen] = useState(false);
  const s = data.combined.summary;
  const net = s.headcount_end - s.headcount_start;

  const rows = useMemo<StoreRow[]>(
    () => Object.entries(data.by_store).map(([store, block]) => ({ store, block })),
    [data.by_store],
  );
  const multiStore = rows.length > 1;

  return (
    <V1Card
      reportId="br-labor-summary"
      title="Labor Summary"
      category="people"
      period="R"
      span={4}
      className="h-auto"
      headerNote={multiStore ? `${rows.length} stores · click for per-store / per-week` : "click for per-week"}
      onExpand={() => setOpen(true)}
    >
      <div className="grid grid-cols-2 gap-1 pb-0.5 sm:grid-cols-3 lg:grid-cols-9">
        <V1Metric
          label="Headcount"
          value={
            <span className="inline-flex items-center gap-1">
              {fmtNumber(s.headcount_start)}
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              {fmtNumber(s.headcount_end)}
            </span>
          }
          sub={<span className={netAccent(net)}>{signed(net)} net</span>}
        />
        <V1Metric label="New Hires" value={fmtNumber(s.new_hires)} accent={s.new_hires > 0 ? EMERALD : undefined} />
        <V1Metric label="Separations" value={fmtNumber(s.separations)} accent={s.separations > 0 ? ROSE : undefined} />
        <V1Metric
          label="Notable Departures"
          value={fmtNumber(s.notable_departures)}
          sub={s.notable_departures > 0 ? "above-avg performers" : "none"}
          accent={s.notable_departures > 0 ? AMBER : undefined}
        />
        <V1Metric label="Turnover Rate" value={fmtPercent(s.turnover_rate_percent)} />
        <V1Metric
          label="Avg Weekly Gross"
          value={<span title={fmtCurrency(s.avg_weekly_gross_pay, 0)}>{fmtMoneyTile(s.avg_weekly_gross_pay)}</span>}
        />
        <V1Metric label="Avg Weekly Hours" value={fmtHours(s.avg_weekly_hours, 0)} />
        <V1Metric label="Emp-Weeks > 40h" value={fmtNumber(s.employee_weeks_over_40)} />
        <V1Metric
          label="Emp-Weeks > 60h"
          value={fmtNumber(s.employee_weeks_over_60)}
          accent={s.employee_weeks_over_60 > 0 ? ROSE : undefined}
        />
      </div>

      {open && <LaborSummaryDialog data={data} rows={rows} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
