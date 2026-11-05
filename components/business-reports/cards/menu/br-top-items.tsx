"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import { fmt$2, fmtNum } from "@/components/business-reports/report-format";
import { BarList, Money, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { MenuSection, TopItem } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrTopItemsCard — V1 "Top Menu Items" over the range: the combined top 10
 *  by sales or by count. Expand: both combined rankings, and the per-store
 *  top 5s for any set of stores (checklist), merged and listed per store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_TOP_ITEMS_SPAN: V1Span = 1;

type Metric = "sales" | "count";

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";
const [SALES_COLOR, COUNT_COLOR] = CATEGORIES.menu.chartColors;

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "count", label: "Count" },
];

/** One item in one store's top 5 (by sales and/or by count). */
interface StoreItemRow {
  store: string;
  item: TopItem;
  rankSales: number | null;
  rankCount: number | null;
}

/** An item merged over the chosen stores' top-5 lists. */
interface MergedRow {
  id: string;
  name: string;
  stores: number;
  qty: number;
  sales: number;
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

export function BrTopItemsCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<Metric>("sales");
  const items = metric === "count" ? data.top_items.by_count : data.top_items.by_sales;

  return (
    <V1Card
      title="Top Menu Items"
      category="menu"
      period="R"
      span={BR_TOP_ITEMS_SPAN}
      onExpand={() => setOpen(true)}
      headerControl={<V1Toggle<Metric> className="ms-1" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />}
    >
      {items.length === 0 ? (
        <V1Empty icon={TrendingUp}>No items sold in this range</V1Empty>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={item.item_id} className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <RankBadge idx={idx} />
                <span className="truncate text-[13px] font-medium" title={item.menu_item_name}>
                  {item.menu_item_name}
                </span>
              </div>
              <span className="shrink-0 text-[13px] font-bold tabular-nums">
                {metric === "count" ? `${fmtNum(item.quantity_sold)} sold` : <Money value={item.gross_sales} />}
              </span>
            </div>
          ))}
        </div>
      )}

      {open && <TopItemsDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function rankBars(items: TopItem[], metric: Metric): BarRow[] {
  return items.map((it, idx) => ({
    key: it.item_id,
    label: `${idx + 1}. ${it.menu_item_name}`,
    value: metric === "sales" ? it.gross_sales : it.quantity_sold,
    display: metric === "sales" ? fmt$2(it.gross_sales) : `${fmtNum(it.quantity_sold)} sold`,
    sub: metric === "sales" ? `${fmtNum(it.quantity_sold)} sold` : fmt$2(it.gross_sales),
  }));
}

/** Every store's top-5 items, one row per store × item (both lists merged). */
function storeItemRows(byStore: MenuSection["top_items"]["by_store"]): StoreItemRow[] {
  return Object.entries(byStore).flatMap(([store, lists]) => {
    const ids = Array.from(new Set([...lists.by_sales, ...lists.by_count].map((i) => i.item_id)));
    return ids.map((id) => {
      const rs = lists.by_sales.findIndex((i) => i.item_id === id);
      const rc = lists.by_count.findIndex((i) => i.item_id === id);
      const item = (rs >= 0 ? lists.by_sales[rs] : lists.by_count[rc]) as TopItem;
      return { store, item, rankSales: rs >= 0 ? rs + 1 : null, rankCount: rc >= 0 ? rc + 1 : null };
    });
  });
}

function mergeItems(rows: StoreItemRow[]): MergedRow[] {
  const merged = rows.reduce<Map<string, MergedRow>>((acc, r) => {
    const prev = acc.get(r.item.item_id);
    return acc.set(r.item.item_id, {
      id: r.item.item_id,
      name: r.item.menu_item_name,
      stores: (prev?.stores ?? 0) + 1,
      qty: (prev?.qty ?? 0) + r.item.quantity_sold,
      sales: (prev?.sales ?? 0) + r.item.gross_sales,
    });
  }, new Map());
  return [...merged.values()];
}

const RANK_CELL = (rank: number | null) => (rank === null ? <span className="text-muted-foreground">—</span> : `#${rank}`);

const MERGED_COLUMNS: PagedColumn<MergedRow>[] = [
  { key: "name", header: "Item", sortValue: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "stores", header: "In top 5 of", numeric: true, sortValue: (r) => r.stores, render: (r) => `${fmtNum(r.stores)} stores` },
  { key: "qty", header: "Qty", numeric: true, sortValue: (r) => r.qty, render: (r) => fmtNum(r.qty) },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => <span className="font-bold">{fmt$2(r.sales)}</span> },
];

