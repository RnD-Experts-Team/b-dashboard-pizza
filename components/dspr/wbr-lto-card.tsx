"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { Lto } from "@/types/dashboard-report.types";
import { fmt$2, fmtDate, fmtNum, fmtPct2, StatTile, WbrCardSkeleton } from "./wbr-format";

export function WbrLtoCard({
  data,
  isLoading,
  className,
}: {
  data?: Lto;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, lto_totals, items } = data;

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-fuchsia-50 via-fuchsia-100 to-fuchsia-200 dark:from-fuchsia-950/20 dark:via-fuchsia-900/40 dark:to-fuchsia-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-fuchsia-500/15 p-0.5 dark:bg-fuchsia-500/20">
            <Sparkles className="h-3 w-3 text-fuchsia-500" />
          </div>
          Weekly LTO
          <span className="ml-auto font-normal text-muted-foreground">
            {fmtDate(filtering.week_start)} → {fmtDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        {/* LTO totals */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile label="LTO Sales" value={fmt$2(lto_totals.total_sales)} />
          <StatTile label="LTO Qty" value={fmtNum(lto_totals.total_quantity)} />
          <StatTile
            label="% of Store Sales"
            value={fmtPct2(lto_totals.pct_of_store_sales)}
          />
          <StatTile
            label="% of Store Qty"
            value={fmtPct2(lto_totals.pct_of_store_quantity)}
          />
        </div>

        {/* Per-item contribution */}
        <table className={cn(TBL, "[&_th]:!bg-muted")}>
          <thead>
            <tr>
              <th className={TH}>Item</th>
              <th className={cn(TH, NUM)}>Sales</th>
              <th className={cn(TH, NUM)}>Qty</th>
              <th className={cn(TH, NUM)}>% Sales</th>
              <th className={cn(TH, NUM)}>% Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.item_id}>
                <td className={cn(TD, "tabular-nums")}>{it.item_id}</td>
                <td className={cn(TD, NUM)}>{fmt$2(it.current_week_sales)}</td>
                <td className={cn(TD, NUM)}>{fmtNum(it.current_week_quantity)}</td>
                <td className={cn(TD, NUM, "text-muted-foreground")}>
                  {fmtPct2(it.pct_of_store_sales)}
                </td>
                <td className={cn(TD, NUM, "text-muted-foreground")}>
                  {fmtPct2(it.pct_of_store_quantity)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className={cn(TD, "text-muted-foreground")}>
                  No LTO items this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
