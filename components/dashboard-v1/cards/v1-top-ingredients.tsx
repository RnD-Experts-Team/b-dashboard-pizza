"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";
import type { TopIngredient } from "@/types/dspr.types";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Progress, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1TopIngredientsCard — ranked ingredient usage across 5-Used / Main / Paper
 *  tabs, with high/low variance toggle on the "5 Used" tab.
 *  Data shaping mirrors components/dspr/top-lists.tsx (TopIngredientsList).
 * ────────────────────────────────────────────────────────────────────────── */

const RANK_BADGE = [
  "bg-amber-500 text-white", // #1 gold
  "bg-slate-400 text-white", // #2 silver
  "bg-amber-700 text-white", // #3 bronze
  "bg-muted text-muted-foreground", // #4
  "bg-muted text-muted-foreground", // #5
];

type IngTab = "used" | "main" | "paper";

function formatVariance(variance?: number): string | null {
  if (variance == null || Number.isNaN(variance)) return null;
  return `${variance > 0 ? "+" : ""}${variance.toFixed(2)}`;
}

export function V1TopIngredientsCard({
  mainIngredients,
  paperIngredients,
  usedIngredients,
  highVarianceIngredients,
  lowVarianceIngredients,
  isLoading,
  span,
  className,
}: {
  mainIngredients?: TopIngredient[];
  paperIngredients?: TopIngredient[];
  usedIngredients?: TopIngredient[];
  highVarianceIngredients?: TopIngredient[];
  lowVarianceIngredients?: TopIngredient[];
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [tab, setTab] = useState<IngTab>("used");
  const [varianceMode, setVarianceMode] = useState<"high" | "low">("high");

  if (isLoading) return <WbrCardSkeleton className={className} />;

  const hasVarianceData = !!(highVarianceIngredients || lowVarianceIngredients);

  const data: TopIngredient[] =
    tab === "main"
      ? mainIngredients ?? []
      : tab === "paper"
        ? paperIngredients ?? []
        : hasVarianceData
          ? varianceMode === "high"
            ? highVarianceIngredients ?? []
            : lowVarianceIngredients ?? []
          : usedIngredients ?? [];

  if (
    !mainIngredients &&
    !paperIngredients &&
    !usedIngredients &&
    !hasVarianceData
  ) {
    return (
      <V1Card title="Top Ingredients" category="menu" period="D" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );
  }

  const maxUsage = Math.max(...data.map((i) => i?.actual_usage ?? 0), 1);

  return (
    <V1Card
      title="Top Ingredients"
      category="menu"
      period="D"
      span={span}
      className={className}
      headerControl={
        <V1Toggle<IngTab>
          options={[
            { value: "used", label: "5 Used" },
            { value: "main", label: "Main" },
            { value: "paper", label: "Paper" },
          ]}
          value={tab}
          onChange={setTab}
          className="ms-1"
        />
      }
    >
      <div className="space-y-2">
        {tab === "used" && hasVarianceData && (
          <div onClick={(e) => e.stopPropagation()}>
            <V1Toggle
              options={[
                { value: "high", label: "▲ High" },
                { value: "low", label: "▼ Low" },
              ]}
              value={varianceMode}
              onChange={setVarianceMode}
            />
          </div>
        )}

        {data.length === 0 ? (
          <V1Empty icon={Package}>No data available</V1Empty>
        ) : (
          <div className="space-y-1.5">
            {data.map((ing, idx) => {
              const usage = ing?.actual_usage ?? 0;
              const variance = formatVariance(ing?.variance_value);
              const negative = (ing?.variance_value ?? 0) < 0;
              return (
                <div key={ing?.ingredient_id ?? idx} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                          RANK_BADGE[idx] ?? RANK_BADGE[3],
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate text-[11px] font-medium">
                        {ing?.ingredient_description ?? "?"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11px] font-semibold tabular-nums">
                        {usage} units
                      </span>
                      {variance && (
                        <span
                          className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            negative
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400",
                          )}
                        >
                          {variance}
                        </span>
                      )}
                    </div>
                  </div>
                  <V1Progress value={usage} max={maxUsage} category="menu" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </V1Card>
  );
}
