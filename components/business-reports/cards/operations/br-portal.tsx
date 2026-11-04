"use client";

import { useMemo, useState } from "react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import { PERFORMANCE_ZONES, getPerformanceLabel } from "@/components/dspr/portal-meter-utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmtNum, fmtPct, weekLabel } from "@/components/business-reports/report-format";
import type { OperationsMetrics, OperationsSection, ReportWeek } from "@/types/business-reports.types";
import { useStoreFocus, useStoreRows, type StoreRow } from "./br-shared";

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

type WeekRow = ReportWeek & OperationsMetrics;

const WEEK_COLUMNS: PagedColumn<WeekRow>[] = [
  { key: "week", header: "Week", sortValue: (w) => w.week_start, render: (w) => weekLabel(w), className: "whitespace-nowrap" },
  ...portalColumns<WeekRow>((w) => w),
];

const STORE_COLUMNS: PagedColumn<StoreRow<OperationsMetrics>>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...portalColumns<StoreRow<OperationsMetrics>>((r) => r.data),
];

function PortalDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const stores = useStoreRows(data.by_store);
  const focus = useStoreFocus<StoreRow<OperationsMetrics>>();
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Portal Performance" badgeText="By week · By store">
      <div className="space-y-5">
        <div>
          <V1SubLabel className="mb-1">By week</V1SubLabel>
          <PagedTable rows={data.by_week} columns={WEEK_COLUMNS} rowKey={(w) => w.week_start} initialSort="week" />
        </div>
        <div>
          <V1SubLabel className="mb-1">By store</V1SubLabel>
          <PagedTable
            rows={stores}
            columns={STORE_COLUMNS}
            rowKey={(r) => r.store}
            initialSort="put"
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        </div>
      </div>
    </WbrDetailDialog>
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
          <V1Metric size="sm" label="Eligible" value={fmtNum(t.portal_eligible_orders)} />
          <V1Metric size="sm" label="Used" value={fmtNum(t.portal_used_orders)} />
          <V1Metric size="sm" label="On Time" value={fmtNum(t.portal_on_time_orders)} />
        </V1MetricGrid>
      </div>
      {open && <PortalDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
