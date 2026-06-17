"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeltaBadge, TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { Promo } from "@/types/dashboard-report.types";
import {
  fmt$,
  fmtPct,
  fmtDate,
  stripPunchh,
  Delta,
  pctChangeOrNull,
  StatTile,
  WbrCardSkeleton,
} from "./wbr-format";
import { WbrDetailDialog } from "./wbr-detail-dialog";

/** Promo buckets we surface by name; everything else rolls into "Others". */
const NAMED_PROMOS = [
  "MIXNMATCH",
  "5OFF30",
  "Spend $35, save $5",
  "WEDELIVER",
  "Gasta $35, ahorra $5",
];

export function WbrPromoCard({
  data,
  isLoading,
  className,
}: {
  data?: Promo;
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, current_week, previous_week, week_over_week } = data;
  const totals = current_week.promo_totals;

  // Group the current-week breakdown into named buckets + Others.
  const bucket = new Map<string, number>(NAMED_PROMOS.map((n) => [n, 0]));
  let others = 0;
  for (const p of current_week.promo_breakdown) {
    const name = stripPunchh(p.modification_reason);
    const match = NAMED_PROMOS.find(
      (n) => n.toLowerCase() === name.toLowerCase(),
    );
    if (match) bucket.set(match, (bucket.get(match) ?? 0) + p.promo_sales);
    else others += p.promo_sales;
  }
  const groupRows = [
    ...NAMED_PROMOS.filter((n) => (bucket.get(n) ?? 0) > 0).map((n) => ({
      label: n,
      value: bucket.get(n) ?? 0,
    })),
    ...(others > 0 ? [{ label: "Others", value: others }] : []),
  ];

  // Full ungrouped current-week breakdown for the dialog (sorted desc).
  const fullBreakdown = [...current_week.promo_breakdown].sort(
    (a, b) => b.promo_sales - a.promo_sales,
  );

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[280px] cursor-pointer flex-col gap-0 py-1.5 transition-shadow hover:shadow-md bg-linear-to-r from-rose-50 via-rose-100 to-rose-200 dark:from-rose-950/20 dark:via-rose-900/40 dark:to-rose-800/50",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-rose-500/15 p-0.5 dark:bg-rose-500/20">
              <Tag className="h-3 w-3 text-rose-500" />
            </div>
            Weekly Promos
            <span className="ml-auto font-normal text-muted-foreground">
              {fmtPct(totals.pct_of_store_sales)} of sales
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
          {/* WoW store sales + promo sales */}
          <div className="grid grid-cols-2 gap-1.5">
            <StatTile
              label="Store Sales"
              value={fmt$(current_week.total_store_sales)}
              sub={
                <Delta
                  value={pctChangeOrNull(
                    current_week.total_store_sales,
                    previous_week.total_store_sales,
                  )}
                />
              }
            />
            <StatTile
              label="Promo Sales"
              value={fmt$(totals.total_promo_sales)}
              sub={<DeltaBadge value={week_over_week.promo_sales_change_pct} />}
            />
          </div>

          {/* % of sales + WoW pt change */}
          <div className="rounded-md bg-background/50 px-2 py-1.5 text-[11px]">
            <span className="text-muted-foreground">Promo % of sales: </span>
            <span className="font-semibold tabular-nums">
              {fmtPct(week_over_week.current_week_promo_to_sales_pct)}
            </span>
            <span
              className={cn(
                "ml-1 font-semibold tabular-nums",
                week_over_week.promo_to_sales_pct_change >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              ({week_over_week.promo_to_sales_pct_change >= 0 ? "+" : ""}
              {week_over_week.promo_to_sales_pct_change.toFixed(2)} pts)
            </span>
          </div>

          {/* Current-week channel totals */}
          <div className="grid grid-cols-4 gap-1">
            <StatTile label="DoorDash" value={fmt$(totals.total_doordash)} />
            <StatTile label="UberEats" value={fmt$(totals.total_ubereats)} />
            <StatTile label="GrubHub" value={fmt$(totals.total_grubhub)} />
            <StatTile label="LC" value={fmt$(totals.total_lc)} />
          </div>

          {/* Grouped breakdown */}
          <table className={cn(TBL, "[&_th]:!bg-muted")}>
            <thead>
              <tr>
                <th className={TH}>Promo</th>
                <th className={cn(TH, NUM)}>Sales</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((g) => (
                <tr key={g.label}>
                  <td className={TD}>{g.label}</td>
                  <td className={cn(TD, NUM)}>{fmt$(g.value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className={TD}>Total</td>
                <td className={cn(TD, NUM)}>{fmt$(totals.total_promo_sales)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Promo Breakdown — Current Week"
        badgeText={`${fmtDate(filtering.week_start)} → ${fmtDate(filtering.week_end)}`}
      >
        <table className={cn(TBL, "[&_th]:!bg-muted/60")}>
          <thead>
            <tr>
              <th className={TH}>Promo Code</th>
              <th className={cn(TH, NUM)}>Sales</th>
              <th className={cn(TH, NUM)}>% of Store</th>
            </tr>
          </thead>
          <tbody>
            {fullBreakdown.map((p, i) => (
              <tr key={i}>
                <td className={cn(TD, "whitespace-normal break-words")}>
                  {stripPunchh(p.modification_reason)}
                </td>
                <td className={cn(TD, NUM)}>{fmt$(p.promo_sales)}</td>
                <td className={cn(TD, NUM, "text-muted-foreground")}>
                  {fmtPct(p.pct_of_store_sales)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 font-semibold">
              <td className={TD}>Total</td>
              <td className={cn(TD, NUM)}>{fmt$(totals.total_promo_sales)}</td>
              <td className={cn(TD, NUM)}>{fmtPct(totals.pct_of_store_sales)}</td>
            </tr>
          </tbody>
        </table>
      </WbrDetailDialog>
    </>
  );
}
