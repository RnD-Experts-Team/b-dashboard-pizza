"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport, useSection } from "@/components/business-reports/report-context";
import {
  RD_NUM,
  RD_TBL,
  RD_TD,
  RD_TH,
  ReportBlock,
  ReportDialog,
  type ReportStat,
} from "@/components/business-reports/report-dialog";
import { fmtNum, fmtNumD, perStoreDay, share, fmtPct } from "@/components/business-reports/report-format";
import { BarList, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { OrdersSection, UpsellingBlock } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrUpsellingCard — the Upselling tab of V1's Store Score card over the
 *  range: total weighted score, total units, items ranked by score. Expand:
 *  the item ranking, the full item table and every store ranked (score per
 *  store-day when the sales section has the store's store-days).
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_UPSELLING_SPAN: V1Span = 2;

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";
const PTS_DECIMALS = 2;
/** Points at or above this show compact in the narrow card tile ("12.3K"). */
const COMPACT_FROM = 10_000;

interface ItemRow {
  key: string;
  name: string;
  units: number;
  score: number;
}

interface StoreRow {
  store: string;
  units: number;
  score: number;
  perDay: number | null;
}

const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatUpsellKey(key: string): string {
  return key
    .split("_")
    .join(" ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const fmtPts = (n: number) => fmtNumD(n, PTS_DECIMALS);
const fmtPtsTile = (n: number) => (Math.abs(n) >= COMPACT_FROM ? compactNum.format(n) : fmtPts(n));

function itemRows(block: UpsellingBlock): ItemRow[] {
  const keys = Array.from(new Set([...Object.keys(block.units), ...Object.keys(block.score)]));
  return keys
    .map((key) => ({
      key,
      name: formatUpsellKey(key),
      units: block.units[key] ?? 0,
      score: block.score[key] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || b.units - a.units);
}

function RankBadge({ idx, size = "sm" }: { idx: number; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" ? "h-4 w-4 text-[8px]" : "h-6 w-6 text-xs",
        RANK_BADGE[idx] ?? RANK_REST,
      )}
    >
      {idx + 1}
    </span>
  );
}

function ItemTable({ items }: { items: ItemRow[] }) {
  return (
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={cn(V1_TH, "w-7")}>#</th>
          <th className={V1_TH}>Item</th>
          <th className={cn(V1_TH, V1_NUM)}>Units</th>
          <th className={cn(V1_TH, V1_NUM)}>Pts</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, idx) => (
          <tr key={it.key}>
            <td className={V1_TD}>
              <RankBadge idx={idx} />
            </td>
            <td className={cn(V1_TD, "font-semibold")}>{it.name}</td>
            <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtNum(it.units)}</td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>{fmtPts(it.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BrUpsellingCard({ data }: { data: OrdersSection }) {
  const [open, setOpen] = useState(false);
  const u = data.upselling;
  const items = useMemo(() => itemRows(u), [u]);

  return (
    <V1Card
      reportId="br-upselling"
      title="Upselling"
      category="sales"
      period="R"
      span={BR_UPSELLING_SPAN}
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid>
          <V1Metric
            size="sm"
            label="Total pts"
            value={<span title={fmtPts(u.total_score)}>{fmtPtsTile(u.total_score)}</span>}
            accent="text-violet-600 dark:text-violet-400"
          />
          <V1Metric size="sm" label="Total units" value={fmtNum(u.total_units)} />
        </V1MetricGrid>
        {items.length === 0 ? <V1Empty icon={TrendingUp}>No upselling in this range</V1Empty> : <ItemTable items={items} />}
      </div>

      {open && <UpsellingDialog data={data} items={items} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function UpsellingDialog({ data, items, onClose }: { data: OrdersSection; items: ItemRow[]; onClose: () => void }) {
  const { storeName, focusStore } = useReport();
  const sales = useSection("sales").data;
  const u = data.upselling;

  const rows = useMemo<StoreRow[]>(
    () =>
      Object.entries(u.by_store).map(([store, b]) => {
        const storeDays = sales?.by_store[store]?.store_days ?? 0;
        return {
          store,
          units: b.total_units,
          score: b.total_score,
          perDay: storeDays > 0 ? perStoreDay(b.total_score, storeDays) : null,
        };
      }),
    [u.by_store, sales],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "units", header: "Units", numeric: true, sortValue: (r) => r.units, render: (r) => fmtNum(r.units) },
      {
        key: "score",
        header: "Score (pts)",
        numeric: true,
        sortValue: (r) => r.score,
        render: (r) => <span className="font-bold">{fmtPts(r.score)}</span>,
      },
      {
        key: "per_day",
        header: "Pts / store-day",
        numeric: true,
        sortValue: (r) => r.perDay,
        render: (r) => (r.perDay === null ? <span className="text-muted-foreground">—</span> : fmtPts(r.perDay)),
      },
    ],
    [storeName],
  );

  const bars = useMemo<BarRow[]>(
    () =>
      items.map((it) => ({
        key: it.key,
        label: it.name,
        value: it.score,
        display: `${fmtPts(it.score)} pts`,
        sub: `${fmtNum(it.units)} units · ${fmtPct(share(it.score, u.total_score))}`,
      })),
    [items, u.total_score],
  );

  const topStore = rows.reduce<StoreRow | null>((a, r) => (a === null || r.score > a.score ? r : a), null);
  const storeDays = sales?.totals.store_days ?? 0;

  const stats: ReportStat[] = [
    { label: "Total score", value: `${fmtPts(u.total_score)} pts`, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Total units", value: fmtNum(u.total_units) },
    {
      label: "Pts / store-day",
      value: storeDays > 0 ? fmtPts(perStoreDay(u.total_score, storeDays)) : "—",
      sub: storeDays > 0 ? `${fmtNum(storeDays)} store-days` : "needs the sales data",
    },
    { label: "Top item", value: items[0]?.name ?? "—", sub: items[0] ? `${fmtPts(items[0].score)} pts` : undefined },
    { label: "Top store", value: topStore ? storeName(topStore.store) : "—", sub: topStore ? `${fmtPts(topStore.score)} pts` : undefined },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Items ranked by points" description="units × weight = points">
          <BarList rows={bars} color={CATEGORIES.sales.chartColors[0]} empty="No upselling in this range" />
        </ReportBlock>
      ),
    },
    {
      key: "items",
      label: "Items",
      content: (
        <ReportBlock title="Item breakdown">
          <table className={RD_TBL}>
            <thead>
              <tr>
                <th className={cn(RD_TH, "w-12")}>#</th>
                <th className={RD_TH}>Item</th>
                <th className={cn(RD_TH, RD_NUM)}>Units</th>
                <th className={cn(RD_TH, RD_NUM)}>Points</th>
                <th className={cn(RD_TH, RD_NUM)}>Share of points</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.key}>
                  <td className={RD_TD}>
                    <RankBadge idx={idx} size="lg" />
                  </td>
                  <td className={cn(RD_TD, "font-semibold")}>{it.name}</td>
                  <td className={cn(RD_TD, RD_NUM)}>{fmtNum(it.units)}</td>
                  <td className={cn(RD_TD, RD_NUM, "font-bold")}>{fmtPts(it.score)}</td>
                  <td className={cn(RD_TD, RD_NUM, "text-muted-foreground")}>{fmtPct(share(it.score, u.total_score))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Stores ranked by score" description={sales ? undefined : "Pts / store-day appears once the sales data has loaded"}>
          <PagedTable
            size="lg"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.store}
            initialSort="score"
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
      title="Upselling"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
