"use client";

import { useMemo, useState } from "react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import { PERFORMANCE_ZONES, getPerformanceLabel } from "@/components/dspr/portal-meter-utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { OperationsMetrics, OperationsSection, ReportWeek } from "@/types/business-reports.types";
import {
  Count,
  PpDelta,
  TrendChart,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "./br-shared";

const [PUT_COLOR, ONTIME_COLOR] = CATEGORIES.operations.chartColors;
const fmtAxisPct = (v: number): string => `${v.toFixed(0)}%`;

type PortalFields = Pick<
  OperationsMetrics,
  | "put_into_portal_percent"
  | "in_portal_on_time_percent"
  | "portal_eligible_orders"
  | "portal_used_orders"
  | "portal_on_time_orders"
>;

/** The five portal columns, read through `get` so week and store rows share them. */
function portalColumns<T>(get: (row: T) => PortalFields): PagedColumn<T>[] {
  return [
    { key: "put", header: "Put %", numeric: true, sortValue: (r) => get(r).put_into_portal_percent, render: (r) => fmtPct(get(r).put_into_portal_percent) },
    { key: "ontime_pct", header: "On-Time %", numeric: true, sortValue: (r) => get(r).in_portal_on_time_percent, render: (r) => fmtPct(get(r).in_portal_on_time_percent) },
    { key: "eligible", header: "Eligible", numeric: true, sortValue: (r) => get(r).portal_eligible_orders, render: (r) => fmtNum(get(r).portal_eligible_orders) },
    { key: "used", header: "Used", numeric: true, sortValue: (r) => get(r).portal_used_orders, render: (r) => fmtNum(get(r).portal_used_orders) },
    { key: "ontime", header: "On Time", numeric: true, sortValue: (r) => get(r).portal_on_time_orders, render: (r) => fmtNum(get(r).portal_on_time_orders) },
  ];
}

type Week = ReportWeek & OperationsMetrics;
interface WeekRow {
  week: Week;
  prev: Week | null;
}

const STORE_COLUMNS: PagedColumn<StoreRow<OperationsMetrics>>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...portalColumns<StoreRow<OperationsMetrics>>((r) => r.data),
];

function PortalDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const stores = useStoreRows(data.by_store);
  const focus = useStoreFocus<StoreRow<OperationsMetrics>>();
  const labelOf = useWeekLabel(data.by_week);
  const weeks = useMemo<WeekRow[]>(() => withPrev(data.by_week).map(({ row, prev }) => ({ week: row, prev })), [data.by_week]);
  const categories = useMemo(() => data.by_week.map((w) => labelOf(w.week_start)), [data.by_week, labelOf]);
  const series = useMemo(
    () => [
      { name: "Put into portal %", data: data.by_week.map((w) => w.put_into_portal_percent), color: PUT_COLOR },
      { name: "On-time %", data: data.by_week.map((w) => w.in_portal_on_time_percent), color: ONTIME_COLOR },
    ],
    [data.by_week],
  );
  const weekColumns = useMemo<PagedColumn<WeekRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) },
      { key: "put", header: "Put %", numeric: true, sortValue: (r) => r.week.put_into_portal_percent, render: (r) => fmtPct(r.week.put_into_portal_percent) },
      { key: "put_d", header: "Δ Put", numeric: true, render: (r) => <PpDelta curr={r.week.put_into_portal_percent} prev={r.prev?.put_into_portal_percent} /> },
      { key: "ontime_pct", header: "On-Time %", numeric: true, sortValue: (r) => r.week.in_portal_on_time_percent, render: (r) => fmtPct(r.week.in_portal_on_time_percent) },
      { key: "ontime_d", header: "Δ On-Time", numeric: true, render: (r) => <PpDelta curr={r.week.in_portal_on_time_percent} prev={r.prev?.in_portal_on_time_percent} /> },
      { key: "eligible", header: "Eligible", numeric: true, sortValue: (r) => r.week.portal_eligible_orders, render: (r) => fmtNum(r.week.portal_eligible_orders) },
      { key: "used", header: "Used", numeric: true, sortValue: (r) => r.week.portal_used_orders, render: (r) => fmtNum(r.week.portal_used_orders) },
      { key: "ontime", header: "On Time", numeric: true, sortValue: (r) => r.week.portal_on_time_orders, render: (r) => fmtNum(r.week.portal_on_time_orders) },
    ],
    [labelOf],
  );
  const t = data.totals;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Portal % by week" description="Put into portal and in-portal on time, each week of the range.">
          <TrendChart categories={categories} series={series} format={fmtAxisPct} tooltipFormat={fmtPct} />
        </ReportBlock>
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
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="put"
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
      title="Portal Performance"
      category="operations"
      stats={[
        { label: "Put into portal", value: fmtPct(t.put_into_portal_percent), sub: getPerformanceLabel(t.put_into_portal_percent) },
        { label: "On time", value: fmtPct(t.in_portal_on_time_percent), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Eligible", value: fmtNum(t.portal_eligible_orders), sub: "orders" },
        { label: "Used", value: fmtNum(t.portal_used_orders), sub: "orders" },
        { label: "On-time orders", value: fmtNum(t.portal_on_time_orders) },
      ]}
      tabs={tabs}
    />
  );
}

/** Put-into-portal gauge with the on-time needle, over every loaded store and day. */
export function BrPortalCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;
  const primary = t.put_into_portal_percent;
  const status = useMemo(() => getPerformanceLabel(primary), [primary]);

  return (
    <V1Card
      reportId="br-portal"
      title="Portal Performance"
      category="operations"
      period="R"
      span={1}
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
    >
      <div className="flex flex-col gap-1">
        <div className="mx-auto w-full max-w-[260px]">
          <SpeedometerGauge
            value={primary}
            secondaryValue={t.in_portal_on_time_percent}
            secondaryColor="#22C55E"
            secondaryLabel=""
            zones={PERFORMANCE_ZONES}
            statusLabel={status}
            statusColor="#DC2626"
            valueDisplay={fmtPct(primary)}
          />
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="flex items-center gap-1 text-[8px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Put Into Portal
          </span>
          <span className="flex items-center gap-1 text-[8px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Time {fmtPct(t.in_portal_on_time_percent)}
          </span>
        </div>
        <V1MetricGrid cols={3}>
          <V1Metric size="sm" label="Eligible" value={<Count value={t.portal_eligible_orders} />} />
          <V1Metric size="sm" label="Used" value={<Count value={t.portal_used_orders} />} />
          <V1Metric size="sm" label="On Time" value={<Count value={t.portal_on_time_orders} />} />
        </V1MetricGrid>
      </div>
      {open && <PortalDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
