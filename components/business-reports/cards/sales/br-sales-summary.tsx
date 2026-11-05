"use client";

import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import {
  Delta,
  compareText,
  fmt$,
  fmt$2,
  fmtDate,
  fmtNum,
  fmtNumD,
  pctChangeOrNull,
  perStoreDay,
} from "@/components/business-reports/report-format";
import { BarList, Money, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { SalesDay, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrSalesSummaryCard — the range's headline sales figures (V1 "Customer &
 *  Sales" for many stores): totals, per-store-day averages, best/worst day.
 *  Expand: the weekday pattern, every day, and every store's averages.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_SALES_SUMMARY_SPAN: V1Span = 1;

/** Business-week order (Tue → Mon). */
const WEEKDAYS = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"];
const POSITIVE = "text-emerald-600 dark:text-emerald-400";
const NEGATIVE = "text-red-600 dark:text-red-400";

interface DayRow extends SalesDay {
  weekday: string;
  perStoreDay: number;
  delta: number | null;
}

interface StoreRow {
  store: string;
  sales: number;
  storeDays: number;
  perStoreDay: number;
  guestsPerDay: number;
  ordersPerDay: number;
  avgTicket: number;
}

function pickDay(days: SalesDay[], better: (a: SalesDay, b: SalesDay) => boolean): SalesDay | null {
  return days.reduce<SalesDay | null>((acc, d) => (acc === null || better(d, acc) ? d : acc), null);
}

function weekdayOf(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "EEEE") : "—";
}

export function BrSalesSummaryCard({ data }: { data: SalesSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  const { best, worst } = useMemo(() => {
    const reported = data.by_date.filter((d) => d.store_days > 0);
    return {
      best: pickDay(reported, (a, b) => a.sales > b.sales),
      worst: pickDay(reported, (a, b) => a.sales < b.sales),
    };
  }, [data.by_date]);

  return (
    <V1Card
      title="Sales Summary"
      category="sales"
      period="R"
      span={BR_SALES_SUMMARY_SPAN}
      headerNote={`${fmtNum(t.store_days)} store-days`}
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-1.5">
        <V1MetricGrid>
          <V1Metric size="sm" label="Sales" value={<Money value={t.sales} />} accent={POSITIVE} />
          <V1Metric size="sm" label="Guests" value={fmtNum(t.customer_count)} />
          <V1Metric size="sm" label="Orders" value={fmtNum(t.total_orders)} />
          <V1Metric size="sm" label="Avg ticket" value={fmt$2(t.avg_ticket)} />
        </V1MetricGrid>
        <V1SubLabel>Per store-day</V1SubLabel>
        <V1MetricGrid>
          <V1Metric size="sm" label="Sales" value={<Money value={perStoreDay(t.sales, t.store_days)} />} />
          <V1Metric size="sm" label="Guests" value={fmtNumD(perStoreDay(t.customer_count, t.store_days))} />
        </V1MetricGrid>
        <V1MetricGrid>
          <V1Metric
            size="sm"
            label="Best day"
            value={best ? <Money value={best.sales} /> : "—"}
            sub={best ? fmtDate(best.date) : undefined}
            accent={POSITIVE}
          />
          <V1Metric
            size="sm"
            label="Worst day"
            value={worst ? <Money value={worst.sales} /> : "—"}
            sub={worst ? fmtDate(worst.date) : undefined}
            accent={NEGATIVE}
          />
        </V1MetricGrid>
      </div>

      {open && <SummaryDialog data={data} best={best} worst={worst} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

const DAY_COLUMNS: PagedColumn<DayRow>[] = [
  {
    key: "date",
    header: "Day",
    sortValue: (r) => r.date,
    render: (r) => (
      <div className="leading-tight">
        <div className="font-semibold">{fmtDate(r.date)}</div>
        <div className="text-xs text-muted-foreground">{r.weekday}</div>
      </div>
    ),
  },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
  { key: "delta", header: "Δ vs prev day", numeric: true, sortValue: (r) => r.delta, render: (r) => <Delta value={r.delta} /> },
  { key: "psd", header: "Per store-day", numeric: true, sortValue: (r) => r.perStoreDay, render: (r) => fmt$(r.perStoreDay) },
  { key: "stores", header: "Stores", numeric: true, sortValue: (r) => r.store_days, render: (r) => fmtNum(r.store_days) },
  { key: "guests", header: "Guests", numeric: true, sortValue: (r) => r.customer_count, render: (r) => fmtNum(r.customer_count) },
  { key: "orders", header: "Orders", numeric: true, sortValue: (r) => r.total_orders, render: (r) => fmtNum(r.total_orders) },
  { key: "ticket", header: "Avg ticket", numeric: true, sortValue: (r) => r.avg_ticket, render: (r) => fmt$2(r.avg_ticket) },
];

function SummaryDialog({
  data,
  best,
  worst,
  onClose,
}: {
  data: SalesSection;
  best: SalesDay | null;
  worst: SalesDay | null;
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const t = data.totals;

  const days = useMemo<DayRow[]>(() => {
    const asc = [...data.by_date].sort((a, b) => compareText(a.date, b.date));
    return asc.map((d, i) => ({
      ...d,
      weekday: weekdayOf(d.date),
      perStoreDay: perStoreDay(d.sales, d.store_days),
      delta: i > 0 ? pctChangeOrNull(d.sales, asc[i - 1].sales) : null,
    }));
  }, [data.by_date]);

  // Average sales per store-day for each weekday (Tue → Mon).
  const weekdayBars = useMemo<BarRow[]>(() => {
    const sums = days.reduce<Record<string, { sales: number; storeDays: number }>>((acc, d) => {
      const prev = acc[d.weekday] ?? { sales: 0, storeDays: 0 };
      return { ...acc, [d.weekday]: { sales: prev.sales + d.sales, storeDays: prev.storeDays + d.store_days } };
    }, {});
    return WEEKDAYS.filter((w) => sums[w]).map((w) => {
      const avg = perStoreDay(sums[w].sales, sums[w].storeDays);
      return { key: w, label: w, value: avg, display: fmt$(avg), sub: `${fmtNum(sums[w].storeDays)} store-days` };
    });
  }, [days]);

  const stores = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.by_store).map(([store, m]) => ({
        store,
        sales: m.sales,
        storeDays: m.store_days,
        perStoreDay: perStoreDay(m.sales, m.store_days),
        guestsPerDay: perStoreDay(m.customer_count, m.store_days),
        ordersPerDay: perStoreDay(m.total_orders, m.store_days),
        avgTicket: m.avg_ticket,
      })),
    [data.by_store],
  );

  const storeCols = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
      { key: "days", header: "Days", numeric: true, sortValue: (r) => r.storeDays, render: (r) => fmtNum(r.storeDays) },
      { key: "psd", header: "Sales / day", numeric: true, sortValue: (r) => r.perStoreDay, render: (r) => fmt$(r.perStoreDay) },
      { key: "gpd", header: "Guests / day", numeric: true, sortValue: (r) => r.guestsPerDay, render: (r) => fmtNumD(r.guestsPerDay) },
      { key: "opd", header: "Orders / day", numeric: true, sortValue: (r) => r.ordersPerDay, render: (r) => fmtNumD(r.ordersPerDay) },
      { key: "ticket", header: "Avg ticket", numeric: true, sortValue: (r) => r.avgTicket, render: (r) => fmt$2(r.avgTicket) },
    ],
    [storeName],
  );

  const stats: ReportStat[] = [
    { label: "Sales", value: fmt$(t.sales), sub: `${fmtNum(t.store_days)} store-days`, tone: POSITIVE },
    { label: "Sales / store-day", value: fmt$(perStoreDay(t.sales, t.store_days)) },
    { label: "Guests", value: fmtNum(t.customer_count), sub: `${fmtNumD(perStoreDay(t.customer_count, t.store_days))} / store-day` },
    { label: "Orders", value: fmtNum(t.total_orders), sub: `${fmt$2(t.avg_order_value)} avg order` },
    { label: "Best day", value: best ? fmt$(best.sales) : "—", sub: best ? fmtDate(best.date) : undefined, tone: POSITIVE },
    { label: "Worst day", value: worst ? fmt$(worst.sales) : "—", sub: worst ? fmtDate(worst.date) : undefined, tone: NEGATIVE },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Sales per store-day by weekday" description="Tuesday → Monday, averaged over every store-day in the range">
          <BarList rows={weekdayBars} color={CATEGORIES.sales.chartColors[0]} empty="No sales in this range" />
        </ReportBlock>
      ),
    },
    {
      key: "days",
      label: "By day",
      content: (
        <ReportBlock title="Every day" description="All stores combined">
          <PagedTable size="lg" rows={days} columns={DAY_COLUMNS} rowKey={(r) => r.date} initialSort="date" initialDir="desc" />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store" description="Per-store-day averages, so stores with fewer reporting days compare fairly">
          <PagedTable
            size="lg"
            rows={stores}
            columns={storeCols}
            rowKey={(r) => r.store}
            initialSort="psd"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
          />
        </ReportBlock>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Sales Summary"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
