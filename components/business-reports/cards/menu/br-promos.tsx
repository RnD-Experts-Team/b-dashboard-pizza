"use client";

import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1DataRow, V1SubLabel, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { stripPunchh } from "@/components/dspr/wbr-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$, fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import type { OrdersSection, PromoRow, PromoTotals } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPromosCard — V1 "Weekly Promos" over the range: store sales, promo
 *  sales and their share, delivery-partner / LC split, and the named promo
 *  groups (everything else rolls into "Others"). Expand: every promo code
 *  and every store's promo totals.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PROMOS_SPAN: V1Span = 1;

/** Promo buckets surfaced by name, as in V1; everything else is "Others". */
const NAMED_PROMOS = ["MIXNMATCH", "5OFF30", "Spend $35, save $5", "WEDELIVER", "Gasta $35, ahorra $5"];
const OTHERS = "Others";

type StoreRow = { store: string } & PromoTotals;

interface BreakdownRow extends PromoRow {
  name: string;
}

function groupOf(reason: string): string {
  const name = stripPunchh(reason).toLowerCase();
  return NAMED_PROMOS.find((n) => n.toLowerCase() === name) ?? OTHERS;
}

export function BrPromosCard({ data }: { data: OrdersSection }) {
  const [open, setOpen] = useState(false);
  const promo = data.promo;
  const totals = promo.promo_totals;

  const groups = useMemo(() => {
    const sums = promo.promo_breakdown.reduce<Record<string, number>>((acc, p) => {
      const g = groupOf(p.modification_reason);
      return { ...acc, [g]: (acc[g] ?? 0) + p.promo_sales };
    }, {});
    return [...NAMED_PROMOS, OTHERS]
      .map((label) => ({ label, value: sums[label] ?? 0 }))
      .filter((g) => g.value > 0);
  }, [promo.promo_breakdown]);

  return (
    <V1Card
      title="Promos"
      category="menu"
      period="R"
      span={BR_PROMOS_SPAN}
      headerNote={`${fmtPct(totals.pct_of_store_sales)} of sales`}
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid>
          <V1Metric label="Store Sales" value={fmt$(promo.total_store_sales)} />
          <V1Metric label="Promo Sales" value={fmt$(totals.total_promo_sales)} />
        </V1MetricGrid>

        <V1DataRow label="Promo % of sales" value={fmtPct(totals.pct_of_store_sales)} />

        <V1MetricGrid cols={4}>
          <V1Metric size="sm" label="DoorDash" value={fmt$(totals.total_doordash)} />
          <V1Metric size="sm" label="UberEats" value={fmt$(totals.total_ubereats)} />
          <V1Metric size="sm" label="GrubHub" value={fmt$(totals.total_grubhub)} />
          <V1Metric size="sm" label="LC" value={fmt$(totals.total_lc)} />
        </V1MetricGrid>

        <div>
          <V1SubLabel className="mb-1">Top Promo Groups</V1SubLabel>
          {groups.length === 0 ? (
            <V1Empty icon={Tag}>No promo sales in this range</V1Empty>
          ) : (
            <div className="space-y-1.5">
              {groups.map((g) => (
                <V1DataRow
                  key={g.label}
                  label={g.label}
                  value={fmt$(g.value)}
                  trailing={
                    <span className="text-[10px] text-muted-foreground">
                      {fmtPct(share(g.value, promo.total_store_sales))}
                    </span>
                  }
                  className="border-0 py-0"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Promo Breakdown"
        badgeText={`${fmtNum(promo.promo_breakdown.length)} promo codes`}
      >
        {open && <PromoDetail data={data} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

const BREAKDOWN_COLUMNS: PagedColumn<BreakdownRow>[] = [
  {
    key: "name",
    header: "Promo Code",
    sortValue: (r) => r.name,
    className: "whitespace-normal break-words",
    render: (r) => r.name,
  },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.promo_sales, render: (r) => fmt$(r.promo_sales) },
  {
    key: "doordash",
    header: "DoorDash",
    numeric: true,
    sortValue: (r) => r.doordash_sales,
    render: (r) => fmt$(r.doordash_sales),
  },
  {
    key: "ubereats",
    header: "UberEats",
    numeric: true,
    sortValue: (r) => r.ubereats_sales,
    render: (r) => fmt$(r.ubereats_sales),
  },
  {
    key: "grubhub",
    header: "GrubHub",
    numeric: true,
    sortValue: (r) => r.grubhub_sales,
    render: (r) => fmt$(r.grubhub_sales),
  },
  { key: "lc", header: "LC", numeric: true, sortValue: (r) => r.lc_sales, render: (r) => fmt$(r.lc_sales) },
  {
    key: "pct",
    header: "% of Store",
    numeric: true,
    sortValue: (r) => r.pct_of_store_sales,
    render: (r) => <span className="text-muted-foreground">{fmtPct(r.pct_of_store_sales)}</span>,
  },
];

function PromoDetail({ data }: { data: OrdersSection }) {
  const { storeName, focusStore } = useReport();
  const totals = data.promo.promo_totals;

  const breakdown = useMemo<BreakdownRow[]>(
    () => data.promo.promo_breakdown.map((p) => ({ ...p, name: stripPunchh(p.modification_reason) })),
    [data.promo.promo_breakdown],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      {
        key: "promo",
        header: "Promo Sales",
        numeric: true,
        sortValue: (r) => r.total_promo_sales,
        render: (r) => fmt$(r.total_promo_sales),
      },
      {
        key: "pct",
        header: "% of Sales",
        numeric: true,
        sortValue: (r) => r.pct_of_store_sales,
        render: (r) => fmtPct(r.pct_of_store_sales),
      },
      {
        key: "doordash",
        header: "DoorDash",
        numeric: true,
        sortValue: (r) => r.total_doordash,
        render: (r) => fmt$(r.total_doordash),
      },
      {
        key: "ubereats",
        header: "UberEats",
        numeric: true,
        sortValue: (r) => r.total_ubereats,
        render: (r) => fmt$(r.total_ubereats),
      },
      {
        key: "grubhub",
        header: "GrubHub",
        numeric: true,
        sortValue: (r) => r.total_grubhub,
        render: (r) => fmt$(r.total_grubhub),
      },
      { key: "lc", header: "LC", numeric: true, sortValue: (r) => r.total_lc, render: (r) => fmt$(r.total_lc) },
    ],
    [storeName],
  );

  return (
    <div className="space-y-6">
      <div>
        <V1SubLabel className="mb-2 px-1">
          All promo codes · total {fmt$(totals.total_promo_sales)} ({fmtPct(totals.pct_of_store_sales)} of store sales)
        </V1SubLabel>
        <PagedTable rows={breakdown} columns={BREAKDOWN_COLUMNS} rowKey={(r) => r.modification_reason} initialSort="sales" />
      </div>
      <div>
        <V1SubLabel className="mb-2 px-1">By store</V1SubLabel>
        <PagedTable
          rows={data.promo.by_store}
          columns={storeColumns}
          rowKey={(r) => r.store}
          initialSort="promo"
          onRowClick={(r) => focusStore(r.store)}
          footerNote="click a row to focus the store"
        />
      </div>
    </div>
  );
}
