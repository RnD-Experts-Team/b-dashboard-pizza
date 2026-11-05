"use client";

import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1DataRow, V1SubLabel, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { stripPunchh } from "@/components/dspr/wbr-format";
import { CHANNEL_COLORS } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { fmt$, fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import { BarList, Money, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { OrdersSection, PromoRow, PromoTotals } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPromosCard — V1 "Weekly Promos" over the range: store sales, promo
 *  sales and their share, delivery-partner / LC split, and the named promo
 *  groups (everything else rolls into "Others"). Expand: the split and the
 *  groups as bars, every promo code, every store's promo totals.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PROMOS_SPAN: V1Span = 1;

/** Promo buckets surfaced by name, as in V1; everything else is "Others". */
const NAMED_PROMOS = ["MIXNMATCH", "5OFF30", "Spend $35, save $5", "WEDELIVER", "Gasta $35, ahorra $5"];
const OTHERS = "Others";
const MENU_COLOR = CATEGORIES.menu.chartColors[0];

/** Where promo sales came from (the four partner/LC totals). */
const SOURCES: { key: keyof PromoTotals; label: string; color: string }[] = [
  { key: "total_doordash", label: "DoorDash", color: CHANNEL_COLORS.doordash },
  { key: "total_ubereats", label: "UberEats", color: CHANNEL_COLORS.ubereats },
  { key: "total_grubhub", label: "GrubHub", color: CHANNEL_COLORS.grubhub },
  { key: "total_lc", label: "LC", color: MENU_COLOR },
];

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
          <V1Metric label="Store Sales" value={<Money value={promo.total_store_sales} />} />
          <V1Metric
            label="Promo Sales"
            value={<Money value={totals.total_promo_sales} />}
            sub={`${fmtPct(totals.pct_of_store_sales)} of sales`}
          />
        </V1MetricGrid>

        {/* Two across: four $ tiles side by side do not fit a span-1 card. */}
        <V1MetricGrid>
          {SOURCES.map((s) => (
            <V1Metric key={s.key} size="sm" label={s.label} value={<Money value={totals[s.key]} />} />
          ))}
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
                  value={<Money value={g.value} />}
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

      {open && <PromoDialog data={data} groups={groups} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

const BREAKDOWN_COLUMNS: PagedColumn<BreakdownRow>[] = [
  {
    key: "name",
    header: "Promo Code",
    sortValue: (r) => r.name,
    className: "whitespace-normal break-words",
    render: (r) => <span className="font-medium">{r.name}</span>,
  },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.promo_sales, render: (r) => <span className="font-semibold">{fmt$(r.promo_sales)}</span> },
  { key: "pct", header: "% of store", numeric: true, sortValue: (r) => r.pct_of_store_sales, render: (r) => fmtPct(r.pct_of_store_sales) },
  { key: "doordash", header: "DoorDash", numeric: true, sortValue: (r) => r.doordash_sales, render: (r) => fmt$(r.doordash_sales) },
  { key: "ubereats", header: "UberEats", numeric: true, sortValue: (r) => r.ubereats_sales, render: (r) => fmt$(r.ubereats_sales) },
  { key: "grubhub", header: "GrubHub", numeric: true, sortValue: (r) => r.grubhub_sales, render: (r) => fmt$(r.grubhub_sales) },
  { key: "lc", header: "LC", numeric: true, sortValue: (r) => r.lc_sales, render: (r) => fmt$(r.lc_sales) },
];

function PromoDialog({
  data,
  groups,
  onClose,
}: {
  data: OrdersSection;
  groups: { label: string; value: number }[];
  onClose: () => void;
}) {
  const { storeName, focusStore } = useReport();
  const promo = data.promo;
  const totals = promo.promo_totals;

  const breakdown = useMemo<BreakdownRow[]>(
    () => promo.promo_breakdown.map((p) => ({ ...p, name: stripPunchh(p.modification_reason) })),
    [promo.promo_breakdown],
  );

  const sourceBars = useMemo<BarRow[]>(
    () =>
      SOURCES.map((s) => ({
        key: s.key,
        label: s.label,
        value: totals[s.key],
        display: fmt$(totals[s.key]),
        sub: `${fmtPct(share(totals[s.key], totals.total_promo_sales))} of promo`,
        color: s.color,
      })),
    [totals],
  );
  const groupBars = useMemo<BarRow[]>(
    () =>
      [...groups]
        .sort((a, b) => b.value - a.value)
        .map((g) => ({
          key: g.label,
          label: g.label,
          value: g.value,
          display: fmt$(g.value),
          sub: `${fmtPct(share(g.value, promo.total_store_sales))} of sales`,
        })),
    [groups, promo.total_store_sales],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      {
        key: "promo",
        header: "Promo Sales",
        numeric: true,
        sortValue: (r) => r.total_promo_sales,
        render: (r) => <span className="font-semibold">{fmt$(r.total_promo_sales)}</span>,
      },
      { key: "pct", header: "% of Sales", numeric: true, sortValue: (r) => r.pct_of_store_sales, render: (r) => fmtPct(r.pct_of_store_sales) },
      ...SOURCES.map<PagedColumn<StoreRow>>((s) => ({
        key: s.key,
        header: s.label,
        numeric: true,
        sortValue: (r) => r[s.key],
        render: (r) => fmt$(r[s.key]),
      })),
    ],
    [storeName],
  );

  const partners = totals.total_doordash + totals.total_ubereats + totals.total_grubhub;
  const stats: ReportStat[] = [
    { label: "Store sales", value: fmt$(promo.total_store_sales) },
    { label: "Promo sales", value: fmt$(totals.total_promo_sales), sub: `${fmtPct(totals.pct_of_store_sales)} of store sales` },
    { label: "Delivery partners", value: fmt$(partners), sub: `${fmtPct(share(partners, totals.total_promo_sales))} of promo` },
    { label: "LC", value: fmt$(totals.total_lc), sub: `${fmtPct(share(totals.total_lc, totals.total_promo_sales))} of promo` },
    { label: "Promo codes", value: fmtNum(breakdown.length) },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Where promo sales came from">
            <BarList rows={sourceBars} color={MENU_COLOR} empty="No promo sales in this range" />
          </ReportBlock>
          <ReportBlock title="Promo groups" description="Named promos; every other code rolls into Others">
            <BarList rows={groupBars} color={MENU_COLOR} empty="No promo sales in this range" />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "codes",
      label: "Promo codes",
      content: (
        <ReportBlock title="Every promo code">
          <PagedTable
            size="lg"
            rows={breakdown}
            columns={BREAKDOWN_COLUMNS}
            rowKey={(r) => r.modification_reason}
            initialSort="sales"
            searchText={(r) => r.name}
            searchPlaceholder="Search promo codes…"
          />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store">
          <PagedTable
            size="lg"
            rows={promo.by_store}
            columns={storeColumns}
            rowKey={(r) => r.store}
            initialSort="promo"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
            onRowClick={(r) => focusStore(r.store)}
            footerNote="click a row to focus the store"
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
      title="Promos"
      category="menu"
      stats={stats}
      tabs={tabs}
    />
  );
}
