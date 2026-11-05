"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1DataRow, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { fmt$2, fmt$Compact, fmtNum } from "@/components/business-reports/report-format";
import type { SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";
import {
  Count,
  CountDelta,
  Money,
  TrendChart,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "@/components/business-reports/cards/operations/br-shared";

/** V1's Deposit − Cash colouring: green above +$0.50, red below −$0.50. */
const DIFF_TOLERANCE = 0.5;

const [DIFF_COLOR, OVER_SHORT_COLOR] = CATEGORIES.finance.chartColors;
const [MODIFIED_COLOR, REFUNDED_COLOR, VOIDED_COLOR] = CATEGORIES.finance.chartColors;
const fmtWhole = (v: number): string => v.toFixed(0);
const CENTS_DIGITS = 2;

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
interface WeekRow {
  week: SalesWeek;
  prev: SalesWeek | null;
}

const STORE_COLUMNS: PagedColumn<StoreCashRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...cashColumns<StoreCashRow>((r) => r.data),
];

function CashDialog({ data, onClose }: { data: SalesSection; onClose: () => void }) {
  const stores = useStoreRows(data.by_store);
  const focus = useStoreFocus<StoreCashRow>();
  const labelOf = useWeekLabel(data.by_week);
  const weeks = useMemo<WeekRow[]>(() => withPrev(data.by_week).map(({ row, prev }) => ({ week: row, prev })), [data.by_week]);
  const categories = useMemo(() => data.by_week.map((w) => labelOf(w.week_start)), [data.by_week, labelOf]);
  const cashSeries = useMemo(
    () => [
      { name: "Deposit − Cash", data: data.by_week.map((w) => Number(w.deposit_minus_cash_sales.toFixed(CENTS_DIGITS))), color: DIFF_COLOR },
      { name: "Over / Short", data: data.by_week.map((w) => Number(w.over_short.toFixed(CENTS_DIGITS))), color: OVER_SHORT_COLOR },
    ],
    [data.by_week],
  );
  const orderSeries = useMemo(
    () => [
      { name: "Modified", data: data.by_week.map((w) => w.modified_orders), color: MODIFIED_COLOR },
      { name: "Refunded", data: data.by_week.map((w) => w.refunded_orders), color: REFUNDED_COLOR },
      { name: "Voided", data: data.by_week.map((w) => w.cancelled_orders), color: VOIDED_COLOR },
    ],
    [data.by_week],
  );
  const weekColumns = useMemo<PagedColumn<WeekRow>[]>(() => {
    /** The Δ column that follows each of these columns. */
    const deltaAfter: Record<string, PagedColumn<WeekRow>> = {
      diff: {
        key: "diff_d",
        header: "Δ Dep − Cash",
        numeric: true,
        render: (r) => <CountDelta curr={r.week.deposit_minus_cash_sales} prev={r.prev?.deposit_minus_cash_sales} goodWhen="neutral" format={fmt$2} />,
      },
      voided: {
        key: "voided_d",
        header: "Δ Voided",
        numeric: true,
        render: (r) => <CountDelta curr={r.week.cancelled_orders} prev={r.prev?.cancelled_orders} goodWhen="down" />,
      },
    };
    return [
      { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) },
      ...cashColumns<WeekRow>((r) => r.week).flatMap((c) => (deltaAfter[c.key] ? [c, deltaAfter[c.key]] : [c])),
    ];
  }, [labelOf]);
  const t = data.totals;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Deposit − Cash and Over / Short by week" description="Close to $0 is best.">
            <TrendChart kind="bar" categories={categories} series={cashSeries} format={fmt$Compact} />
          </ReportBlock>
          <ReportBlock title="Order controls by week">
            <TrendChart categories={categories} series={orderSeries} format={fmtWhole} />
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
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="diff"
          initialDir="asc"
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
      title="Cash Control"
      category="finance"
      stats={[
        { label: "Cash sales", value: fmt$Compact(t.cash_sales), sub: fmt$2(t.cash_sales) },
        { label: "Deposit", value: fmt$Compact(t.deposit), sub: fmt$2(t.deposit) },
        { label: "Deposit − Cash", value: fmt$Compact(t.deposit_minus_cash_sales), sub: fmt$2(t.deposit_minus_cash_sales), tone: diffColor(t.deposit_minus_cash_sales) },
        { label: "Over / Short", value: fmt$Compact(t.over_short), sub: fmt$2(t.over_short), tone: diffColor(t.over_short) },
        { label: "Refunds", value: fmt$Compact(t.refund_amount), sub: `${fmtNum(t.refunded_orders)} orders` },
        { label: "Voided", value: fmtNum(t.cancelled_orders), sub: `${fmtNum(t.modified_orders)} modified` },
      ]}
      tabs={tabs}
    />
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
          <V1Metric label="Cash Sales" value={<Money value={t.cash_sales} />} size="sm" />
          <V1Metric label="Deposit" value={<Money value={t.deposit} />} size="sm" />
        </V1MetricGrid>
        <div>
          <V1DataRow
            label="Deposit − Cash"
            value={<span className={cn(diffColor(t.deposit_minus_cash_sales))}><Money value={t.deposit_minus_cash_sales} /></span>}
          />
          <V1DataRow label="Over / Short" value={<span className={cn(diffColor(t.over_short))}><Money value={t.over_short} /></span>} />
          <V1DataRow label="Refunds" muted value={<Money value={t.refund_amount} />} />
        </div>
        <div>
          <V1SubLabel className="mb-1">Order Controls</V1SubLabel>
          <V1MetricGrid cols={3}>
            <V1Metric label="Modified" value={<Count value={t.modified_orders} />} size="sm" />
            <V1Metric label="Refunded" value={<Count value={t.refunded_orders} />} size="sm" />
            <V1Metric label="Voided" value={<Count value={t.cancelled_orders} />} size="sm" />
          </V1MetricGrid>
        </div>
      </div>
      {open && <CashDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
