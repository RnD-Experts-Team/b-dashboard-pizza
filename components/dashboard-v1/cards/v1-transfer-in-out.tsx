"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import type { TransferInOut, TransferEntry } from "@/types/dashboard-report.types";
import { fmt$, fmt$2, fmtDate, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1TransferInOutCard — weekly ingredient transfers. Body: in/out counts +
 *  total cost tiles plus a short list of entries (direction, ingredient,
 *  qty/unit, cost). Expand: full per-entry detail (date, qty, from/to store).
 *  Mirrors wbr-transfer-in-out-card shaping.
 * ────────────────────────────────────────────────────────────────────────── */

function entryKey(e: TransferEntry, i: number) {
  return `${e.date}-${e.ing_des}-${i}`;
}

function direction(e: TransferEntry, storeId: string | null) {
  if (!storeId) return null;
  if (e.to_store_number === storeId) return "in" as const;
  if (e.from_store_number === storeId) return "out" as const;
  return null;
}

export function V1TransferInOutCard({
  data,
  storeId,
  isLoading,
  span,
  className,
}: {
  data?: TransferInOut;
  storeId?: string | null;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Transfers In/Out" category="finance" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, entries, sales, blue_line } = data;
  const empty = entries.length === 0;
  const currentStoreId = storeId ?? filtering.store ?? null;

  const totalCost = entries.reduce(
    (sum, e) => sum + (parseFloat(e.total_cost) || 0),
    0,
  );
  const inCount = entries.filter(
    (e) => direction(e, currentStoreId) === "in",
  ).length;
  const outCount = entries.filter(
    (e) => direction(e, currentStoreId) === "out",
  ).length;

  return (
      <V1Card
        title="Transfers In/Out"
        category="finance"
        period="W"
        span={span}
        className={className}
        headerNote={`${entries.length} transfer${entries.length === 1 ? "" : "s"}`}
        onExpand={empty ? undefined : () => setOpen(true)}
      >
        {empty ? (
          <V1Empty icon={ArrowLeftRight}>No transfers this week.</V1Empty>
        ) : (
          <div className="space-y-2">
            <V1MetricGrid cols={3}>
              <V1Metric
                label="In"
                value={inCount}
                accent="text-emerald-600 dark:text-emerald-400"
                size="sm"
              />
              <V1Metric
                label="Out"
                value={outCount}
                accent="text-amber-600 dark:text-amber-400"
                size="sm"
              />
              <V1Metric label="Total Cost" value={fmt$2(totalCost)} size="sm" />
            </V1MetricGrid>

            <div className="space-y-1">
              {entries.map((e, i) => {
                const dir = direction(e, currentStoreId);
                return (
                  <div
                    key={entryKey(e, i)}
                    className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                  >
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium">
                      {dir === "in" && (
                        <ArrowDownToLine className="h-3 w-3 shrink-0 text-emerald-500" />
                      )}
                      {dir === "out" && (
                        <ArrowUpFromLine className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                      <span className="truncate">{e.ing_des}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                      <span className="text-muted-foreground">
                        {e.quantity} {e.unit}
                      </span>
                      <span className="font-semibold">
                        {fmt$2(parseFloat(e.total_cost) || 0)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Ingredient Transfers"
        badgeText={`${entries.length} transfer${entries.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DetailField label="Sales (Wk)" value={fmt$(sales.current_week)} />
            <DetailField
              label="Sales (Prev Wk)"
              value={fmt$(sales.previous_week)}
            />
            <DetailField
              label="Blue Line (Wk)"
              value={fmt$(blue_line.current_week)}
            />
            <DetailField
              label="Blue Line (Prev Wk)"
              value={fmt$(blue_line.previous_week)}
            />
          </div>

          <div className="space-y-3">
            {entries.map((e, i) => {
              const dir = direction(e, currentStoreId);
              return (
                <div
                  key={entryKey(e, i)}
                  className="space-y-2 rounded-lg border bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {dir === "in" && (
                        <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {dir === "out" && (
                        <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="text-sm font-semibold">{e.ing_des}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmt$2(parseFloat(e.total_cost) || 0)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <DetailField label="Date" value={fmtDate(e.date)} />
                    <DetailField
                      label="Quantity"
                      value={`${e.quantity} ${e.unit}`}
                    />
                    <DetailField label="From" value={e.from_store_number} />
                    <DetailField label="To" value={e.to_store_number} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </WbrDetailDialog>
    </V1Card>
  );
}
