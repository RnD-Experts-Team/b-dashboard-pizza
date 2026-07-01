"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Promo } from "@/types/dashboard-report.types";
import {
  fmt$,
  fmtPct,
  fmtDate,
  stripPunchh,
  Delta,
  pctChangeOrNull,
  WbrCardSkeleton,
} from "@/components/dspr/wbr-format";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1DataRow,
  V1SubLabel,
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1PromoCard — weekly promo sales, WoW, and top promo groups.
 *  Data shaping mirrors components/dspr/wbr-promo-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

/** Promo buckets we surface by name; everything else rolls into "Others". */
const NAMED_PROMOS = [
  "MIXNMATCH",
  "5OFF30",
  "Spend $35, save $5",
  "WEDELIVER",
  "Gasta $35, ahorra $5",
];

export function V1PromoCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: Promo;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Weekly Promos" category="menu" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

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
  const storeSales = current_week.total_store_sales || 1;

  // Full ungrouped current-week breakdown for the dialog (sorted desc).
  const fullBreakdown = [...current_week.promo_breakdown].sort(
    (a, b) => b.promo_sales - a.promo_sales,
  );

  return (
      <V1Card
        title="Weekly Promos"
        category="menu"
        period="W"
        span={span}
        className={className}
        headerNote={`${fmtPct(totals.pct_of_store_sales)} of sales`}
        onExpand={() => setOpen(true)}
      >
        <div className="space-y-2">
          <V1MetricGrid cols={2}>
            <V1Metric
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
            <V1Metric
              label="Promo Sales"
              value={fmt$(totals.total_promo_sales)}
              sub={<Delta value={week_over_week.promo_sales_change_pct} />}
            />
          </V1MetricGrid>

          <V1DataRow
            label="Promo % of sales"
            value={fmtPct(week_over_week.current_week_promo_to_sales_pct)}
            trailing={
              <span
                className={cn(
                  "tabular-nums",
                  week_over_week.promo_to_sales_pct_change >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                ({week_over_week.promo_to_sales_pct_change >= 0 ? "+" : ""}
                {week_over_week.promo_to_sales_pct_change.toFixed(2)} pts)
              </span>
            }
          />

          <div>
            <V1SubLabel className="mb-1">Top Promo Groups</V1SubLabel>
            <div className="space-y-1.5">
              {groupRows.map((g) => (
                <V1DataRow
                  key={g.label}
                  label={g.label}
                  value={fmt$(g.value)}
                  trailing={
                    <span className="text-[10px] text-muted-foreground">
                      {fmtPct((g.value / storeSales) * 100)}
                    </span>
                  }
                  className="border-0 py-0"
                />
              ))}
            </div>
          </div>
        </div>
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Promo Breakdown — Current Week"
        badgeText={`${fmtDate(filtering.week_start)} → ${fmtDate(filtering.week_end)}`}
      >
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Promo Code</th>
              <th className={cn(V1_TH, V1_NUM)}>Sales</th>
              <th className={cn(V1_TH, V1_NUM)}>% of Store</th>
            </tr>
          </thead>
          <tbody>
            {fullBreakdown.map((p, i) => (
              <tr key={i}>
                <td className={cn(V1_TD, "whitespace-normal break-words")}>
                  {stripPunchh(p.modification_reason)}
                </td>
                <td className={cn(V1_TD, V1_NUM)}>{fmt$(p.promo_sales)}</td>
                <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                  {fmtPct(p.pct_of_store_sales)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 font-semibold">
              <td className={V1_TD}>Total</td>
              <td className={cn(V1_TD, V1_NUM)}>{fmt$(totals.total_promo_sales)}</td>
              <td className={cn(V1_TD, V1_NUM)}>
                {fmtPct(totals.pct_of_store_sales)}
              </td>
            </tr>
          </tbody>
        </table>
      </WbrDetailDialog>
    </V1Card>
  );
}
