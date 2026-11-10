"use client";

import { useMemo, useState } from "react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useFinalLabor, type FinalLabor } from "@/components/business-reports/final-labor";
import {
  LABOR_ZONES,
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
const NO_FINAL_COLOR = "#94a3b8";

const fmtLaborAxis = (v: number): string => `${v.toFixed(1)}%`;
const onTarget = (v: number) => v >= TARGET_LOW && v <= TARGET_HIGH;

/** A labor % in its traffic-light colour, or "—". */
function LaborValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  return (
    <span className="font-semibold" style={{ color: laborColor(value) }}>
      {fmtPct(value)}
    </span>
  );
}

const statusOf = (v: number | null) => (v === null ? NO_VALUE : laborLabel(v));

interface LaborWeekRow {
  week_start: string;
  /** Final labor % (payroll ÷ royalty obligation), or null when the week has no payroll. */
  final: number | null;
  prevFinal: number | null;
}

interface LaborStoreRow extends StoreRow<SalesMetrics> {
  final: number | null;
}

function weekRows(weeks: SalesWeek[], final: FinalLabor | null): LaborWeekRow[] {
  const base = weeks.map((w) => ({ week_start: w.week_start, final: final?.byWeek.get(w.week_start) ?? null }));
  return withPrev(base).map(({ row, prev }) => ({ ...row, prevFinal: prev ? prev.final : null }));
}

function LaborDialog({ sales, final, onClose }: { sales: SalesSection; final: FinalLabor | null; onClose: () => void }) {
  const labelOf = useWeekLabel(sales.by_week);
  const weeks = useMemo(() => weekRows(sales.by_week, final), [sales.by_week, final]);
  const base = useStoreRows(sales.by_store);
  const stores = useMemo<LaborStoreRow[]>(
    () => base.map((r) => ({ ...r, final: final?.byStore.get(r.store) ?? null })),
    [base, final],
  );
  const focus = useStoreFocus<LaborStoreRow>();
  const overall = final?.overall ?? null;
  const finalWeeks = weeks.filter((w) => w.final !== null);
  const weeksOnTarget = finalWeeks.filter((w) => w.final !== null && onTarget(w.final)).length;
  const finalStores = stores.filter((s) => s.final !== null);
  const storesOnTarget = finalStores.filter((s) => s.final !== null && onTarget(s.final)).length;

  const categories = useMemo(() => weeks.map((w) => labelOf(w.week_start)), [weeks, labelOf]);
  const series = useMemo(
    () => [{ name: "Labor %", data: weeks.map((w) => (w.final === null ? 0 : Number(w.final.toFixed(1)))), color: FINAL_COLOR }],
    [weeks],
  );
  const barColors = useMemo(() => weeks.map((w) => (w.final === null ? NO_FINAL_COLOR : laborColor(w.final))), [weeks]);

  const weekColumns = useMemo<PagedColumn<LaborWeekRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week_start, render: (r) => labelOf(r.week_start) },
      { key: "final", header: "Final labor %", numeric: true, sortValue: (r) => r.final, render: (r) => <LaborValue value={r.final} /> },
      { key: "delta", header: "Δ vs prev. week", numeric: true, render: (r) => <PpDelta curr={r.final} prev={r.prevFinal} goodWhen="neutral" /> },
      { key: "status", header: "Status", sortValue: (r) => r.final, render: (r) => statusOf(r.final) },
    ],
    [labelOf],
  );
  const storeColumns = useMemo<PagedColumn<LaborStoreRow>[]>(
    () => [
      { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
      { key: "final", header: "Final labor %", numeric: true, sortValue: (r) => r.final, render: (r) => <LaborValue value={r.final} /> },
      { key: "status", header: "Status", sortValue: (r) => r.final, render: (r) => statusOf(r.final) },
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
          description="Total payroll ÷ royalty obligation × 100; a week without payroll is left out. Green band = target 19–24%."
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
          {final === null && <DialogNote>Final labor is still loading.</DialogNote>}
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
        { label: "Final labor %", value: <LaborValue value={overall} />, sub: statusOf(overall) },
        { label: "Weeks on target", value: `${weeksOnTarget}/${finalWeeks.length}`, sub: "final 19–24%" },
        { label: "Stores on target", value: `${storesOnTarget}/${finalStores.length}`, sub: plural(finalStores.length, "store") },
      ]}
      tabs={tabs}
    />
  );
}

/** Final labor % gauge: total payroll ÷ royalty obligation over the range's store-weeks with payroll. */
export function BrLaborCard({ data }: { data: SalesSection }) {
  const final = useFinalLabor();
  const [open, setOpen] = useState(false);
  const value = final?.overall ?? null;
  const weeksWithFinal = final?.byWeek.size ?? 0;

  return (
    <V1Card
      reportId="br-labor"
      title="Labor"
      category="operations"
      period="R"
      span={1}
      headerNote="Final"
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
    >
      <div className="flex flex-col">
        <div className="mx-auto w-full max-w-[260px]">
          <SpeedometerGauge
            value={value ?? 0}
            max={LABOR_SCALE}
            zones={LABOR_ZONES}
            statusLabel={statusOf(value)}
            statusColor="#DC2626"
            valueDisplay={value === null ? NO_VALUE : fmtPct(value)}
          />
        </div>
        <p className="text-center text-[9px] font-medium text-muted-foreground">
          {final === null && "Final labor loading · "}
          {final !== null && value === null && "No payroll for this range · "}
          {value !== null && `Payroll ÷ royalty, ${plural(weeksWithFinal, "week")} · `}
          Target <span className="font-semibold text-emerald-600 dark:text-emerald-400">19–24%</span>
        </p>
      </div>
      {open && <LaborDialog sales={data} final={final} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
