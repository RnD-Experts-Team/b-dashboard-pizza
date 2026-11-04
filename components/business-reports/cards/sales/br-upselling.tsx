"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { fmtNum, fmtNumD, perStoreDay } from "@/components/business-reports/report-format";
import type { OrdersSection, UpsellingBlock } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrUpsellingCard — the Upselling tab of V1's Store Score card over the
 *  range: total weighted score, total units, items ranked by score. Expand:
 *  the full item table and every store ranked (score per store-day when the
 *  sales section has the store's store-days).
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_UPSELLING_SPAN: V1Span = 1;

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";
const PTS_DECIMALS = 2;

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

function formatUpsellKey(key: string): string {
  return key
    .split("_")
    .join(" ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const fmtPts = (n: number) => fmtNumD(n, PTS_DECIMALS);

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

function RankBadge({ idx }: { idx: number }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
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
            label="Total score"
            value={`${fmtPts(u.total_score)} pts`}
            accent="text-violet-600 dark:text-violet-400"
          />
          <V1Metric size="sm" label="Total units" value={fmtNum(u.total_units)} />
        </V1MetricGrid>
        {items.length === 0 ? <V1Empty icon={TrendingUp}>No upselling in this range</V1Empty> : <ItemTable items={items} />}
      </div>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Upselling Detail"
        badgeText={`${fmtPts(u.total_score)} pts · ${fmtNum(u.total_units)} units`}
      >
        {open && <UpsellingDetail data={data} items={items} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

function UpsellingDetail({ data, items }: { data: OrdersSection; items: ItemRow[] }) {
  const { storeName, focusStore } = useReport();
  const sales = useSection("sales").data;

  const rows = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.upselling.by_store).map(([store, b]) => {
        const storeDays = sales?.by_store[store]?.store_days ?? 0;
        return {
          store,
          units: b.total_units,
          score: b.total_score,
          perDay: storeDays > 0 ? perStoreDay(b.total_score, storeDays) : null,
        };
      }),
    [data.upselling.by_store, sales],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      { key: "units", header: "Units", numeric: true, sortValue: (r) => r.units, render: (r) => fmtNum(r.units) },
      {
        key: "score",
        header: "Score",
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

  return (
    <div className="space-y-5">
      <div>
        <V1SubLabel className="mb-2 px-1">Item breakdown · units × weight = points</V1SubLabel>
        <ItemTable items={items} />
      </div>
      <div>
        <V1SubLabel className="mb-2 px-1">Stores ranked by score</V1SubLabel>
        <PagedTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.store}
          initialSort="score"
          onRowClick={(r) => focusStore(r.store)}
          footerNote="click a row to focus the store"
        />
      </div>
    </div>
  );
}
