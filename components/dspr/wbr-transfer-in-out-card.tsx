"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TransferInOut, TransferEntry } from "@/types/dashboard-report.types";
import { fmt$, fmt$2, fmtDate, StatTile } from "./wbr-format";
import { WbrDetailDialog, DetailField } from "./wbr-detail-dialog";

function entryKey(e: TransferEntry, i: number) {
  return `${e.date}-${e.ing_des}-${i}`;
}

function direction(e: TransferEntry, storeId: string | null) {
  if (!storeId) return null;
  if (e.to_store_number === storeId) return "in" as const;
  if (e.from_store_number === storeId) return "out" as const;
  return null;
}

export function WbrTransferInOutCard({
  data,
  storeId,
  className,
}: {
  data?: TransferInOut;
  storeId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!data) return null;

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
    <>
      <Card
        onClick={() => !empty && setOpen(true)}
        className={cn(
          "flex h-[280px] flex-col gap-0 py-1.5 transition-shadow bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/40 dark:to-violet-800/50",
          !empty && "cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-violet-500/15 p-0.5 dark:bg-violet-500/20">
              <ArrowLeftRight className="h-3 w-3 text-violet-500" />
            </div>
            Transfers In/Out
            <div className="ml-auto flex items-center gap-1">
              {inCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 gap-0.5 px-1.5 py-0 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  <ArrowDownToLine className="h-2.5 w-2.5" />
                  {inCount}
                </Badge>
              )}
              {outCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 gap-0.5 px-1.5 py-0 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400"
                >
                  <ArrowUpFromLine className="h-2.5 w-2.5" />
                  {outCount}
                </Badge>
              )}
              {empty && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 py-0 text-[10px] bg-muted text-muted-foreground"
                >
                  0
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2">
          <div className="grid grid-cols-2 gap-1.5">
            <StatTile label="Sales (Wk)" value={fmt$(sales.current_week)} />
            <StatTile label="Sales (Prev Wk)" value={fmt$(sales.previous_week)} />
          </div>

          {!empty && (
            <StatTile
              label="Total Transfer Cost"
              value={fmt$2(totalCost)}
              valueClass="text-violet-600 dark:text-violet-400"
            />
          )}

          {empty ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              No transfers this week.
            </p>
          ) : (
            entries.map((e, i) => {
              const dir = direction(e, currentStoreId);
              return (
                <div
                  key={entryKey(e, i)}
                  className="rounded-md bg-background/40 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {dir === "in" && (
                        <ArrowDownToLine className="h-3 w-3 shrink-0 text-emerald-500" />
                      )}
                      {dir === "out" && (
                        <ArrowUpFromLine className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                      <span className="line-clamp-1 text-[11px] font-semibold">
                        {e.ing_des}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                      {fmt$2(parseFloat(e.total_cost) || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-4">
                    <span className="text-[10px] text-muted-foreground">
                      {e.quantity} {e.unit}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtDate(e.date)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Ingredient Transfers"
        badgeText={`${entries.length} transfer${entries.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Sales (Wk)" value={fmt$(sales.current_week)} />
            <StatTile label="Sales (Prev Wk)" value={fmt$(sales.previous_week)} />
            <StatTile
              label="Blue Line (Wk)"
              value={fmt$(blue_line.current_week)}
              valueClass="text-sky-600 dark:text-sky-400"
            />
            <StatTile
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
                        <Badge
                          variant="secondary"
                          className="h-5 gap-1 px-1.5 py-0 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                          IN
                        </Badge>
                      )}
                      {dir === "out" && (
                        <Badge
                          variant="secondary"
                          className="h-5 gap-1 px-1.5 py-0 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        >
                          <ArrowUpFromLine className="h-3 w-3" />
                          OUT
                        </Badge>
                      )}
                      <span className="text-sm font-semibold">{e.ing_des}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmt$2(parseFloat(e.total_cost) || 0)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <DetailField label="Date" value={fmtDate(e.date)} />
                    <DetailField label="Quantity" value={`${e.quantity} ${e.unit}`} />
                    <DetailField label="From" value={e.from_store_number} />
                    <DetailField label="To" value={e.to_store_number} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </WbrDetailDialog>
    </>
  );
}