function TopItemsDialog({ data, onClose }: { data: MenuSection; onClose: () => void }) {
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const t = data.top_items;
  const offered = useMemo(() => Object.keys(t.by_store), [t.by_store]);

  const allRows = useMemo(() => storeItemRows(t.by_store), [t.by_store]);
  const picked = useMemo(() => inStores(allRows, stores, (r) => r.store), [allRows, stores]);
  const merged = useMemo(() => mergeItems(picked), [picked]);

  const storeCols = useMemo<PagedColumn<StoreItemRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      { key: "item", header: "Item", sortValue: (r) => r.item.menu_item_name, render: (r) => r.item.menu_item_name },
      { key: "rs", header: "Rank · sales", numeric: true, sortValue: (r) => r.rankSales, render: (r) => RANK_CELL(r.rankSales) },
      { key: "rc", header: "Rank · count", numeric: true, sortValue: (r) => r.rankCount, render: (r) => RANK_CELL(r.rankCount) },
      { key: "qty", header: "Qty", numeric: true, sortValue: (r) => r.item.quantity_sold, render: (r) => fmtNum(r.item.quantity_sold) },
      {
        key: "sales",
        header: "Sales",
        numeric: true,
        sortValue: (r) => r.item.gross_sales,
        render: (r) => <span className="font-bold">{fmt$2(r.item.gross_sales)}</span>,
      },
    ],
    [storeName],
  );

  const sumSales = t.by_sales.reduce((s, i) => s + i.gross_sales, 0);
  const sumQty = t.by_count.reduce((s, i) => s + i.quantity_sold, 0);
  const stats: ReportStat[] = [
    { label: "#1 by sales", value: t.by_sales[0]?.menu_item_name ?? "—", sub: t.by_sales[0] ? fmt$2(t.by_sales[0].gross_sales) : undefined },
    {
      label: "#1 by count",
      value: t.by_count[0]?.menu_item_name ?? "—",
      sub: t.by_count[0] ? `${fmtNum(t.by_count[0].quantity_sold)} sold` : undefined,
    },
    { label: `Top ${t.by_sales.length} sales`, value: fmt$2(sumSales), sub: "combined, all stores" },
    { label: `Top ${t.by_count.length} qty`, value: fmtNum(sumQty), sub: "combined, all stores" },
    { label: "Stores", value: fmtNum(offered.length) },
  ];

  const checklist = <StoreChecklist value={stores} onChange={setStores} stores={offered} />;
  const scope = stores.length === 0 ? "all stores" : `${fmtNum(stores.length)} of ${fmtNum(offered.length)} stores`;

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="All stores · by sales">
            <BarList rows={rankBars(t.by_sales, "sales")} color={SALES_COLOR} empty="No items sold in this range" />
          </ReportBlock>
          <ReportBlock title="All stores · by count">
            <BarList rows={rankBars(t.by_count, "count")} color={COUNT_COLOR} empty="No items sold in this range" />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <div className="space-y-4">
          <ReportBlock
            title={`Items across ${scope}`}
            description="Each store's top 5 (by sales and by count), merged — an item only counts where it made a store's top 5"
            action={checklist}
          >
            <PagedTable
              size="lg"
              rows={merged}
              columns={MERGED_COLUMNS}
              rowKey={(r) => r.id}
              initialSort="sales"
              searchText={(r) => r.name}
              searchPlaceholder="Search items…"
            />
          </ReportBlock>
          <ReportBlock title={`Top 5s of ${scope}`} description="One row per store and item">
            <PagedTable
              size="lg"
              rows={picked}
              columns={storeCols}
              rowKey={(r) => `${r.store}|${r.item.item_id}`}
              initialSort="sales"
              searchText={(r) => `${storeName(r.store)} ${r.item.menu_item_name}`}
              searchPlaceholder="Search stores or items…"
            />
          </ReportBlock>
        </div>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Top Menu Items"
      category="menu"
      stats={stats}
      tabs={tabs}
    />
  );
}
