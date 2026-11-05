"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1_NUM, V1_TBL, V1_TD, V1_TH } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { HnrPlusItemRow, HnrPlusTotals, OperationsSection } from "@/types/business-reports.types";
import {
  CountDelta,
  DialogEmpty,
  TrendChart,
  scoreColor,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "./br-shared";

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
          {fmtPct(m.pct(get(r)))} <span className="text-muted-foreground">·</span> <Score value={m.score(get(r))} />
        </span>
      ),
    })),
  ];
}

type StoreScoreRow = StoreRow<HnrPlusTotals>;
type WeekScore = { week_start: string } & HnrPlusTotals;
interface WeekScoreRow {
  week: WeekScore;
  prev: WeekScore | null;
}
type ItemRow = HnrPlusItemRow;

const SCORE_COLOR = CATEGORIES.operations.chartColors[0];
const fmtAxisScore = (v: number): string => v.toFixed(0);

const STORE_COLUMNS: PagedColumn<StoreScoreRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...scoreColumns<StoreScoreRow>((r) => r.data),
];

const ITEM_COLUMNS: PagedColumn<ItemRow>[] = [
  { key: "item", header: "Item", sortValue: (r) => r.item_name, render: (r) => r.item_name },
  { key: "made", header: "Made", numeric: true, sortValue: (r) => r.made, render: (r) => fmtNum(r.made) },
  { key: "sold", header: "Sold", numeric: true, sortValue: (r) => r.sold, render: (r) => fmtNum(r.sold) },
  { key: "voided", header: "Voided", numeric: true, sortValue: (r) => r.voided, render: (r) => fmtNum(r.voided) },
  { key: "wasted", header: "Wasted", numeric: true, sortValue: (r) => r.wasted, render: (r) => fmtNum(r.wasted) },
  {
    key: "variance",
    header: "Variance",
    numeric: true,
    sortValue: (r) => r.variance,
    render: (r) => (
      <span className={cn(r.variance > 0 && "text-red-600 dark:text-red-400", r.variance < 0 && "text-emerald-600 dark:text-emerald-400")}>
        {fmtVariance(r.variance)}
      </span>
    ),
  },
  { key: "noinv", header: "No Inventory", numeric: true, sortValue: (r) => r.no_inventory_available, render: (r) => fmtNum(r.no_inventory_available) },
];

const itemSearch = (r: ItemRow) => r.item_name;

function HnrPlusDialog({ data, onClose }: { data: OperationsSection; onClose: () => void }) {
  const stores = useStoreRows(data.hnr_plus.by_store);
  const focus = useStoreFocus<StoreScoreRow>();
  const byWeek = data.hnr_plus.by_week;
  const labelOf = useWeekLabel(byWeek);
  const weeks = useMemo<WeekScoreRow[]>(() => withPrev(byWeek).map(({ row, prev }) => ({ week: row, prev })), [byWeek]);
  const categories = useMemo(() => byWeek.map((w) => labelOf(w.week_start)), [byWeek, labelOf]);
  const series = useMemo(
    () => [{ name: "Total score", data: byWeek.map((w) => Number(w.total_score.toFixed(1))), color: SCORE_COLOR }],
    [byWeek],
  );
  const weekColumns = useMemo<PagedColumn<WeekScoreRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) },
      ...scoreColumns<WeekScoreRow>((r) => r.week).flatMap((c) =>
        c.key === "total"
          ? [c, { key: "total_d", header: "Δ Total", numeric: true, render: (r: WeekScoreRow) => <CountDelta curr={r.week.total_score} prev={r.prev?.total_score} format={fmtNum} /> }]
          : [c],
      ),
    ],
    [labelOf],
  );
  const t = data.hnr_plus.totals;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Total score by week" description="80+ is good, under 50 is poor.">
          <TrendChart categories={categories} series={series} format={fmtAxisScore} />
        </ReportBlock>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: <PagedTable size="lg" rows={weeks} columns={weekColumns} rowKey={(r) => r.week.week_start} initialSort="week" />,
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="total"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
    {
      key: "items",
      label: "Items",
      content: data.hnr_plus.items.length ? (
        <PagedTable
          size="lg"
          rows={data.hnr_plus.items}
          columns={ITEM_COLUMNS}
          rowKey={(r) => r.item_id}
          initialSort="made"
          searchText={itemSearch}
          searchPlaceholder="Search items…"
        />
      ) : (
        <DialogEmpty>No item breakdown in this range.</DialogEmpty>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="HNR+ Scores"
      category="operations"
      stats={[
        { label: "Total score", value: fmtPct(t.total_score), tone: scoreColor(t.total_score) },
        { label: "Made", value: fmtNum(t.made) },
        ...MEASURES.filter((m) => m.key !== "void").map((m) => ({
          label: m.label,
          value: fmtPct(m.pct(t)),
          sub: `score ${fmtNum(m.score(t))}`,
          tone: scoreColor(m.score(t)),
        })),
      ]}
      tabs={tabs}
    />
  );
}

/** HNR+ production / waste / variance scorecard over the range, with its item breakdown. */
export function BrHnrPlusCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.hnr_plus.totals;
  const items = data.hnr_plus.items;

  // Nothing made means no HNR+ export landed for the range: the scores would
  // read as a near-perfect 92.5 from all-zero inputs, so say so instead.
  if (t.made === 0 && items.length === 0) {
    return (
      <V1Card reportId="br-hnr-plus" title="HNR+" category="operations" period="R" span={4}>
        <V1Empty icon={Flame}>No HNR+ data for these stores in this range.</V1Empty>
      </V1Card>
    );
  }

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
