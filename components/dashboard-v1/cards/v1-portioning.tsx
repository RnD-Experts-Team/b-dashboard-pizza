"use client";

import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import { V1Card } from "../v1-card";
import { V1Empty } from "../v1-ui";
import { fmt$2, fmtPct2, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import type { Portioning } from "@/types/dashboard-report.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1PortioningCard — Dashboard V1, category "quality", period "W".
 *  Mirrors components/dspr/wbr-portioning-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

/** Positive variance = used more than theoretical (bad); negative = used less (good). */
function fmtVariance(n: number): string {
  return `${n > 0 ? "+" : ""}${fmt$2(n)}`;
}

export function V1PortioningCard({
  data,
  isLoading,
  span = 4,
  className,
}: {
  data?: Portioning;
  isLoading?: boolean;
  span?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Portioning" category="quality" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { theo_usage, variance_breakdown } = data;

  return (
    <V1Card title="Portioning" category="quality" period="W" span={span} className={className}>
      <div className="flex h-full flex-col gap-2">
        <div className="shrink-0 rounded-md bg-background/55 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Theoretical Usage
          </p>
          <p className="text-base font-bold tabular-nums">{fmt$2(theo_usage)}</p>
        </div>

        {variance_breakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center text-muted-foreground">
            <Scale className="h-5 w-5 opacity-50" />
            <p className="text-[11px]">No variance data this period.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-4">
            {variance_breakdown.map((entry) => {
              const isOver = entry.variance_value > 0;
              const isUnder = entry.variance_value < 0;
              return (
                <div
                  key={entry.ingredient_id}
                  className="rounded-md bg-background/45 px-2.5 py-2"
                >
                  <p
                    className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                    title={entry.ingredient_description}
                  >
                    {entry.ingredient_description}
                  </p>
                  <p
                    className={cn(
                      "flex items-baseline gap-1.5 text-[13px] font-bold tabular-nums",
                      isOver && "text-red-600 dark:text-red-400",
                      isUnder && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {fmtVariance(entry.variance_value)}
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {fmtPct2(entry.percentage_of_theo_usage)}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </V1Card>
  );
}
