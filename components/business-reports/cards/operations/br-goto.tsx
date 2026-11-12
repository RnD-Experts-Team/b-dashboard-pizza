"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1DataRow, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import type { OperationsMetrics, OperationsSection, ReportWeek } from "@/types/business-reports.types";
import {
  Count,
  CountDelta,
  PpDelta,
  TrendChart,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "./br-shared";

type Row = StoreRow<OperationsMetrics>;
type Week = ReportWeek & OperationsMetrics;
interface WeekRow {
  week: Week;
  prev: Week | null;
}

const [STORE_COLOR, MGR_COLOR, CC_COLOR] = CATEGORIES.operations.chartColors;
const MISSED_COLOR = "#ef4444";
const fmtWhole = (v: number): string => v.toFixed(0);
const fmtAxisPct = (v: number): string => `${v.toFixed(0)}%`;

const answeredOf = (m: OperationsMetrics) => Math.max(0, m.calls_total - m.calls_missed);
const missedPct = (m: OperationsMetrics) => share(m.calls_missed, m.calls_total);

/** Call columns read through `get`, shared by the week and store tables. */
function callColumns<T>(get: (row: T) => OperationsMetrics): PagedColumn<T>[] {
  return [
    { key: "total", header: "Total", numeric: true, sortValue: (r) => get(r).calls_total, render: (r) => fmtNum(get(r).calls_total) },
    { key: "answered", header: "Answered", numeric: true, sortValue: (r) => answeredOf(get(r)), render: (r) => fmtNum(answeredOf(get(r))) },
    {
      key: "missed",
      header: "Missed",
      numeric: true,
      sortValue: (r) => get(r).calls_missed,
      render: (r) => (
        <span className={get(r).calls_missed > 0 ? "text-red-600 dark:text-red-400" : undefined}>{fmtNum(get(r).calls_missed)}</span>
      ),
    },
    { key: "missed_pct", header: "Missed %", numeric: true, sortValue: (r) => missedPct(get(r)), render: (r) => fmtPct(missedPct(get(r))) },
    { key: "store_src", header: "Store", numeric: true, sortValue: (r) => get(r).calls_store, render: (r) => fmtNum(get(r).calls_store) },
    { key: "mgr", header: "Store Mgr", numeric: true, sortValue: (r) => get(r).calls_store_manager, render: (r) => fmtNum(get(r).calls_store_manager) },
    { key: "cc", header: "Call Center", numeric: true, sortValue: (r) => get(r).calls_call_center, render: (r) => fmtNum(get(r).calls_call_center) },
  ];
}

const STORE_COLUMNS: PagedColumn<Row>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...callColumns<Row>((r) => r.data),
];

function GoToDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const rows = useStoreRows(data.by_store);
  const focus = useStoreFocus<Row>();
  const labelOf = useWeekLabel(data.by_week);
  const weeks = useMemo<WeekRow[]>(() => withPrev(data.by_week).map(({ row, prev }) => ({ week: row, prev })), [data.by_week]);
  const categories = useMemo(() => data.by_week.map((w) => labelOf(w.week_start)), [data.by_week, labelOf]);
  const sourceSeries = useMemo(
    () => [
      { name: "Store", data: data.by_week.map((w) => w.calls_store), color: STORE_COLOR },
      { name: "Store manager", data: data.by_week.map((w) => w.calls_store_manager), color: MGR_COLOR },
      { name: "Call center", data: data.by_week.map((w) => w.calls_call_center), color: CC_COLOR },
    ],
    [data.by_week],
  );
  const missedSeries = useMemo(
    () => [{ name: "Missed %", data: data.by_week.map((w) => missedPct(w)), color: MISSED_COLOR }],
    [data.by_week],
  );
  const weekColumns = useMemo<PagedColumn<WeekRow>[]>(() => {
    /** The Δ column that follows each of these columns. */
    const deltaAfter: Record<string, PagedColumn<WeekRow>> = {
      total: {
        key: "total_d",
        header: "Δ Total",
        numeric: true,
        render: (r) => <CountDelta curr={r.week.calls_total} prev={r.prev?.calls_total} goodWhen="neutral" />,
      },
      missed_pct: {
        key: "missed_d",
        header: "Δ Missed %",
        numeric: true,
        render: (r) => <PpDelta curr={missedPct(r.week)} prev={r.prev ? missedPct(r.prev) : null} goodWhen="down" />,
      },
    };
    return [
      { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) },
      ...callColumns<WeekRow>((r) => r.week).flatMap((c) => (deltaAfter[c.key] ? [c, deltaAfter[c.key]] : [c])),
    ];
  }, [labelOf]);
  const t = data.totals;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Calls by source, by week">
            <TrendChart kind="bar" stacked categories={categories} series={sourceSeries} format={fmtWhole} />
          </ReportBlock>
          <ReportBlock title="Missed % by week" description="Lower is better.">
            <TrendChart categories={categories} series={missedSeries} format={fmtAxisPct} tooltipFormat={fmtPct} />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: <PagedTable size="lg" rows={weeks} columns={weekColumns} rowKey={(r) => r.week.week_start} initialSort="week" />,
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={rows}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="total"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Go-To Calls"
      category="operations"
      stats={[
        { label: "Total calls", value: fmtNum(t.calls_total) },
        { label: "Answered", value: fmtNum(answeredOf(t)), tone: "text-emerald-600 dark:text-emerald-400" },
        {
          label: "Missed",
          value: fmtNum(t.calls_missed),
          sub: `${fmtPct(missedPct(t))} of calls`,
          tone: t.calls_missed > 0 ? "text-red-600 dark:text-red-400" : undefined,
        },
        { label: "Store", value: fmtNum(t.calls_store), sub: "source" },
        { label: "Store manager", value: fmtNum(t.calls_store_manager), sub: "source" },
        { label: "Call center", value: fmtNum(t.calls_call_center), sub: "source" },
      ]}
      tabs={tabs}
    />
  );
}

/** Go-To call volume over the range, with the source breakdown. */
export function BrGoToCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;
  const answered = answeredOf(t);

  return (
    <V1Card reportId="br-goto" title="Go-To Calls" category="operations" period="R" span={1} onExpand={() => setOpen(true)}>
      <div className="space-y-2">
        <V1MetricGrid cols={3}>
          <V1Metric label="Total Calls" value={<Count value={t.calls_total} />} />
          <V1Metric label="Answered" value={<Count value={answered} />} accent="text-emerald-600 dark:text-emerald-400" />
          <V1Metric
            label="Missed"
            value={<Count value={t.calls_missed} />}
            sub={t.calls_total > 0 ? fmtPct(missedPct(t)) : undefined}
            accent={t.calls_missed > 0 ? "text-red-600 dark:text-red-400" : undefined}
          />
        </V1MetricGrid>
        <div>
          <V1SubLabel className="mb-0.5">Source Breakdown</V1SubLabel>
          <V1DataRow label="Store" value={<Count value={t.calls_store} />} />
          <V1DataRow label="Store Manager" value={<Count value={t.calls_store_manager} />} />
          <V1DataRow label="Call Center" value={<Count value={t.calls_call_center} />} />
        </div>
      </div>
      {open && <GoToDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
