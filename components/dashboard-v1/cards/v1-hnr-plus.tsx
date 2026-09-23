"use client";

import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { V1Card } from "../v1-card";
import { V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "../v1-ui";
import { fmtNum, fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import type { HnrPlus } from "@/types/dashboard-report.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1HnrPlusCard — Dashboard V1, category "operations", period "W".
 *  Full-width production/waste/variance scorecard: five measured percentages
 *  each with a derived 0-100 score, a total score, and a per-item breakdown.
 * ────────────────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtVariance(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtNum(n)}`;
}

export function V1HnrPlusCard({
  data,
  isLoading,
  span = 4,
  className,
}: {
  data?: HnrPlus;
  isLoading?: boolean;
  span?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="HNR+" category="operations" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const {
    filtering,
    made,
    sold_percent,
    void_percent,
    waste_percent,
    variance_percent,
    no_inventory_percent,
    variance_score,
    sold_score,
    no_inventory_score,
    void_score,
    waste_score,
    total_score,
    items,
  } = data;

  const metrics: { label: string; value: string; score: number }[] = [
    { label: "Sold", value: fmtPct(sold_percent), score: sold_score },
    { label: "Void", value: fmtPct(void_percent), score: void_score },
    { label: "Waste", value: fmtPct(waste_percent), score: waste_score },
    { label: "Variance", value: fmtPct(variance_percent), score: variance_score },
    { label: "No Inventory", value: fmtPct(no_inventory_percent), score: no_inventory_score },
  ];

  return (
    <V1Card
      title="HNR+"
      category="operations"
      period="W"
      span={span}
      className={className}
    >
      {/* Content sizes to its own natural height (not forced into a
       * shrink-to-fit flex column) — the card's own fixed height + the
       * V1Card body's overflow-y-auto scroll everything below the fold,
       * so the metric grid wrapping to 3 rows on mobile never squeezes the
       * items table down to zero height. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-md bg-background/55 px-2.5 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total Score
          </span>
          <span className={cn("text-base font-bold tabular-nums", scoreColor(total_score))}>
            {fmtPct(total_score)}
          </span>
          {filtering.used_previous_week && (
            <span className="text-[9px] font-medium text-muted-foreground">
              Using prior week&apos;s data
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-md bg-background/45 px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Made
            </p>
            <p className="text-[13px] font-bold tabular-nums">{fmtNum(made)}</p>
          </div>
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md bg-background/45 px-2.5 py-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </p>
              <p className="text-[13px] font-bold tabular-nums">{m.value}</p>
              <p className={cn("text-[9px] font-medium", scoreColor(m.score))}>
                Score {fmtNum(m.score)}
              </p>
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <V1Empty icon={Flame}>No item breakdown this period.</V1Empty>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/40">
            {/* min-w-max so narrow columns don't just get squeezed — the
             * table stays at its natural width and the wrapper scrolls
             * horizontally instead. */}
            <table className={cn(V1_TBL, "min-w-max")}>
              <thead>
                <tr>
                  <th className={V1_TH}>Item</th>
                  <th className={cn(V1_TH, V1_NUM)}>Made</th>
                  <th className={cn(V1_TH, V1_NUM)}>Sold</th>
                  <th className={cn(V1_TH, V1_NUM)}>Voided</th>
                  <th className={cn(V1_TH, V1_NUM)}>Wasted</th>
                  <th className={cn(V1_TH, V1_NUM)}>Variance</th>
                  <th className={cn(V1_TH, V1_NUM)}>No Inv.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isOver = item.variance > 0;
                  const isUnder = item.variance < 0;
                  return (
                    <tr key={item.item_id}>
                      <td className={cn(V1_TD, "max-w-[160px] truncate font-medium")} title={item.item_name}>
                        {item.item_name}
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.made)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.sold)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.voided)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.wasted)}</td>
                      <td
                        className={cn(
                          V1_TD,
                          V1_NUM,
                          isOver && "text-red-600 dark:text-red-400",
                          isUnder && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {fmtVariance(item.variance)}
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.no_inventory_available)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </V1Card>
  );
}
