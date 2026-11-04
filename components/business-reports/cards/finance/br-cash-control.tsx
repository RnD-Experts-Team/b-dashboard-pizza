"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1DataRow, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmt$2, fmtNum, weekLabel } from "@/components/business-reports/report-format";
import type { SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";
import { useStoreFocus, useStoreRows, type StoreRow } from "@/components/business-reports/cards/operations/br-shared";

/** V1's Deposit − Cash colouring: green above +$0.50, red below −$0.50. */
const DIFF_TOLERANCE = 0.5;

function diffColor(n: number): string {
  if (n > DIFF_TOLERANCE) return "text-emerald-600 dark:text-emerald-400";
  if (n < -DIFF_TOLERANCE) return "text-red-600 dark:text-red-400";
  return "";
}

/** Cash and order-control columns, shared by the week and store tables. */
function cashColumns<T>(get: (row: T) => SalesMetrics): PagedColumn<T>[] {
  return [
    { key: "cash", header: "Cash Sales", numeric: true, sortValue: (r) => get(r).cash_sales, render: (r) => fmt$2(get(r).cash_sales) },
    { key: "deposit", header: "Deposit", numeric: true, sortValue: (r) => get(r).deposit, render: (r) => fmt$2(get(r).deposit) },
    {
      key: "diff",
      header: "Dep − Cash",
      numeric: true,
      sortValue: (r) => get(r).deposit_minus_cash_sales,
      render: (r) => <span className={diffColor(get(r).deposit_minus_cash_sales)}>{fmt$2(get(r).deposit_minus_cash_sales)}</span>,
    },
    {
      key: "over_short",
      header: "Over/Short",
      numeric: true,
      sortValue: (r) => get(r).over_short,
      render: (r) => <span className={diffColor(get(r).over_short)}>{fmt$2(get(r).over_short)}</span>,
    },
    { key: "modified", header: "Modified", numeric: true, sortValue: (r) => get(r).modified_orders, render: (r) => fmtNum(get(r).modified_orders) },
    { key: "refunded", header: "Refunded", numeric: true, sortValue: (r) => get(r).refunded_orders, render: (r) => fmtNum(get(r).refunded_orders) },
    { key: "refund_amt", header: "Refund $", numeric: true, sortValue: (r) => get(r).refund_amount, render: (r) => fmt$2(get(r).refund_amount) },
    { key: "voided", header: "Voided", numeric: true, sortValue: (r) => get(r).cancelled_orders, render: (r) => fmtNum(get(r).cancelled_orders) },
  ];
}

type StoreCashRow = StoreRow<SalesMetrics>;

const WEEK_COLUMNS: PagedColumn<SalesWeek>[] = [
  { key: "week", header: "Week", sortValue: (w) => w.week_start, render: (w) => weekLabel(w), className: "whitespace-nowrap" },
  ...cashColumns<SalesWeek>((w) => w),
];

const STORE_COLUMNS: PagedColumn<StoreCashRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...cashColumns<StoreCashRow>((r) => r.data),
];

function CashDialog({ data, onClose }: { data: SalesSection; onClose: () => void }) {
  const stores = useStoreRows(data.by_store);
  const focus = useStoreFocus<StoreCashRow>();
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Cash Control" badgeText="By week · By store">
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
            initialSort="diff"
            initialDir="asc"
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        </div>
      </div>
    </WbrDetailDialog>
  );
}

/** Cash vs deposit and the order controls (modified / refunded / voided) over the range. */
export function BrCashControlCard({ data }: { data: SalesSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  return (
    <V1Card reportId="br-cash-control" title="Cash Control" category="finance" period="R" span={1} onExpand={() => setOpen(true)}>
      <div className="space-y-2">
        <V1MetricGrid cols={2}>
          <V1Metric label="Cash Sales" value={fmt$2(t.cash_sales)} size="sm" />
          <V1Metric label="Deposit" value={fmt$2(t.deposit)} size="sm" />
        </V1MetricGrid>
        <div>
          <V1DataRow
            label="Deposit − Cash"
            value={<span className={cn(diffColor(t.deposit_minus_cash_sales))}>{fmt$2(t.deposit_minus_cash_sales)}</span>}
          />
          <V1DataRow label="Over / Short" value={<span className={cn(diffColor(t.over_short))}>{fmt$2(t.over_short)}</span>} />
          <V1DataRow label="Refunds" muted value={fmt$2(t.refund_amount)} />
        </div>
        <div>
          <V1SubLabel className="mb-1">Order Controls</V1SubLabel>
          <V1MetricGrid cols={3}>
            <V1Metric label="Modified" value={fmtNum(t.modified_orders)} size="sm" />
            <V1Metric label="Refunded" value={fmtNum(t.refunded_orders)} size="sm" />
            <V1Metric label="Voided" value={fmtNum(t.cancelled_orders)} size="sm" />
          </V1MetricGrid>
        </div>
      </div>
      {open && <CashDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
