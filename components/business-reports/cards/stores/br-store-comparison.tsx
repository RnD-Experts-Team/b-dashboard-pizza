"use client";

import { useMemo } from "react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { DASH } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { preferFinal, useFinalLabor } from "@/components/business-reports/final-labor";
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
 *  figures side by side. Sales drives it; operations (portal / HnR) and the
 *  store score fill in when those sections land. Labor % is Hiring's FINAL
 *  labor (mean of the store's weeks) where it exists, else the derived
 *  labor cost ÷ sales ("Est."). A row focuses that store.
 * ────────────────────────────────────────────────────────────────────────── */

const CARD_HEIGHT = 460;
const PENDING = "…";

interface Row {
  store: string;
  rank: number | null;
  sales: SalesMetrics | null;
  ops: OperationsMetrics | null;
  score: number | null;
  scoreLabel: string | null;
  labor: { value: number | null; isFinal: boolean };
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
  const final = useFinalLabor();
  const opsByStore = operations.data?.by_store;
  const scoreByStore = storeScore.data?.by_store;
  const multiStore = params.stores.length > 1;

  const rows = useMemo<Row[]>(() => {
    const ranked = params.stores
      .filter((s) => (data.by_store[s]?.store_days ?? 0) > 0)
      .sort((a, b) => data.by_store[b].sales - data.by_store[a].sales);
    const rankOf = new Map(ranked.map((s, i) => [s, i + 1]));
    return params.stores.map((store) => {
      const m = data.by_store[store];
      const fin = final?.byStore.get(store);
      const derived = m && m.store_days > 0 && m.sales > 0 ? m.labor_percent : null;
      return {
      store,
      rank: rankOf.get(store) ?? null,
      sales: data.by_store[store] ?? null,
      ops: opsByStore?.[store] ?? null,
      score: scoreByStore?.[store]?.average_score ?? null,
      scoreLabel: scoreByStore?.[store]?.average_label ?? null,
      labor: derived === null ? { value: fin ?? null, isFinal: fin !== undefined } : preferFinal(fin, derived),
      };
    });
  }, [params.stores, data.by_store, opsByStore, scoreByStore, final]);

  const columns = useMemo<PagedColumn<Row>[]>(() => {
    const opsPending = (r: Row) => (operations.loading && !r.ops ? PENDING : DASH);
    const show = (v: number | null, f: (n: number) => string, fallback: string = DASH) => (v === null ? fallback : f(v));
    return [
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
        key: "labor",
        header: "Labor %",
        numeric: true,
        render: (r) => <LaborPctValue value={r.labor.value} isFinal={r.labor.isFinal} />,
        sortValue: (r) => r.labor.value,
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
  }, [storeName, operations.loading, storeScore.loading]);

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
