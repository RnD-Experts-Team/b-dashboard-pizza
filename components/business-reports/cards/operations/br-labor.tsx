"use client";

import { useMemo, useState } from "react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { preferFinal, useFinalLabor, type FinalLabor } from "@/components/business-reports/final-labor";
import {
  LABOR_ZONES,
  fmt$,
  fmt$Compact,
  fmtPct,
  laborColor,
  laborLabel,
} from "@/components/business-reports/report-format";
import type { SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";
import {
  DialogNote,
  NO_VALUE,
  PpDelta,
  TrendChart,
  plural,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "./br-shared";

/** The labor gauge's scale (V1: 0–50%). */
const LABOR_SCALE = 50;
const TARGET_LOW = 19;
const TARGET_HIGH = 24;
const TARGET_GREEN = "#22C55E";
const TARGET_BAND = { from: TARGET_LOW, to: TARGET_HIGH, color: TARGET_GREEN };
const FINAL_COLOR = "#0ea5e9";

const fmtLaborAxis = (v: number): string => `${v.toFixed(1)}%`;
const onTarget = (v: number) => v >= TARGET_LOW && v <= TARGET_HIGH;

/** A labor % in its traffic-light colour, or "—". */
function LaborValue({ value, estimated = false }: { value: number | null | undefined; estimated?: boolean }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  return (
    <span className="font-semibold" style={{ color: laborColor(value) }}>
      {fmtPct(value)}
      {estimated && <span className="ms-1 text-xs font-normal text-muted-foreground">Est.</span>}
    </span>
  );
}

interface LaborWeekRow {
  week_start: string;
  /** Final labor %, or null when Hiring has none for the week. */
  final: number | null;
  /** Final when there is one, else the derived estimate. */
  shown: number;
  isFinal: boolean;
  prevShown: number | null;
  derived: number;
  laborCost: number;
}

interface LaborStoreRow extends StoreRow<SalesMetrics> {
  final: number | null;
  shown: number;
  isFinal: boolean;
}

function weekRows(weeks: SalesWeek[], final: FinalLabor | null): LaborWeekRow[] {
  const base = weeks.map((w) => {
    const f = final?.byWeek.get(w.week_start) ?? null;
    const { value, isFinal } = preferFinal(f, w.labor_percent);
    return { week_start: w.week_start, final: f, shown: value, isFinal, derived: w.labor_percent, laborCost: w.labor_cost };
  });
  return withPrev(base).map(({ row, prev }) => ({ ...row, prevShown: prev ? prev.shown : null }));
}

function LaborDialog({ sales, final, onClose }: { sales: SalesSection; final: FinalLabor | null; onClose: () => void }) {
  const labelOf = useWeekLabel(sales.by_week);
  const weeks = useMemo(() => weekRows(sales.by_week, final), [sales.by_week, final]);
  const base = useStoreRows(sales.by_store);
  const stores = useMemo<LaborStoreRow[]>(
    () =>
      base.map((r) => {
        const f = final?.byStore.get(r.store) ?? null;
        const { value, isFinal } = preferFinal(f, r.data.labor_percent);
        return { ...r, final: f, shown: value, isFinal };
      }),
    [base, final],
  );
  const focus = useStoreFocus<LaborStoreRow>();
  const overall = preferFinal(final?.overall, sales.totals.labor_percent);
  const finalWeeks = weeks.filter((w) => w.final !== null);
  const weeksOnTarget = finalWeeks.filter((w) => w.final !== null && onTarget(w.final)).length;
  const storesOnTarget = stores.filter((s) => onTarget(s.shown)).length;

  const categories = useMemo(() => weeks.map((w) => labelOf(w.week_start)), [weeks, labelOf]);
  const series = useMemo(
    () => [{ name: "Labor %", data: weeks.map((w) => Number(w.shown.toFixed(1))), color: FINAL_COLOR }],
    [weeks],
  );
  const barColors = useMemo(() => weeks.map((w) => laborColor(w.shown)), [weeks]);

  const weekColumns = useMemo<PagedColumn<LaborWeekRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week_start, render: (r) => labelOf(r.week_start) },
      { key: "final", header: "Final labor %", numeric: true, sortValue: (r) => r.shown, render: (r) => <LaborValue value={r.shown} estimated={!r.isFinal} /> },
      { key: "delta", header: "Δ vs prev. week", numeric: true, render: (r) => <PpDelta curr={r.shown} prev={r.prevShown} goodWhen="neutral" /> },
      { key: "status", header: "Status", sortValue: (r) => r.shown, render: (r) => laborLabel(r.shown) },
      { key: "cost", header: "Labor $", numeric: true, sortValue: (r) => r.laborCost, render: (r) => fmt$(r.laborCost) },
      { key: "derived", header: "Est. (labor ÷ sales)", numeric: true, sortValue: (r) => r.derived, render: (r) => fmtPct(r.derived) },
    ],
    [labelOf],
  );
  const storeColumns = useMemo<PagedColumn<LaborStoreRow>[]>(
    () => [
      { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
      { key: "final", header: "Final labor %", numeric: true, sortValue: (r) => r.shown, render: (r) => <LaborValue value={r.shown} estimated={!r.isFinal} /> },
      { key: "status", header: "Status", sortValue: (r) => r.shown, render: (r) => laborLabel(r.shown) },
      { key: "cost", header: "Labor $", numeric: true, sortValue: (r) => r.data.labor_cost, render: (r) => fmt$(r.data.labor_cost) },
      { key: "derived", header: "Est. (labor ÷ sales)", numeric: true, sortValue: (r) => r.data.labor_percent, render: (r) => fmtPct(r.data.labor_percent) },
    ],
    [],
  );

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock
          title="Final labor % by week"
          description="Hiring's final weekly labor; a week without one shows the estimate (labor ÷ sales). Green band = target 19–24%."
        >
          <TrendChart kind="bar" categories={categories} series={series} barColors={barColors} band={TARGET_BAND} format={fmtLaborAxis} />
        </ReportBlock>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: (
        <div className="space-y-2">
          <PagedTable size="lg" rows={weeks} columns={weekColumns} rowKey={(r) => r.week_start} initialSort="week" />
          {final === null && <DialogNote>Final labor is still loading; the estimates show until it arrives.</DialogNote>}
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={stores}
          columns={storeColumns}
          rowKey={(r) => r.store}
          initialSort="final"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Labor"
      category="operations"
      stats={[
        {
          label: overall.isFinal ? "Final labor %" : "Labor % (Est.)",
          value: <LaborValue value={overall.value} />,
          sub: laborLabel(overall.value),
        },
        { label: "Labor $", value: fmt$Compact(sales.totals.labor_cost), sub: fmt$(sales.totals.labor_cost) },
        { label: "Est. labor %", value: fmtPct(sales.totals.labor_percent), sub: "labor ÷ sales" },
        { label: "Weeks on target", value: `${weeksOnTarget}/${finalWeeks.length}`, sub: "final 19–24%" },
        { label: "Stores on target", value: `${storesOnTarget}/${stores.length}`, sub: plural(stores.length, "store") },
      ]}
      tabs={tabs}
    />
  );
}

