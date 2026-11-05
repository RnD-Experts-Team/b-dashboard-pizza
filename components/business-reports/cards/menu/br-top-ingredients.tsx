"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";
import {
  RD_NUM,
  RD_TBL,
  RD_TD,
  RD_TH,
  ReportBlock,
  ReportDialog,
  type ReportStat,
} from "@/components/business-reports/report-dialog";
import { fmt$2, fmt$Compact, fmtNum, fmtNumD } from "@/components/business-reports/report-format";
import type { IngredientRow, MenuSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrTopIngredientsCard — V1 "Top Ingredients" over the range: highest and
 *  lowest variance, main and paper ingredients, each with actual usage and
 *  the signed variance in dollars (negative red, positive green, as in V1).
 *  Expand: the four lists side by side, readable, with exact figures.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_TOP_INGREDIENTS_SPAN: V1Span = 1;

type IngTab = "high" | "low" | "main" | "paper";

const RANK_BADGE = ["bg-amber-500 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"];
const RANK_REST = "bg-muted text-muted-foreground";
const USAGE_DECIMALS = 2;
const NEGATIVE = "text-red-600 dark:text-red-400";
const POSITIVE = "text-green-600 dark:text-green-400";

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

const LIST_TITLES: Record<IngTab, { title: string; description: string }> = {
  high: { title: "Highest variance", description: "Variance in dollars, highest first" },
  low: { title: "Lowest variance", description: "Variance in dollars, lowest first" },
  main: { title: "Main ingredients", description: "Actual usage and variance in dollars" },
  paper: { title: "Paper", description: "Actual usage and variance in dollars" },
};

const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const sign = (v: number) => (v > 0 ? "+" : "");
const fmtVariance = (v: number) => `${sign(v)}${fmt$2(v)}`;
const fmtVarianceCompact = (v: number) => `${sign(v)}${fmt$Compact(v)}`;
const varianceTone = (v: number) => (v < 0 ? NEGATIVE : POSITIVE);

export function BrTopIngredientsCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
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
      onExpand={() => setOpen(true)}
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
              <div
                className="flex shrink-0 items-center gap-1.5"
                title={`${fmtNumD(ing.actual_usage, USAGE_DECIMALS)} units · ${fmtVariance(ing.variance_value)}`}
              >
                <span className="text-[12px] font-semibold tabular-nums">{compactNum.format(ing.actual_usage)} u</span>
                <span className={cn("text-[10px] font-semibold tabular-nums", varianceTone(ing.variance_value))}>
                  {fmtVarianceCompact(ing.variance_value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <IngredientsDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function IngredientTable({ rows }: { rows: IngredientRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No ingredient counts in this range</p>;
  return (
    <table className={RD_TBL}>
      <thead>
        <tr>
          <th className={cn(RD_TH, "w-10")}>#</th>
          <th className={RD_TH}>Ingredient</th>
          <th className={cn(RD_TH, RD_NUM)}>Actual usage</th>
          <th className={cn(RD_TH, RD_NUM)}>Variance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((ing, idx) => (
          <tr key={ing.ingredient_id}>
            <td className={cn(RD_TD, "text-muted-foreground")}>{idx + 1}</td>
            <td className={cn(RD_TD, "whitespace-normal font-medium")}>{ing.ingredient_description}</td>
            <td className={cn(RD_TD, RD_NUM)}>{fmtNumD(ing.actual_usage, USAGE_DECIMALS)}</td>
            <td className={cn(RD_TD, RD_NUM, "font-semibold", varianceTone(ing.variance_value))}>
              {fmtVariance(ing.variance_value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListBlock({ data, list }: { data: MenuSection; list: IngTab }) {
  return (
    <ReportBlock title={LIST_TITLES[list].title} description={LIST_TITLES[list].description}>
      <IngredientTable rows={TAB_ROWS[list](data)} />
    </ReportBlock>
  );
}

function IngredientsDialog({ data, onClose }: { data: MenuSection; onClose: () => void }) {
  const ing = data.ingredients;
  const high = ing.variance_high[0];
  const low = ing.variance_low[0];
  const netOf = (rows: IngredientRow[]) => rows.reduce((s, r) => s + r.variance_value, 0);

  const stats: ReportStat[] = [
    {
      label: "Highest variance",
      value: high ? fmtVariance(high.variance_value) : "—",
      sub: high?.ingredient_description,
      tone: high ? varianceTone(high.variance_value) : undefined,
    },
    {
      label: "Lowest variance",
      value: low ? fmtVariance(low.variance_value) : "—",
      sub: low?.ingredient_description,
      tone: low ? varianceTone(low.variance_value) : undefined,
    },
    { label: "Main · net variance", value: fmtVariance(netOf(ing.main)), sub: `${fmtNum(ing.main.length)} ingredients`, tone: varianceTone(netOf(ing.main)) },
    { label: "Paper · net variance", value: fmtVariance(netOf(ing.paper)), sub: `${fmtNum(ing.paper.length)} items`, tone: varianceTone(netOf(ing.paper)) },
  ];

  const tabs = [
    {
      key: "variance",
      label: "Variance",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListBlock data={data} list="high" />
          <ListBlock data={data} list="low" />
        </div>
      ),
    },
    {
      key: "usage",
      label: "Main & paper",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListBlock data={data} list="main" />
          <ListBlock data={data} list="paper" />
        </div>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Top Ingredients"
      category="menu"
      stats={stats}
      tabs={tabs}
    />
  );
}
