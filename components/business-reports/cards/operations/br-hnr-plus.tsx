"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1SubLabel, V1_NUM, V1_TBL, V1_TD, V1_TH } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { HnrPlusTotals, OperationsSection } from "@/types/business-reports.types";
import { scoreColor, useStoreFocus, useStoreRows, useWeekLabels, type StoreRow } from "./br-shared";

interface Measure {
  key: string;
  label: string;
  pct: (t: HnrPlusTotals) => number;
  score: (t: HnrPlusTotals) => number;
}

const MEASURES: Measure[] = [
  { key: "sold", label: "Sold", pct: (t) => t.sold_percent, score: (t) => t.sold_score },
  { key: "void", label: "Void", pct: (t) => t.void_percent, score: (t) => t.void_score },
  { key: "waste", label: "Waste", pct: (t) => t.waste_percent, score: (t) => t.waste_score },
  { key: "variance", label: "Variance", pct: (t) => t.variance_percent, score: (t) => t.variance_score },
  { key: "noinv", label: "No Inventory", pct: (t) => t.no_inventory_percent, score: (t) => t.no_inventory_score },
];

function fmtVariance(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtNum(n)}`;
}

function Score({ value }: { value: number }) {
  return <span className={cn("font-semibold", scoreColor(value))}>{fmtNum(value)}</span>;
}

/** Total score, Made, then each measure as "% (score)" — shared by the store and week tables. */
function scoreColumns<T>(get: (row: T) => HnrPlusTotals): PagedColumn<T>[] {
  return [
    { key: "total", header: "Total", numeric: true, sortValue: (r) => get(r).total_score, render: (r) => <Score value={get(r).total_score} /> },
    { key: "made", header: "Made", numeric: true, sortValue: (r) => get(r).made, render: (r) => fmtNum(get(r).made) },
    ...MEASURES.map<PagedColumn<T>>((m) => ({
      key: m.key,
      header: m.label,
      numeric: true,
      sortValue: (r) => m.score(get(r)),
      render: (r) => (
        <span className="whitespace-nowrap">
          {fmtPct(m.pct(get(r)))} <span className="text-[10px] text-muted-foreground">·</span> <Score value={m.score(get(r))} />
        </span>
      ),
    })),
  ];
}

type StoreScoreRow = StoreRow<HnrPlusTotals>;
type WeekScoreRow = { week_start: string; label: string } & HnrPlusTotals;

const STORE_COLUMNS: PagedColumn<StoreScoreRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...scoreColumns<StoreScoreRow>((r) => r.data),
];

const WEEK_COLUMNS: PagedColumn<WeekScoreRow>[] = [
  { key: "week", header: "Week", sortValue: (r) => r.week_start, render: (r) => r.label, className: "whitespace-nowrap" },
  ...scoreColumns<WeekScoreRow>((r) => r),
];

function HnrPlusDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const stores = useStoreRows(data.hnr_plus.by_store);
  const focus = useStoreFocus<StoreScoreRow>();
  const labelOf = useWeekLabels(data.meta.weeks);
  const weeks = useMemo<WeekScoreRow[]>(
    () => data.hnr_plus.by_week.map((w) => ({ ...w, label: labelOf(w.week_start) })),
    [data.hnr_plus.by_week, labelOf],
  );
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="HNR+ Scores" badgeText="By store · By week · % · score">
      <div className="space-y-5">
        <div>
          <V1SubLabel className="mb-1">By store</V1SubLabel>
          <PagedTable
            rows={stores}
            columns={STORE_COLUMNS}
            rowKey={(r) => r.store}
            initialSort="total"
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        </div>
        <div>
          <V1SubLabel className="mb-1">By week</V1SubLabel>
          <PagedTable rows={weeks} columns={WEEK_COLUMNS} rowKey={(r) => r.week_start} initialSort="week" />
        </div>
      </div>
    </WbrDetailDialog>
  );
}

/** HNR+ production / waste / variance scorecard over the range, with its item breakdown. */
export function BrHnrPlusCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.hnr_plus.totals;
  const items = data.hnr_plus.items;

  return (
    <V1Card reportId="br-hnr-plus" title="HNR+" category="operations" period="R" span={4} onExpand={() => setOpen(true)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-md bg-background/55 px-2.5 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Total Score</span>
          <span className={cn("text-base font-bold tabular-nums", scoreColor(t.total_score))}>{fmtPct(t.total_score)}</span>
        </div>

        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-md bg-background/45 px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Made</p>
            <p className="text-[13px] font-bold tabular-nums">{fmtNum(t.made)}</p>
          </div>
          {MEASURES.map((m) => (
            <div key={m.key} className="rounded-md bg-background/45 px-2.5 py-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="text-[13px] font-bold tabular-nums">{fmtPct(m.pct(t))}</p>
              <p className={cn("text-[9px] font-medium tabular-nums", scoreColor(m.score(t)))}>Score {fmtNum(m.score(t))}</p>
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <V1Empty icon={Flame}>No item breakdown in this range.</V1Empty>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/40">
            <table className={cn(V1_TBL, "min-w-max")}>
              <thead>
                <tr>
                  <th className={V1_TH}>Item</th>
                  <th className={cn(V1_TH, V1_NUM)}>Made</th>
                  <th className={cn(V1_TH, V1_NUM)}>Sold</th>
                  <th className={cn(V1_TH, V1_NUM)}>Voided</th>
                  <th className={cn(V1_TH, V1_NUM)}>Wasted</th>
                  <th className={cn(V1_TH, V1_NUM)}>Variance</th>
                  <th className={cn(V1_TH, V1_NUM)}>No Inv.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.item_id}>
                    <td className={cn(V1_TD, "max-w-[160px] truncate font-medium")} title={item.item_name}>
                      {item.item_name}
                    </td>
                    <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.made)}</td>
                    <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.sold)}</td>
                    <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.voided)}</td>
                    <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.wasted)}</td>
                    <td
                      className={cn(
                        V1_TD,
                        V1_NUM,
                        item.variance > 0 && "text-red-600 dark:text-red-400",
                        item.variance < 0 && "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {fmtVariance(item.variance)}
                    </td>
                    <td className={cn(V1_TD, V1_NUM)}>{fmtNum(item.no_inventory_available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <HnrPlusDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