/** Final labor % (Hiring) gauge; the derived labor ÷ sales stands in, marked "Est.", only while no final exists. */
export function BrLaborCard({ data }: { data: SalesSection }) {
  const final = useFinalLabor();
  const [open, setOpen] = useState(false);
  const { value, isFinal } = preferFinal(final?.overall, data.totals.labor_percent);
  const weeksWithFinal = final?.byWeek.size ?? 0;

  return (
    <V1Card
      reportId="br-labor"
      title="Labor"
      category="operations"
      period="R"
      span={1}
      headerNote={isFinal ? "Final" : "Est."}
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
    >
      <div className="flex flex-col">
        <div className="mx-auto w-full max-w-[260px]">
          <SpeedometerGauge
            value={value}
            max={LABOR_SCALE}
            zones={LABOR_ZONES}
            statusLabel={laborLabel(value)}
            statusColor="#DC2626"
            valueDisplay={fmtPct(value)}
          />
        </div>
        <p className="text-center text-[9px] font-medium text-muted-foreground">
          {isFinal && `Final labor, avg of ${plural(weeksWithFinal, "week")} · `}
          {!isFinal && (final === null ? "Est. (labor ÷ sales) · final loading · " : "Est. (labor ÷ sales) · no final yet · ")}
          Target <span className="font-semibold text-emerald-600 dark:text-emerald-400">19–24%</span>
        </p>
      </div>
      {open && <LaborDialog sales={data} final={final} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
