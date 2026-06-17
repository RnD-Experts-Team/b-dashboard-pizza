"use client";

import { cn } from "@/lib/utils";
import type { Lto } from "@/types/dashboard-report.types";
import {
  fmt$2,
  fmtNum,
  fmtPct2,
  WbrCardSkeleton,
} from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { Sparkles } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1LtoCard — weekly limited-time-offer sales & per-item contribution.
 *  Data shaping mirrors components/dspr/wbr-lto-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1LtoCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: Lto;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Weekly LTO" category="menu" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, lto_totals, items } = data;

  return (
    <V1Card
      title="Weekly LTO"
      category="menu"
      period="W"
      span={span}
      className={className}
      headerNote={`${filtering.week_start} → ${filtering.week_end}`}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={2}>
          <V1Metric label="LTO Sales" value={fmt$2(lto_totals.total_sales)} />
          <V1Metric label="LTO Qty" value={fmtNum(lto_totals.total_quantity)} />
          <V1Metric
            label="% of Store Sales"
            value={fmtPct2(lto_totals.pct_of_store_sales)}
          />
          <V1Metric
            label="% of Store Qty"
            value={fmtPct2(lto_totals.pct_of_store_quantity)}
          />
        </V1MetricGrid>

        {items.length === 0 ? (
          <V1Empty icon={Sparkles}>No LTO items this week.</V1Empty>
        ) : (
          <table className={V1_TBL}>
            <thead>
              <tr>
                <th className={V1_TH}>Item</th>
                <th className={cn(V1_TH, V1_NUM)}>Sales</th>
                <th className={cn(V1_TH, V1_NUM)}>Qty</th>
                <th className={cn(V1_TH, V1_NUM)}>% Sales</th>
                <th className={cn(V1_TH, V1_NUM)}>% Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.item_id}>
                  <td className={cn(V1_TD, "tabular-nums")}>{it.item_id}</td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    {fmt$2(it.current_week_sales)}
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    {fmtNum(it.current_week_quantity)}
                  </td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                    {fmtPct2(it.pct_of_store_sales)}
                  </td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                    {fmtPct2(it.pct_of_store_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </V1Card>
  );
}
