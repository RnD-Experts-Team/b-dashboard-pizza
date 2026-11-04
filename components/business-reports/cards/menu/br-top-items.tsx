"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty, V1SubLabel, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmtNum } from "@/components/business-reports/report-format";
import type { MenuSection, TopItem } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrTopItemsCard — V1 "Top Menu Items" over the range: the combined top 10
 *  by sales or by count. Expand: both combined lists side by side and one
 *  store's top 5 (picked from a select).
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_TOP_ITEMS_SPAN: V1Span = 1;

type Metric = "sales" | "count";

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "count", label: "Count" },
];

function RankBadge({ idx, size = "sm" }: { idx: number; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]",
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
                <span className="truncate text-[13px] font-medium">{item.menu_item_name}</span>
              </div>
              <span className="shrink-0 text-[13px] font-bold tabular-nums">
                {metric === "count" ? `${fmtNum(item.quantity_sold)} sold` : fmt$2(item.gross_sales)}
              </span>
            </div>
          ))}
        </div>
      )}

      <WbrDetailDialog open={open} onOpenChange={setOpen} title="Top Menu Items" badgeText="Combined and per store">
        {open && <TopItemsDetail data={data} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

function ItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) return <p className="py-4 text-center text-[11px] text-muted-foreground">No items</p>;
  return (
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={cn(V1_TH, "w-8")}>#</th>
          <th className={V1_TH}>Item</th>
          <th className={cn(V1_TH, V1_NUM)}>Qty</th>
          <th className={cn(V1_TH, V1_NUM)}>Sales</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={item.item_id}>
            <td className={V1_TD}>
              <RankBadge idx={idx} size="md" />
            </td>
            <td className={cn(V1_TD, "font-semibold")}>{item.menu_item_name}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.quantity_sold)}</td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>{fmt$2(item.gross_sales)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopItemsDetail({ data }: { data: MenuSection }) {
  const { storeName } = useReport();
  const stores = useMemo(
    () => Object.keys(data.top_items.by_store).sort((a, b) => storeName(a).localeCompare(storeName(b))),
    [data.top_items.by_store, storeName],
  );
  const [store, setStore] = useState<string>(() => stores[0] ?? "");
  const storeItems = data.top_items.by_store[store];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <V1SubLabel className="mb-2 px-1">All stores · by sales</V1SubLabel>
          <ItemsTable items={data.top_items.by_sales} />
        </div>
        <div>
          <V1SubLabel className="mb-2 px-1">All stores · by count</V1SubLabel>
          <ItemsTable items={data.top_items.by_count} />
        </div>
      </div>

      {stores.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <V1SubLabel>Top 5 for</V1SubLabel>
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger size="sm" className="h-7 w-56 text-xs">
                <SelectValue placeholder="Pick a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {storeName(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {storeItems && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <V1SubLabel className="mb-2 px-1">By sales</V1SubLabel>
                <ItemsTable items={storeItems.by_sales} />
              </div>
              <div>
                <V1SubLabel className="mb-2 px-1">By count</V1SubLabel>
                <ItemsTable items={storeItems.by_count} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
