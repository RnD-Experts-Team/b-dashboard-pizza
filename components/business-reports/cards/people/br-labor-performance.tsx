"use client";

import { useMemo, useState } from "react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import {
  fmtColumnValue,
  fmtCurrency,
  fmtHours,
  fmtNumber,
  preferredStat,
  type StatHint,
} from "@/components/labor/labor-format";
import { laborValue, useFinalLabor } from "@/components/business-reports/final-labor";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import type { LaborBlock, LaborColumnStats, LaborReport } from "@/types/business-reports.types";
import { LaborPctValue, NOT_HIRING_COLUMNS, ROW_CARD_HEIGHT, STORE_SCORE_COLUMNS, TWO_DP, fmtMoneyTile } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Labor & Performance — the payroll/performance highlights for the range,
 *  labor % as Hiring's FINAL labor where it exists (else derived, "Est."),
 *  with every imported metric column and the per-store highlights in the
 *  dialog.
 * ────────────────────────────────────────────────────────────────────────── */

interface ColumnRow extends LaborColumnStats {
  key: string;
}

interface StoreRow {
  store: string;
  h: LaborBlock["labor"]["highlights"];
  labor: { value: number | null; isFinal: boolean };
}

/** The stat the column is meant to be read by is bold; the others muted. */
function statClass(key: string, stat: Exclude<StatHint, "both">): string | undefined {
  const hint = preferredStat(key);
  return hint === "both" || hint === stat ? "font-semibold" : "text-muted-foreground";
}

const metricSearch = (r: ColumnRow) => `${r.label} ${r.key}`;

