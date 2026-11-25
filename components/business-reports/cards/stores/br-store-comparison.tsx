"use client";

import { useMemo } from "react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { DASH } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { laborValue, useFinalLabor } from "@/components/business-reports/final-labor";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { LaborPctValue } from "@/components/business-reports/cards/people/br-people-kit";
import {
  fmt$,
  fmt$2,
  fmtNum,
  fmtNumD,
  fmtPct,
  perStoreDay,
} from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { OperationsMetrics, SalesMetrics, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  Store Comparison — one row per loaded store with the range's headline
 *  figures side by side. Sales drives it; operations (Blue Line / Pepsi %
 *  of sales, portal / HnR) and the
 *  store score and maintenance costs fill in when those sections land. Labor % is the final labor:
 *  payroll ÷ royalty obligation over the store's weeks with payroll. A row
 *  focuses that store.
 * ────────────────────────────────────────────────────────────────────────── */

const CARD_HEIGHT = 460;
const PENDING = "…";
const PERCENT = 100;
const DAYS_PER_WEEK = 7;

interface Row {
  store: string;
  rank: number | null;
  sales: SalesMetrics | null;
  ops: OperationsMetrics | null;
  score: number | null;
  scoreLabel: string | null;
  labor: { value: number | null; isFinal: boolean };
  /** Maintenance spent at the store over the range (payments, refunds netted). */
  maintenance: number | null;
}

/** A sales figure, or null when the store had no sales rows in the range. */
function salesValue(r: Row, pick: (m: SalesMetrics) => number): number | null {
  return r.sales && r.sales.store_days > 0 ? pick(r.sales) : null;
}

function opsValue(r: Row, pick: (m: OperationsMetrics) => number): number | null {
  return r.ops ? pick(r.ops) : null;
}

const ROSE = "text-rose-600 dark:text-rose-400";

export function BrStoreComparison({ data }: { data: SalesSection }) {
  const { params, storeName, focusStore } = useReport();
  const operations = useSection("operations");
  const storeScore = useSection("storeScore");
  const maintenanceCosts = useSection("maintenanceCosts");
  const final = useFinalLabor();
  const opsByStore = operations.data?.by_store;
  const scoreByStore = storeScore.data?.by_store;
  const maintenanceByStore = useMemo(() => {
    const byStore = maintenanceCosts.data?.byStore;
    if (!byStore) return null;
    return new Map(
      byStore.filter((s) => s.storeNumber).map((s) => [s.storeNumber as string, Number(s.amount) || 0]),
    );
  }, [maintenanceCosts.data]);
  const multiStore = params.stores.length > 1;

  const rows = useMemo<Row[]>(() => {
    const ranked = params.stores
      .filter((s) => (data.by_store[s]?.store_days ?? 0) > 0)
      .sort((a, b) => data.by_store[b].sales - data.by_store[a].sales);
    const rankOf = new Map(ranked.map((s, i) => [s, i + 1]));
    return params.stores.map((store) => {
      return {
      store,
      rank: rankOf.get(store) ?? null,
      sales: data.by_store[store] ?? null,
      ops: opsByStore?.[store] ?? null,
      score: scoreByStore?.[store]?.average_score ?? null,
      scoreLabel: scoreByStore?.[store]?.average_label ?? null,
      labor: laborValue(final?.byStore.get(store)),
      // A loaded store with no payments spent nothing.
      maintenance: maintenanceByStore ? (maintenanceByStore.get(store) ?? 0) : null,
      };
    });
  }, [params.stores, data.by_store, opsByStore, scoreByStore, final, maintenanceByStore]);

  const columns = useMemo<PagedColumn<Row>[]>(() => {
    const opsPending = (r: Row) => (operations.loading && !r.ops ? PENDING : DASH);
    const maintenancePending = maintenanceCosts.loading ? PENDING : DASH;
    const maintenanceShare = (r: Row) => {
      const sales = salesValue(r, (m) => m.sales);
      return r.maintenance === null || !sales ? null : (r.maintenance / sales) * PERCENT;
    };
    const show = (v: number | null, f: (n: number) => string, fallback: string = DASH) => (v === null ? fallback : f(v));
    const all: PagedColumn<Row>[] = [
      {
        key: "rank",
        header: "#",
        numeric: true,
        render: (r) => <span className="text-muted-foreground">{r.rank ?? DASH}</span>,
        sortValue: (r) => r.rank,
      },
      {
        key: "store",
        header: "Store",
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
        sortValue: (r) => storeName(r.store),
      },
      {
        key: "sales",
        header: "Sales",
        numeric: true,
        render: (r) => <span className="font-semibold">{show(salesValue(r, (m) => m.sales), fmt$)}</span>,
        sortValue: (r) => salesValue(r, (m) => m.sales),
      },
      {
        key: "guests",
        header: "Guests",
        numeric: true,
        render: (r) => show(salesValue(r, (m) => m.customer_count), fmtNum),
        sortValue: (r) => salesValue(r, (m) => m.customer_count),
      },
      {
        key: "ticket",
        header: "Avg Ticket",
        numeric: true,
        render: (r) => show(salesValue(r, (m) => m.avg_ticket), fmt$2),
        sortValue: (r) => salesValue(r, (m) => m.avg_ticket),
      },
      {
        key: "per_day",
        header: "Sales / Day",
        numeric: true,
        render: (r) => show(salesValue(r, (m) => perStoreDay(m.sales, m.store_days)), fmt$),
        sortValue: (r) => salesValue(r, (m) => perStoreDay(m.sales, m.store_days)),
      },
      {
        // A full week at the store's daily average, so stores open part of the range compare fairly.
        key: "per_week",
        header: "Sales / Week",
        numeric: true,
        render: (r) => show(salesValue(r, (m) => perStoreDay(m.sales, m.store_days) * DAYS_PER_WEEK), fmt$),
        sortValue: (r) => salesValue(r, (m) => perStoreDay(m.sales, m.store_days) * DAYS_PER_WEEK),
      },
      {
        key: "labor",
        header: "Labor %",
        numeric: true,
        render: (r) => <LaborPctValue value={r.labor.value} isFinal={r.labor.isFinal} />,
        sortValue: (r) => r.labor.value,
      },
      {
        key: "blue_line",
        header: "Blue Line %",
        numeric: true,
        render: (r) => show(opsValue(r, (m) => m.blue_line_pct), fmtPct, opsPending(r)),
        sortValue: (r) => opsValue(r, (m) => m.blue_line_pct),
      },
      {
        key: "pepsi",
        header: "Pepsi %",
        numeric: true,
        render: (r) => show(opsValue(r, (m) => m.pepsi_pct), fmtPct, opsPending(r)),
        sortValue: (r) => opsValue(r, (m) => m.pepsi_pct),
      },
      {
        key: "portal",
        header: "Portal %",
        numeric: true,
        render: (r) => show(opsValue(r, (m) => m.put_into_portal_percent), fmtPct, opsPending(r)),
        sortValue: (r) => opsValue(r, (m) => m.put_into_portal_percent),
      },
      {
        key: "hnr",
        header: "HnR %",
        numeric: true,
        render: (r) => show(opsValue(r, (m) => m.hnr_promise_met_percent), fmtPct, opsPending(r)),
        sortValue: (r) => opsValue(r, (m) => m.hnr_promise_met_percent),
      },
      {
        key: "deposit",
        header: "Deposit − Cash",
        numeric: true,
        render: (r) => {
          const v = salesValue(r, (m) => m.deposit_minus_cash_sales);
          return v === null ? DASH : <span className={cn(v < 0 && ROSE)}>{fmt$2(v)}</span>;
        },
        sortValue: (r) => salesValue(r, (m) => m.deposit_minus_cash_sales),
      },
      {
        key: "waste",
        header: "Waste",
        numeric: true,
        render: (r) => show(salesValue(r, (m) => m.waste_normal + m.waste_alta), fmt$2),
        sortValue: (r) => salesValue(r, (m) => m.waste_normal + m.waste_alta),
      },
      {
        key: "maintenance",
        header: "Maintenance",
        numeric: true,
        render: (r) => show(r.maintenance, fmt$2, maintenancePending),
        sortValue: (r) => r.maintenance,
      },
      {
        key: "maintenance_pct",
        header: "Maint. % Sales",
        numeric: true,
        render: (r) => show(maintenanceShare(r), fmtPct, maintenancePending),
        sortValue: (r) => maintenanceShare(r),
      },
      {
        key: "score",
        header: "Score",
        numeric: true,
        render: (r) =>
          r.score === null ? (
            <span className="text-muted-foreground">{storeScore.loading ? PENDING : DASH}</span>
          ) : (
            <span title={r.scoreLabel ?? undefined}>{fmtNumD(r.score)}</span>
          ),
        sortValue: (r) => r.score,
      },
    ];
    // The Score column only when store scores were loaded.
    return params.withStoreScore ? all : all.filter((c) => c.key !== "score");
  }, [storeName, operations.loading, storeScore.loading, maintenanceCosts.loading, params.withStoreScore]);

  return (
    <V1Card
      reportId="br-store-comparison"
      title="Store Comparison"
      category="sales"
      period="R"
      span={4}
      height={CARD_HEIGHT}
      headerNote={`${params.stores.length} store${multiStore ? "s" : ""}`}
    >
      <PagedTable
        className="h-full"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.store}
        initialSort="sales"
        onRowClick={multiStore ? (r) => focusStore(r.store) : undefined}
        footerNote={multiStore ? "click a store to focus it" : undefined}
      />
    </V1Card>
  );
}
