"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopMenuItem, TopIngredient } from "@/types/dspr.types";
import { Pizza, Package, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Top 5 Menu Items
// ============================================================================

interface TopItemsListProps {
  items: TopMenuItem[];
  title?: string;
  className?: string;
}

const rankColors = [
  "bg-amber-500 text-white",     // #1 gold
  "bg-slate-400 text-white",     // #2 silver
  "bg-amber-700 text-white",     // #3 bronze
  "bg-muted text-muted-foreground", // #4
  "bg-muted text-muted-foreground", // #5
];

export function TopItemsList({
  items,
  title = "Top 5 Menu Items",
  className,
}: TopItemsListProps) {
  // Find the max gross_sales to compute relative bar widths
  const maxSales = Math.max(...items.map((i) => i.gross_sales), 1);

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0", className)}>
      <CardHeader className="pb-0.5 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-orange-500/15 dark:bg-orange-500/20">
            <Pizza className="h-3 w-3 text-orange-500" />
          </div>
          {title}
          <Badge variant="secondary" className="ms-auto text-[8px] font-mono px-1 py-0">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 px-3 pb-1">
        {items.map((item, idx) => {
          const barWidth = (item.gross_sales / maxSales) * 100;
          return (
            <div
              key={item.item_id}
              className="group/item relative rounded p-1 mb-1 hover:bg-muted/50 transition-colors"
            >
              {/* Background bar */}
              <div className="absolute inset-y-0 left-0 rounded-md bg-orange-500/5 dark:bg-orange-500/10 transition-all"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                      rankColors[idx] ?? rankColors[3]
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-[11px] font-medium truncate">
                    {item.menu_item_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-[8px] font-mono px-1 py-0 h-3.5"
                  >
                    {item.quantity_sold} sold
                  </Badge>
                  <span className="text-[11px] font-bold tabular-nums min-w-15 text-end">
                    ${item.gross_sales.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-5 text-center gap-1.5">
            <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Top 3 Ingredients
// ============================================================================

interface TopIngredientsListProps {
  ingredients?: TopIngredient[];
  /** explicit datasets for the three tabs */
  mainIngredients?: TopIngredient[];
  paperIngredients?: TopIngredient[];
  usedIngredients?: TopIngredient[];
  title?: string;
  className?: string;
}

export function TopIngredientsList({
  ingredients = [],
  mainIngredients,
  paperIngredients,
  usedIngredients,
  title = "Top Ingredients Used",
  className,
}: TopIngredientsListProps) {
  const [tab, setTab] = useState<"used" | "paper" | "main">("used");

  const data: TopIngredient[] =
    tab === "main"
      ? mainIngredients ?? ingredients
      : tab === "paper"
      ? paperIngredients ?? ingredients
      : usedIngredients ?? ingredients;

  const maxUsage = Math.max(...(data.map((i) => i?.actual_usage ?? 0) ?? [0]), 1);

  const formatVariance = (variance?: number) => {
    if (variance == null || Number.isNaN(variance)) return null;

    return `${variance > 0 ? "+" : ""}${variance.toFixed(2)}`;
  };

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0", className)}>
      <CardHeader className="pb-0.5 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-blue-500/15 dark:bg-blue-500/20">
            <Package className="h-3 w-3 text-blue-500" />
          </div>
          {/* {title} */} Top Ingredients

          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTab("used")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded cursor-pointer",
                tab === "used"
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground"
              )}
            >
               Three Used 
            </button>
            <button
              type="button"
              onClick={() => setTab("main")}
              className={cn(
                "text-[10px] px-3 py-0.5 rounded cursor-pointer",
                tab === "main"
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground"
              )}
            >
              Main 
            </button>
            <button
              type="button"
              onClick={() => setTab("paper")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded cursor-pointer",
                tab === "paper"
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground"
              )}
            >
              Paper
            </button>
            
            {/* <Badge variant="secondary" className="text-[8px] font-mono px-1 py-0">
              {data.length}
            </Badge> */}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 px-3 pb-1">
        {data.map((ing, idx) => {
          const actualUsage = ing?.actual_usage ?? 0;
          const barWidth = (actualUsage / maxUsage) * 100;
          return (
            <div
              key={ing?.ingredient_id ?? idx}
              className="relative rounded p-1 mb-1 hover:bg-muted/50 transition-colors"
            >
              {/* Background bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-blue-500/5 dark:bg-blue-500/10 transition-all"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                      rankColors[idx] ?? rankColors[3]
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-[11px] font-medium truncate">
                    {ing?.ingredient_description ?? "?"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-[8px] font-mono px-1 py-0 h-3.5"
                  >
                    {(ing?.actual_usage ?? "?").toString()} units
                  </Badge>
                  {formatVariance(ing?.variance_value) && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[8px] font-mono px-1 py-0 h-3.5",
                        (ing?.variance_value ?? 0) < 0
                          ? "text-red-600 dark:text-red-400 border-red-300 dark:border-red-800"
                          : "text-green-600 dark:text-green-400 border-green-300 dark:border-green-800"
                      )}
                    >
                      {formatVariance(ing?.variance_value)} var
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-5 text-center gap-1.5">
            <Package className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