function PerformanceDialog({
  data,
  rows,
  labor,
  onClose,
}: {
  data: LaborReport;
  rows: ColumnRow[];
  labor: { value: number | null; isFinal: boolean };
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const final = useFinalLabor();
  const h = data.combined.labor.highlights;

  const metricColumns = useMemo<PagedColumn<ColumnRow>[]>(
    () => [
      { key: "label", header: "Metric", render: (r) => <span className="font-medium">{r.label}</span>, sortValue: (r) => r.label },
      { key: "sum", header: "Sum", numeric: true, render: (r) => <span className={statClass(r.key, "sum")}>{fmtColumnValue(r.key, r.sum)}</span>, sortValue: (r) => r.sum },
      { key: "avg", header: "Avg", numeric: true, render: (r) => <span className={statClass(r.key, "avg")}>{fmtColumnValue(r.key, r.avg)}</span>, sortValue: (r) => r.avg },
      { key: "min", header: "Min", numeric: true, render: (r) => fmtColumnValue(r.key, r.min), sortValue: (r) => r.min },
      { key: "max", header: "Max", numeric: true, render: (r) => fmtColumnValue(r.key, r.max), sortValue: (r) => r.max },
      { key: "count", header: "Readings", numeric: true, render: (r) => fmtNumber(r.count), sortValue: (r) => r.count },
    ],
    [],
  );

  const storeRows = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.by_store).map(([store, block]) => ({
        store,
        h: block.labor.highlights,
        labor: laborValue(final?.byStore.get(store)),
      })),
    [data.by_store, final],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (r) => <span className="font-medium">{storeName(r.store)}</span>, sortValue: (r) => storeName(r.store) },
      { key: "hours", header: "Hours", numeric: true, render: (r) => fmtHours(r.h.total_hours, 0), sortValue: (r) => r.h.total_hours },
      { key: "gross", header: "Gross Pay", numeric: true, render: (r) => fmtCurrency(r.h.total_gross_pay, 0), sortValue: (r) => r.h.total_gross_pay },
      { key: "hourly", header: "Avg Hourly", numeric: true, render: (r) => fmtCurrency(r.h.average_hourly_pay), sortValue: (r) => r.h.average_hourly_pay },
      {
        key: "labor",
        header: "Labor %",
        numeric: true,
        render: (r) => <LaborPctValue value={r.labor.value} isFinal={r.labor.isFinal} />,
        sortValue: (r) => r.labor.value,
      },
      { key: "tips", header: "Tips", numeric: true, render: (r) => fmtCurrency(r.h.total_tips, 0), sortValue: (r) => r.h.total_tips },
      { key: "perf", header: "Avg Perf.", numeric: true, render: (r) => fmtNumber(r.h.average_performance_score, TWO_DP), sortValue: (r) => r.h.average_performance_score },
      { key: "final", header: "Avg Final Score", numeric: true, render: (r) => fmtNumber(r.h.average_final_score, TWO_DP), sortValue: (r) => r.h.average_final_score },
    ],
    [storeName],
  );

  const stats: ReportStat[] = [
    { label: "Total hours", value: fmtHours(h.total_hours, 0) },
    { label: "Avg hourly pay", value: fmtCurrency(h.average_hourly_pay) },
    { label: "Total gross pay", value: fmtMoneyTile(h.total_gross_pay), sub: `${fmtCurrency(h.average_gross_pay_per_employee, 0)} / employee` },
    {
      label: "Final labor",
      value: <LaborPctValue value={labor.value} isFinal={labor.isFinal} tagClassName="text-[10px]" />,
    },
    { label: "Total tips", value: fmtMoneyTile(h.total_tips) },
    { label: "Avg performance", value: fmtNumber(h.average_performance_score, TWO_DP), sub: `final score ${fmtNumber(h.average_final_score, TWO_DP)}` },
  ];
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Labor & Performance"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "stores",
          label: `By store (${storeRows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={storeRows}
              columns={storeColumns}
              rowKey={(r) => r.store}
              initialSort="gross"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "metrics",
          label: `All metrics (${rows.length})`,
          content:
            rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payroll metrics imported for this range</p>
            ) : (
              <PagedTable
                size="lg"
                rows={rows}
                columns={metricColumns}
                rowKey={(r) => r.key}
                initialSort="label"
                initialDir="asc"
                searchText={metricSearch}
                searchPlaceholder="Search metrics…"
              />
            ),
        },
      ]}
    />
  );
}

export function BrLaborPerformance({ data }: { data: LaborReport }) {
  const [open, setOpen] = useState(false);
  const final = useFinalLabor();
  const { highlights: h, by_column } = data.combined.labor;
  const rows = useMemo<ColumnRow[]>(
    () =>
      Object.entries(by_column)
        .filter(([key]) => !NOT_HIRING_COLUMNS.has(key))
        .map(([key, stats]) => ({ ...stats, key, sum: STORE_SCORE_COLUMNS.has(key) ? null : stats.sum })),
    [by_column],
  );
  const labor = laborValue(final?.overall);

  return (
    <V1Card
      reportId="br-labor-performance"
      title="Labor & Performance"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      headerNote={rows.length > 0 ? `${rows.length} metrics` : undefined}
      onExpand={() => setOpen(true)}
    >
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        <V1Metric label="Total Hours" value={fmtHours(h.total_hours, 0)} size="lg" />
        <V1Metric label="Avg Hourly Pay" value={fmtCurrency(h.average_hourly_pay)} size="lg" />
        <V1Metric
          label="Total Gross Pay"
          value={<span title={fmtCurrency(h.total_gross_pay, 0)}>{fmtMoneyTile(h.total_gross_pay)}</span>}
          size="lg"
        />
        <V1Metric
          label="Avg Gross / Employee"
          value={<span title={fmtCurrency(h.average_gross_pay_per_employee, 0)}>{fmtMoneyTile(h.average_gross_pay_per_employee)}</span>}
        />
        <V1Metric
          label={"Final Labor"}
          value={<LaborPctValue value={labor.value} isFinal={labor.isFinal} />}
        />
        <V1Metric label="Total Tips" value={<span title={fmtCurrency(h.total_tips, 0)}>{fmtMoneyTile(h.total_tips)}</span>} />
        <V1Metric label="Avg Performance" value={fmtNumber(h.average_performance_score, TWO_DP)} />
        <V1Metric label="Avg Final Score" value={fmtNumber(h.average_final_score, TWO_DP)} />
      </div>
      {rows.length === 0 && (
        <div className="mt-2 h-12">
          <V1Empty>No payroll metrics imported for this range</V1Empty>
        </div>
      )}

      {open && <PerformanceDialog data={data} rows={rows} labor={labor} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
