"use client";

import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { DASH } from "@/components/labor/labor-format";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$, fmtNum, fmtPct, laborColor } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { ReportWeek, SalesSection, StoreWeekCompact } from "@/types/business-reports.types";
import { GRID_TD, StoreWeekGrid } from "./br-store-week-grid";

/* ──────────────────────────────────────────────────────────────────────────
 *  Weekly Sales by Store — a stores × weeks heat grid of sales, labor % or
 *  guests. Sales/guests tint by size (the store's best week is outlined);
 *  labor % uses V1's labor colour bands.
 * ────────────────────────────────────────────────────────────────────────── */

type Metric = "sales" | "labor" | "guests";

const CARD_HEIGHT = 460;
/** Strongest tint for the biggest cell, in %. */
const MAX_TINT = 45;
const MIN_TINT = 4;
const LABOR_TINT = 22;
const SALES_COLOR = CATEGORIES.sales.chartColors[0];

interface MetricDef {
  label: string;
  value: (c: StoreWeekCompact) => number | null;
  format: (v: number) => string;
  total: string;
}

const METRICS: Record<Metric, MetricDef> = {
  sales: { label: "Sales", value: (c) => c.sales, format: (v) => fmt$(v), total: "Range" },
  labor: {
    label: "Labor %",
    value: (c) => (c.sales > 0 ? c.labor_percent : null),
    format: (v) => fmtPct(v),
    total: "Range",
  },
  guests: { label: "Guests", value: (c) => c.customer_count, format: (v) => fmtNum(v), total: "Range" },
};

function tintFor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(percent)}%, transparent)`;
}

export function BrWeeklySalesByStore({ data }: { data: SalesSection }) {
  const { params, storeName } = useReport();
  const [metric, setMetric] = useState<Metric>("sales");
  const def = METRICS[metric];
  const weeks = data.meta.weeks;

  /* Stores ordered by range sales (best first); stores with no row last. */
  const stores = useMemo(
    () => [...params.stores].sort((a, b) => (data.by_store[b]?.sales ?? -1) - (data.by_store[a]?.sales ?? -1)),
    [params.stores, data.by_store],
  );

  /* Per-metric max over every cell (tint scale) and each store's best week. */
  const scale = useMemo(() => {
    const cells = stores.flatMap((s) =>
      weeks.map((w) => {
        const c = data.by_store_week[s]?.[w.week_start];
        return { store: s, week: w.week_start, value: c ? def.value(c) : null };
      }),
    );
    const max = cells.reduce((m, c) => (c.value !== null && c.value > m ? c.value : m), 0);
    const best = cells.reduce<Record<string, { week: string; value: number }>>((acc, c) => {
      if (c.value === null || c.value <= 0) return acc;
      const prev = acc[c.store];
      return prev && prev.value >= c.value ? acc : { ...acc, [c.store]: { week: c.week, value: c.value } };
    }, {});
    return { max, best };
  }, [stores, weeks, data.by_store_week, def]);

  const renderCell = (store: string, week: ReportWeek) => {
    const compact = data.by_store_week[store]?.[week.week_start];
    const value = compact ? def.value(compact) : null;
    if (value === null) {
      return (
        <td key={week.week_start} className={cn(GRID_TD, "text-muted-foreground/60")}>
          {DASH}
        </td>
      );
    }
    const isLabor = metric === "labor";
    const background = isLabor
      ? tintFor(laborColor(value), LABOR_TINT)
      : tintFor(SALES_COLOR, scale.max > 0 ? MIN_TINT + (value / scale.max) * (MAX_TINT - MIN_TINT) : MIN_TINT);
    const isBest = !isLabor && scale.best[store]?.week === week.week_start;
    return (
      <td
        key={week.week_start}
        className={cn(GRID_TD, "font-medium", isBest && "outline-1 -outline-offset-2 outline-emerald-500")}
        style={{ backgroundColor: background }}
        title={`${storeName(store)} · ${week.start} → ${week.end}${isBest ? " · best week" : ""}`}
      >
        {def.format(value)}
      </td>
    );
  };

  const renderTotal = (store: string) => {
    const m = data.by_store[store];
    if (!m || m.store_days === 0) return DASH;
    if (metric === "sales") return fmt$(m.sales);
    if (metric === "guests") return fmtNum(m.customer_count);
    return m.sales > 0 ? <span style={{ color: laborColor(m.labor_percent) }}>{fmtPct(m.labor_percent)}</span> : DASH;
  };

  const renderRowHead = (store: string) => <span className="block truncate font-medium">{storeName(store)}</span>;

  return (
    <V1Card
      reportId="br-weekly-sales-by-store"
      title="Weekly Sales by Store"
      category="sales"
      period="R"
      span={4}
      height={CARD_HEIGHT}
      headerControl={
        <V1Toggle<Metric>
          className="ms-1.5"
          options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].label }))}
          value={metric}
          onChange={setMetric}
        />
      }
      headerNote={metric === "labor" ? "coloured by labor band" : "darker = higher"}
    >
      {weeks.length === 0 || stores.length === 0 ? (
        <V1Empty icon={CalendarRange}>No weekly sales in this range</V1Empty>
      ) : (
        <StoreWeekGrid
          stores={stores}
          weeks={weeks}
          firstColLabel="Store"
          renderRowHead={renderRowHead}
          renderCell={renderCell}
          tail={{ header: def.total, render: renderTotal }}
          note={metric === "labor" ? "labor % = labor cost ÷ sales" : "outlined = the store's best week"}
        />
      )}
    </V1Card>
  );
}
