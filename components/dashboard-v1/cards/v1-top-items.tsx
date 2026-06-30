"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TopMenuItem, UpsellingRecord } from "@/types/dspr.types";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Toggle,
  V1Empty,
  V1SubLabel,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1TopItemsCard — ranked top-5 menu items by sales or count, Day vs WTD.
 *  Data shaping mirrors components/dspr/top-lists.tsx (TopItemsList).
 * ────────────────────────────────────────────────────────────────────────── */

const RANK_BADGE = [
  "bg-amber-500 text-white", // #1 gold
  "bg-slate-400 text-white", // #2 silver
  "bg-amber-700 text-white", // #3 bronze
  "bg-muted text-muted-foreground", // #4
  "bg-muted text-muted-foreground", // #5
];

const UPSELLING_EXCLUDED = new Set(["beverages", "crazy_puffs", "pizza_base"]);

function formatUpsellKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseUpselling(
  data: UpsellingRecord,
): { name: string; count: number }[] {
  return (Object.entries(data) as [string, number | undefined][])
    .filter(([key, val]) => !UPSELLING_EXCLUDED.has(key) && val != null)
    .map(([key, val]) => ({ name: formatUpsellKey(key), count: val as number }))
    .sort((a, b) => b.count - a.count);
}

const fmtSales = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function V1TopItemsCard({
  items,
  weeklyItems,
  countItems,
  weeklyCountItems,
  upselling,
  isLoading,
  span,
  className,
}: {
  items: TopMenuItem[];
  weeklyItems?: TopMenuItem[];
  countItems?: TopMenuItem[];
  weeklyCountItems?: TopMenuItem[];
  upselling?: {
    day?: UpsellingRecord;
    week_to_date?: UpsellingRecord;
    total_upselling_day?: number;
    total_upselling_week_to_date?: number;
  };
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<"day" | "wtd">("day");
  const [metric, setMetric] = useState<"sales" | "count" | "upsell">("sales");

  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!items)
    return (
      <V1Card title="Top Menu Items" category="menu" period="D·WTD" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const isWeekly = period === "wtd";
  const hasWeekly =
    !!weeklyItems || !!weeklyCountItems || !!upselling?.week_to_date;

  const salesData = isWeekly ? weeklyItems ?? items : items;
  const countData = isWeekly
    ? weeklyCountItems ?? countItems ?? []
    : countItems ?? [];

  const upsellData = parseUpselling(
    isWeekly ? upselling?.week_to_date ?? {} : upselling?.day ?? {},
  );

  const activeItems = metric === "count" ? countData : salesData;

  return (
      <V1Card
        title="Top Menu Items"
        category="menu"
        period="D·WTD"
        span={span}
        className={className}
        onExpand={hasWeekly ? () => setOpen(true) : undefined}
        headerControl={
          hasWeekly ? (
            <V1Toggle
              options={[
                { value: "day", label: "Day" },
                { value: "wtd", label: "WTD" },
              ]}
              value={period}
              onChange={setPeriod}
              className="ms-1"
            />
          ) : undefined
        }
      >
        <div className="space-y-2">
          <div onClick={(e) => e.stopPropagation()}>
            <V1Toggle
              options={[
                { value: "sales", label: "Sales" },
                { value: "count", label: "Count" },
                { value: "upsell", label: "Upsell" },
              ]}
              value={metric}
              onChange={setMetric}
            />
          </div>

          {metric === "upsell" ? (
            upsellData.length === 0 ? (
              <V1Empty icon={TrendingUp}>No upselling data</V1Empty>
            ) : (
              <div className="space-y-1.5">
                {upsellData.map(({ name, count }, idx) => (
                  <div key={name} className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                          RANK_BADGE[idx] ?? RANK_BADGE[3],
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate text-[13px] font-medium">{name}</span>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )
          ) : activeItems.length === 0 ? (
            <V1Empty icon={TrendingUp}>No data available</V1Empty>
          ) : (
            <div className="space-y-1.5">
              {activeItems.map((item, idx) => (
                <div key={item.item_id} className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                        RANK_BADGE[idx] ?? RANK_BADGE[3],
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate text-[13px] font-medium">
                      {item.menu_item_name}
                    </span>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums">
                    {metric === "count"
                      ? `${item.quantity_sold} sold`
                      : fmtSales(item.gross_sales)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      {hasWeekly && (
        <WbrDetailDialog
          open={open}
          onOpenChange={setOpen}
          title="Top Items Comparison"
          badgeText="Daily vs Week-to-Date"
        >
          <div className="space-y-6">
            {/* ── By Sales ── */}
            <div>
              <V1SubLabel className="mb-2 px-1">By Sales</V1SubLabel>
              <RankShiftTable
                today={items}
                wtd={weeklyItems ?? []}
              />
            </div>

            {/* ── By Count ── */}
            <div>
              <V1SubLabel className="mb-2 px-1">By Count</V1SubLabel>
              <RankShiftTable
                today={countItems ?? []}
                wtd={weeklyCountItems ?? []}
              />
            </div>

            {/* ── Upselling ── */}
            {upselling && (
              <div>
                <V1SubLabel className="mb-2 px-1">Upselling</V1SubLabel>
                <UpsellTable
                  day={upselling.day ?? {}}
                  wtd={upselling.week_to_date ?? {}}
                />
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Rank Shift = position gain/loss comparing Today rank vs
              Week-to-Date rank
            </p>
          </div>
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}

function RankShiftTable({
  today,
  wtd,
}: {
  today: TopMenuItem[];
  wtd: TopMenuItem[];
}) {
  const allIds = Array.from(
    new Set([...today.map((i) => i.item_id), ...wtd.map((i) => i.item_id)]),
  );
  return (
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={cn(V1_TH, "w-8")}>#</th>
          <th className={V1_TH}>Item</th>
          <th className={cn(V1_TH, V1_NUM)}>Today Qty</th>
          <th className={cn(V1_TH, V1_NUM)}>Today Sales</th>
          <th className={cn(V1_TH, V1_NUM)}>WTD Qty</th>
          <th className={cn(V1_TH, V1_NUM)}>WTD Sales</th>
          <th className={cn(V1_TH, "text-center")}>Rank Shift</th>
        </tr>
      </thead>
      <tbody>
        {allIds.map((id, tableIdx) => {
          const todayIdx = today.findIndex((i) => i.item_id === id);
          const wtdIdx = wtd.findIndex((i) => i.item_id === id);
          const todayItem = todayIdx !== -1 ? today[todayIdx] : null;
          const wtdItem = wtdIdx !== -1 ? wtd[wtdIdx] : null;
          const name =
            todayItem?.menu_item_name ?? wtdItem?.menu_item_name ?? "—";
          const rankShift =
            todayIdx !== -1 && wtdIdx !== -1 ? wtdIdx - todayIdx : null;
          return (
            <tr key={id}>
              <td className={V1_TD}>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                    RANK_BADGE[tableIdx] ?? RANK_BADGE[3],
                  )}
                >
                  {tableIdx + 1}
                </span>
              </td>
              <td className={cn(V1_TD, "font-semibold")}>{name}</td>
              <td className={cn(V1_TD, V1_NUM)}>
                {todayItem ? (
                  todayItem.quantity_sold
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className={cn(V1_TD, V1_NUM, "font-bold")}>
                {todayItem ? (
                  fmtSales(todayItem.gross_sales)
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                {wtdItem ? (
                  wtdItem.quantity_sold
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className={cn(V1_TD, V1_NUM, "font-bold")}>
                {wtdItem ? (
                  fmtSales(wtdItem.gross_sales)
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className={cn(V1_TD, "text-center")}>
                {rankShift === null ? (
                  <span className="text-[10px] text-muted-foreground/40">—</span>
                ) : rankShift === 0 ? (
                  <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                    <TrendingUp className="h-3 w-3 opacity-30" /> same
                  </span>
                ) : rankShift > 0 ? (
                  <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold text-emerald-500">
                    <TrendingUp className="h-3.5 w-3.5" /> +{rankShift}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold text-red-500">
                    <TrendingDown className="h-3.5 w-3.5" /> {rankShift}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UpsellTable({
  day,
  wtd,
}: {
  day: UpsellingRecord;
  wtd: UpsellingRecord;
}) {
  const allKeys = Array.from(
    new Set([...Object.keys(day), ...Object.keys(wtd)]),
  )
    .filter((k) => !UPSELLING_EXCLUDED.has(k))
    .sort((a, b) => ((wtd[b] ?? 0) as number) - ((wtd[a] ?? 0) as number));
  return (
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={cn(V1_TH, "w-8")}>#</th>
          <th className={V1_TH}>Category</th>
          <th className={cn(V1_TH, V1_NUM)}>Today</th>
          <th className={cn(V1_TH, V1_NUM)}>WTD</th>
        </tr>
      </thead>
      <tbody>
        {allKeys.map((key, tableIdx) => (
          <tr key={key}>
            <td className={V1_TD}>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                  RANK_BADGE[tableIdx] ?? RANK_BADGE[3],
                )}
              >
                {tableIdx + 1}
              </span>
            </td>
            <td className={cn(V1_TD, "font-semibold")}>
              {formatUpsellKey(key)}
            </td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>
              {day[key] != null ? (
                day[key]
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>
              {wtd[key] != null ? (
                wtd[key]
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
