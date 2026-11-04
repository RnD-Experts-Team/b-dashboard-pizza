"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import {
  fmtColumnValue,
  fmtCurrency,
  fmtHours,
  fmtNumber,
  fmtPercent,
  preferredStat,
  type StatHint,
} from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { laborColor } from "@/components/business-reports/report-format";
import type { LaborColumnStats, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, TWO_DP } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Labor & Performance — the payroll/performance highlights for the range,
 *  with every imported metric column (sum/avg/min/max) in the dialog.
 * ────────────────────────────────────────────────────────────────────────── */

interface ColumnRow extends LaborColumnStats {
  key: string;
}

/** The stat the column is meant to be read by is bold; the others muted. */
function statClass(key: string, stat: Exclude<StatHint, "both">): string | undefined {
  const hint = preferredStat(key);
  return hint === "both" || hint === stat ? "font-semibold" : "text-muted-foreground";
}

function MetricsTable({ rows }: { rows: ColumnRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const columns = useMemo<PagedColumn<ColumnRow>[]>(
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

  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-60">
        <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search metrics…" className="h-7 ps-7 text-xs" />
      </div>
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">No metrics match “{query}”</p>
      ) : (
        <PagedTable key={query} rows={filtered} columns={columns} rowKey={(r) => r.key} initialSort="label" initialDir="asc" />
      )}
    </div>
  );
}

export function BrLaborPerformance({ data }: { data: LaborReport }) {
  const [open, setOpen] = useState(false);
  const { highlights: h, by_column } = data.combined.labor;
  const rows = useMemo<ColumnRow[]>(
    () => Object.entries(by_column).map(([key, stats]) => ({ ...stats, key })),
    [by_column],
  );
  const laborPct = h.average_labor_percent;

  return (
    <V1Card
      reportId="br-labor-performance"
      title="Labor & Performance"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      headerNote={rows.length > 0 ? `${rows.length} metrics` : undefined}
      onExpand={rows.length > 0 ? () => setOpen(true) : undefined}
    >
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        <V1Metric label="Total Hours" value={fmtHours(h.total_hours)} size="lg" />
        <V1Metric label="Avg Hourly Pay" value={fmtCurrency(h.average_hourly_pay)} size="lg" />
        <V1Metric label="Total Gross Pay" value={fmtCurrency(h.total_gross_pay, 0)} size="lg" />
        <V1Metric label="Avg Gross / Employee" value={fmtCurrency(h.average_gross_pay_per_employee, 0)} />
        <V1Metric
          label="Labor %"
          value={
            <span style={laborPct === null ? undefined : { color: laborColor(laborPct) }}>{fmtPercent(laborPct)}</span>
          }
        />
        <V1Metric label="Total Sales" value={fmtCurrency(h.total_sales, 0)} />
        <V1Metric label="Total Tips" value={fmtCurrency(h.total_tips, 0)} />
        <V1Metric label="Avg Performance" value={fmtNumber(h.average_performance_score, TWO_DP)} />
        <V1Metric label="Avg Final Score" value={fmtNumber(h.average_final_score, TWO_DP)} />
      </div>
      {rows.length === 0 && (
        <div className="mt-2 h-12">
          <V1Empty>No payroll metrics imported for this range</V1Empty>
        </div>
      )}

      {open && (
        <WbrDetailDialog open={open} onOpenChange={setOpen} title="All Labor Metrics" badgeText={`${rows.length} columns`}>
          <MetricsTable rows={rows} />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
