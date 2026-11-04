"use client";

import { useState } from "react";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1DataRow, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import type { OperationsMetrics, OperationsSection } from "@/types/business-reports.types";
import { useStoreFocus, useStoreRows, type StoreRow } from "./br-shared";

type Row = StoreRow<OperationsMetrics>;

const answeredOf = (m: OperationsMetrics) => Math.max(0, m.calls_total - m.calls_missed);

const STORE_COLUMNS: PagedColumn<Row>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "total", header: "Total", numeric: true, sortValue: (r) => r.data.calls_total, render: (r) => fmtNum(r.data.calls_total) },
  { key: "answered", header: "Answered", numeric: true, sortValue: (r) => answeredOf(r.data), render: (r) => fmtNum(answeredOf(r.data)) },
  {
    key: "missed",
    header: "Missed",
    numeric: true,
    sortValue: (r) => r.data.calls_missed,
    render: (r) => (
      <span className={r.data.calls_missed > 0 ? "text-red-600 dark:text-red-400" : undefined}>{fmtNum(r.data.calls_missed)}</span>
    ),
  },
  { key: "missed_pct", header: "Missed %", numeric: true, sortValue: (r) => share(r.data.calls_missed, r.data.calls_total), render: (r) => fmtPct(share(r.data.calls_missed, r.data.calls_total)) },
  { key: "store_src", header: "Store", numeric: true, sortValue: (r) => r.data.calls_store, render: (r) => fmtNum(r.data.calls_store) },
  { key: "mgr", header: "Store Mgr", numeric: true, sortValue: (r) => r.data.calls_store_manager, render: (r) => fmtNum(r.data.calls_store_manager) },
  { key: "cc", header: "Call Center", numeric: true, sortValue: (r) => r.data.calls_call_center, render: (r) => fmtNum(r.data.calls_call_center) },
];

function GoToDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const rows = useStoreRows(data.by_store);
  const focus = useStoreFocus<Row>();
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Go-To Calls" badgeText="By store">
      <V1SubLabel className="mb-1">By store</V1SubLabel>
      <PagedTable
        rows={rows}
        columns={STORE_COLUMNS}
        rowKey={(r) => r.store}
        initialSort="total"
        onRowClick={focus.onRowClick}
        footerNote={focus.footerNote}
      />
    </WbrDetailDialog>
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
          <V1Metric label="Total Calls" value={fmtNum(t.calls_total)} />
          <V1Metric label="Answered" value={fmtNum(answered)} accent="text-emerald-600 dark:text-emerald-400" />
          <V1Metric
            label="Missed"
            value={fmtNum(t.calls_missed)}
            sub={t.calls_total > 0 ? fmtPct(share(t.calls_missed, t.calls_total)) : undefined}
            accent={t.calls_missed > 0 ? "text-red-600 dark:text-red-400" : undefined}
          />
        </V1MetricGrid>
        <div>
          <V1SubLabel className="mb-0.5">Source Breakdown</V1SubLabel>
          <V1DataRow label="Store" value={fmtNum(t.calls_store)} />
          <V1DataRow label="Store Manager" value={fmtNum(t.calls_store_manager)} />
          <V1DataRow label="Call Center" value={fmtNum(t.calls_call_center)} />
        </div>
      </div>
      {open && <GoToDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
