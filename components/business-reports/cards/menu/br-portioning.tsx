"use client";

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { fmt$2, fmt$Compact, fmtNum, fmtPct2 } from "@/components/business-reports/report-format";
import { BarList, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { MenuSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPortioningCard — V1 "Portioning" over the range: theoretical usage and
 *  each tracked ingredient's variance (positive = used more than theoretical,
 *  red; negative = less, green). Expand: the variance per ingredient ranked,
 *  and every store with one column per ingredient.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PORTIONING_SPAN: V1Span = 4;

/** Bar colours for over (red) / under (green) theoretical usage. */
const OVER_COLOR = CATEGORIES.finance.chartColors[0];
const UNDER_COLOR = CATEGORIES.sales.chartColors[0];

interface StoreRow {
  store: string;
  theo: number;
  variance: number;
  pct: Record<string, number>;
}


const sign = (n: number) => (n > 0 ? "+" : "");
const fmtVariance = (n: number) => `${sign(n)}${fmt$2(n)}`;
const fmtVarianceCompact = (n: number) => `${sign(n)}${fmt$Compact(n)}`;

function varianceClass(n: number): string | undefined {
  if (n > 0) return "text-red-600 dark:text-red-400";
  if (n < 0) return "text-emerald-600 dark:text-emerald-400";
  return undefined;
}

export function BrPortioningCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
  const { theo_usage, variance_breakdown } = data.portioning;

  return (
    <V1Card
      reportId="br-portioning"
      title="Portioning"
      category="menu"
      period="R"
      span={BR_PORTIONING_SPAN}
      onExpand={() => setOpen(true)}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="shrink-0 rounded-md bg-background/55 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Theoretical Usage</p>
          <p className="text-base font-bold tabular-nums">{fmt$2(theo_usage)}</p>
        </div>

        {variance_breakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center text-muted-foreground">
            <Scale className="h-5 w-5 opacity-50" />
            <p className="text-[11px]">No variance data in this range.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-4">
            {variance_breakdown.map((entry) => (
              <div
                key={entry.ingredient_id}
                className="min-w-0 rounded-md bg-background/45 px-2.5 py-2"
                title={`${entry.ingredient_description}: ${fmtVariance(entry.variance_value)} (${fmtPct2(entry.percentage_of_theo_usage)} of theoretical)`}
              >
                <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {entry.ingredient_description}
                </p>
                <p
                  className={cn(
                    "flex min-w-0 items-baseline gap-1.5 text-[13px] font-bold tabular-nums",
                    varianceClass(entry.variance_value),
                  )}
                >
                  <span className="truncate">{fmtVarianceCompact(entry.variance_value)}</span>
                  <span className="shrink-0 text-[9px] font-medium text-muted-foreground">
                    {fmtPct2(entry.percentage_of_theo_usage)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && <PortioningDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function PortioningDialog({ data, onClose }: { data: MenuSection; onClose: () => void }) {
  const { storeName, focusStore } = useReport();
  const { theo_usage, variance_breakdown, by_store } = data.portioning;

  const rows = useMemo<StoreRow[]>(
    () =>
      Object.entries(by_store).map(([store, b]) => ({
        store,
        theo: b.theo_usage,
        variance: b.variance_breakdown.reduce((s, v) => s + v.variance_value, 0),
        pct: Object.fromEntries(b.variance_breakdown.map((v) => [v.ingredient_id, v.percentage_of_theo_usage])),
      })),
    [by_store],
  );

  const bars = useMemo<BarRow[]>(
    () =>
      [...variance_breakdown]
        .sort((a, b) => b.variance_value - a.variance_value)
        .map((v) => ({
          key: v.ingredient_id,
          label: v.ingredient_description,
          value: v.variance_value,
          display: fmtVariance(v.variance_value),
          sub: `${fmtPct2(v.percentage_of_theo_usage)} of theoretical`,
          color: v.variance_value > 0 ? OVER_COLOR : UNDER_COLOR,
          tone: varianceClass(v.variance_value),
        })),
    [variance_breakdown],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "theo", header: "Theo usage", numeric: true, sortValue: (r) => r.theo, render: (r) => fmt$2(r.theo) },
      {
        key: "variance",
        header: "Net variance",
        numeric: true,
        sortValue: (r) => r.variance,
        render: (r) => <span className={cn("font-semibold", varianceClass(r.variance))}>{fmtVariance(r.variance)}</span>,
      },
      ...variance_breakdown.map<PagedColumn<StoreRow>>((ing) => ({
        key: `ing-${ing.ingredient_id}`,
        header: ing.ingredient_description,
        numeric: true,
        sortValue: (r) => r.pct[ing.ingredient_id] ?? null,
        render: (r) => {
          const v = r.pct[ing.ingredient_id];
          if (v === undefined) return <span className="text-muted-foreground">—</span>;
          return <span className={cn("font-medium", varianceClass(v))}>{fmtPct2(v)}</span>;
        },
      })),
    ],
    [variance_breakdown, storeName],
  );

  const net = variance_breakdown.reduce((s, v) => s + v.variance_value, 0);
  const worst = bars[0];
  const best = bars[bars.length - 1];
  const stats: ReportStat[] = [
    { label: "Theoretical usage", value: fmt$2(theo_usage) },
    { label: "Net variance", value: fmtVariance(net), tone: varianceClass(net) },
    { label: "Ingredients tracked", value: fmtNum(variance_breakdown.length) },
    {
      label: "Most over",
      value: worst && worst.value > 0 ? fmtVariance(worst.value) : "—",
      sub: worst && worst.value > 0 ? String(worst.label) : undefined,
      tone: varianceClass(worst?.value ?? 0),
    },
    {
      label: "Most under",
      value: best && best.value < 0 ? fmtVariance(best.value) : "—",
      sub: best && best.value < 0 ? String(best.label) : undefined,
      tone: varianceClass(best?.value ?? 0),
    },
    { label: "Stores", value: fmtNum(rows.length) },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Variance by ingredient" description="Positive (red) = used more than theoretical; negative (green) = less">
          <BarList rows={bars} color={OVER_COLOR} empty="No variance data in this range" />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store" description="Ingredient columns = variance as % of theoretical usage">
          <PagedTable
            size="lg"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.store}
            initialSort="theo"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
            onRowClick={(r) => focusStore(r.store)}
            footerNote="click a row to focus the store"
          />
        </ReportBlock>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Portioning"
      category="menu"
      stats={stats}
      tabs={tabs}
    />
  );
}

