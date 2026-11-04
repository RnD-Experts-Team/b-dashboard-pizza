"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { fmtCurrency, fmtHours, fmtNumber, fmtPercent } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { cn } from "@/lib/utils";
import type { LaborBlock, LaborReport } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  Labor Summary — the Labor report's KPI strip as V1 tiles, for every
 *  loaded store over the range. Expanding shows the same figures per store.
 * ────────────────────────────────────────────────────────────────────────── */

const AMBER = "text-amber-600 dark:text-amber-400";
const ROSE = "text-rose-600 dark:text-rose-400";
const EMERALD = "text-emerald-600 dark:text-emerald-400";

interface StoreRow {
  store: string;
  block: LaborBlock;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtNumber(n)}`;
}

function netAccent(n: number): string | undefined {
  if (n > 0) return EMERALD;
  if (n < 0) return ROSE;
  return undefined;
}

export function BrLaborSummary({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const [open, setOpen] = useState(false);
  const s = data.combined.summary;
  const net = s.headcount_end - s.headcount_start;

  const rows = useMemo<StoreRow[]>(
    () => Object.entries(data.by_store).map(([store, block]) => ({ store, block })),
    [data.by_store],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
        sortValue: (r) => storeName(r.store),
      },
      {
        key: "start",
        header: "Start",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.headcount_start),
        sortValue: (r) => r.block.summary.headcount_start,
      },
      {
        key: "end",
        header: "End",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.headcount_end),
        sortValue: (r) => r.block.summary.headcount_end,
      },
      {
        key: "net",
        header: "Net",
        numeric: true,
        render: (r) => {
          const n = r.block.summary.headcount_end - r.block.summary.headcount_start;
          return <span className={netAccent(n)}>{signed(n)}</span>;
        },
        sortValue: (r) => r.block.summary.headcount_end - r.block.summary.headcount_start,
      },
      {
        key: "hires",
        header: "Hires",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.new_hires),
        sortValue: (r) => r.block.summary.new_hires,
      },
      {
        key: "seps",
        header: "Separations",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.separations),
        sortValue: (r) => r.block.summary.separations,
      },
      {
        key: "notable",
        header: "Notable",
        numeric: true,
        render: (r) => (
          <span className={cn(r.block.summary.notable_departures > 0 && AMBER)}>
            {fmtNumber(r.block.summary.notable_departures)}
          </span>
        ),
        sortValue: (r) => r.block.summary.notable_departures,
      },
      {
        key: "turnover",
        header: "Turnover",
        numeric: true,
        render: (r) => fmtPercent(r.block.summary.turnover_rate_percent),
        sortValue: (r) => r.block.summary.turnover_rate_percent,
      },
      {
        key: "gross",
        header: "Avg Wk Gross",
        numeric: true,
        render: (r) => fmtCurrency(r.block.summary.avg_weekly_gross_pay, 0),
        sortValue: (r) => r.block.summary.avg_weekly_gross_pay,
      },
      {
        key: "hours",
        header: "Avg Wk Hours",
        numeric: true,
        render: (r) => fmtHours(r.block.summary.avg_weekly_hours),
        sortValue: (r) => r.block.summary.avg_weekly_hours,
      },
      {
        key: "o40",
        header: "Wks >40h",
        numeric: true,
        render: (r) => fmtNumber(r.block.summary.employee_weeks_over_40),
        sortValue: (r) => r.block.summary.employee_weeks_over_40,
      },
      {
        key: "o60",
        header: "Wks >60h",
        numeric: true,
        render: (r) => (
          <span className={cn(r.block.summary.employee_weeks_over_60 > 0 && ROSE)}>
            {fmtNumber(r.block.summary.employee_weeks_over_60)}
          </span>
        ),
        sortValue: (r) => r.block.summary.employee_weeks_over_60,
      },
    ],
    [storeName],
  );

  const multiStore = rows.length > 1;

  return (
    <V1Card
      reportId="br-labor-summary"
      title="Labor Summary"
      category="people"
      period="R"
      span={4}
      className="h-auto"
      headerNote={multiStore ? `${rows.length} stores · click for per-store` : undefined}
      onExpand={multiStore ? () => setOpen(true) : undefined}
    >
      <div className="grid grid-cols-2 gap-1 pb-0.5 sm:grid-cols-3 lg:grid-cols-9">
        <V1Metric
          label="Headcount"
          value={
            <span className="inline-flex items-center gap-1">
              {fmtNumber(s.headcount_start)}
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              {fmtNumber(s.headcount_end)}
            </span>
          }
          sub={<span className={netAccent(net)}>{signed(net)} net</span>}
        />
        <V1Metric label="New Hires" value={fmtNumber(s.new_hires)} accent={s.new_hires > 0 ? EMERALD : undefined} />
        <V1Metric label="Separations" value={fmtNumber(s.separations)} accent={s.separations > 0 ? ROSE : undefined} />
        <V1Metric
          label="Notable Departures"
          value={fmtNumber(s.notable_departures)}
          sub={s.notable_departures > 0 ? "above-avg performers" : "none"}
          accent={s.notable_departures > 0 ? AMBER : undefined}
        />
        <V1Metric label="Turnover Rate" value={fmtPercent(s.turnover_rate_percent)} />
        <V1Metric label="Avg Weekly Gross" value={fmtCurrency(s.avg_weekly_gross_pay, 0)} />
        <V1Metric label="Avg Weekly Hours" value={fmtHours(s.avg_weekly_hours)} />
        <V1Metric label="Emp-Weeks > 40h" value={fmtNumber(s.employee_weeks_over_40)} />
        <V1Metric
          label="Emp-Weeks > 60h"
          value={fmtNumber(s.employee_weeks_over_60)}
          accent={s.employee_weeks_over_60 > 0 ? ROSE : undefined}
        />
      </div>

      {open && (
        <WbrDetailDialog open={open} onOpenChange={setOpen} title="Labor by Store" badgeText={`${rows.length} stores`} className="sm:max-w-6xl">
          <PagedTable rows={rows} columns={columns} rowKey={(r) => r.store} initialSort="end" />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
