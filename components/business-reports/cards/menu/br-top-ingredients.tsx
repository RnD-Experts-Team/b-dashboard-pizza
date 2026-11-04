"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { fmt$2, fmtNumD } from "@/components/business-reports/report-format";
import type { IngredientRow, MenuSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrTopIngredientsCard — V1 "Top Ingredients" over the range: highest and
 *  lowest variance, main and paper ingredients, each with actual usage and
 *  the signed variance in dollars (negative red, positive green, as in V1).
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_TOP_INGREDIENTS_SPAN: V1Span = 1;

type IngTab = "high" | "low" | "main" | "paper";

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";
const USAGE_DECIMALS = 2;

const TAB_OPTIONS: { value: IngTab; label: string }[] = [
  { value: "high", label: "▲ High" },
  { value: "low", label: "▼ Low" },
  { value: "main", label: "Main" },
  { value: "paper", label: "Paper" },
];

const TAB_ROWS: Record<IngTab, (d: MenuSection) => IngredientRow[]> = {
  high: (d) => d.ingredients.variance_high,
  low: (d) => d.ingredients.variance_low,
  main: (d) => d.ingredients.main,
  paper: (d) => d.ingredients.paper,
};

function fmtVariance(v: number): string {
  return `${v > 0 ? "+" : ""}${fmt$2(v)}`;
}

export function BrTopIngredientsCard({ data }: { data: MenuSection }) {
  const [tab, setTab] = useState<IngTab>("high");
  const rows = TAB_ROWS[tab](data);

  return (
    <V1Card
      reportId="br-top-ingredients"
      title="Top Ingredients"
      category="menu"
      period="R"
      span={BR_TOP_INGREDIENTS_SPAN}
      showPeriodBadge={false}
      headerControl={<V1Toggle<IngTab> className="ms-1" options={TAB_OPTIONS} value={tab} onChange={setTab} />}
    >
      {rows.length === 0 ? (
        <V1Empty icon={Package}>No ingredient counts in this range</V1Empty>
      ) : (
        <div className="space-y-1.5">
          {rows.map((ing, idx) => (
            <div key={ing.ingredient_id} className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                    RANK_BADGE[idx] ?? RANK_REST,
                  )}
                >
                  {idx + 1}
                </span>
                <span className="truncate text-[13px] font-medium" title={ing.ingredient_description}>
                  {ing.ingredient_description}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[12px] font-semibold tabular-nums">
                  {fmtNumD(ing.actual_usage, USAGE_DECIMALS)} units
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    ing.variance_value < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400",
                  )}
                >
                  {fmtVariance(ing.variance_value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </V1Card>
  );
}
