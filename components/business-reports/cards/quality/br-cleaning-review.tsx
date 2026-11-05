"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { CleaningScore, QualitySection } from "@/types/business-reports.types";
import {
  DialogEmpty,
  ScoreBars,
  scoreColor,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  type StoreRow,
} from "@/components/business-reports/cards/operations/br-shared";

const BAR_COLOR = CATEGORIES.quality.chartColors[0];
/** Rows each Overview list shows (lowest scores first). */
const OVERVIEW_ROWS = 10;

type Row = StoreRow<CleaningScore>;
type PlaceRow = QualitySection["cleaning_review"]["by_place"][number];

/** Score, passed, reviewed and failed, shared by the store and place tables. */
function scoreColumns<T>(get: (row: T) => CleaningScore): PagedColumn<T>[] {
  return [
    {
      key: "score",
      header: "Score",
      numeric: true,
      sortValue: (r) => get(r).overall_score,
      render: (r) => <span className={cn("font-semibold", scoreColor(get(r).overall_score))}>{fmtPct(get(r).overall_score)}</span>,
    },
    { key: "passes", header: "Passed", numeric: true, sortValue: (r) => get(r).passes, render: (r) => fmtNum(get(r).passes) },
    { key: "total", header: "Reviewed", numeric: true, sortValue: (r) => get(r).total, render: (r) => fmtNum(get(r).total) },
    {
      key: "failed",
      header: "Failed",
      numeric: true,
      sortValue: (r) => get(r).total - get(r).passes,
      render: (r) => {
        const failed = get(r).total - get(r).passes;
        return <span className={failed > 0 ? "text-red-600 dark:text-red-400" : undefined}>{fmtNum(failed)}</span>;
      },
    },
  ];
}

const STORE_COLUMNS: PagedColumn<Row>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...scoreColumns<Row>((r) => r.data),
];

const PLACE_COLUMNS: PagedColumn<PlaceRow>[] = [
  { key: "place", header: "Review place", sortValue: (r) => r.review_place, render: (r) => r.review_place },
  ...scoreColumns<PlaceRow>((r) => r),
];

const placeSearch = (r: PlaceRow) => r.review_place;
const passedLine = (s: CleaningScore) => `${fmtNum(s.passes)}/${fmtNum(s.total)} passed`;

function CleaningDialog({ data, onClose }: { data: QualitySection; onClose: () => void }) {
  const review = data.cleaning_review;
  const stores = useStoreRows(review.by_store);
  const focus = useStoreFocus<Row>();
  const worstPlaces = useMemo(
    () =>
      [...review.by_place]
        .sort((a, b) => a.overall_score - b.overall_score)
        .slice(0, OVERVIEW_ROWS)
        .map((p) => ({ key: p.review_place, label: p.review_place, score: p.overall_score, sub: passedLine(p) })),
    [review.by_place],
  );
  const worstStores = useMemo(
    () =>
      [...stores]
        .filter((s) => s.data.total > 0)
        .sort((a, b) => a.data.overall_score - b.data.overall_score)
        .slice(0, OVERVIEW_ROWS)
        .map((s) => ({ key: s.store, label: s.name, score: s.data.overall_score, sub: passedLine(s.data), title: s.name })),
    [stores],
  );
  const failed = review.total - review.passes;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Review places" description="Lowest score first.">
            {worstPlaces.length ? <ScoreBars rows={worstPlaces} color={BAR_COLOR} /> : <DialogEmpty>No places reviewed.</DialogEmpty>}
          </ReportBlock>
          <ReportBlock title="Stores" description="Lowest score first.">
            {worstStores.length ? <ScoreBars rows={worstStores} color={BAR_COLOR} /> : <DialogEmpty>No stores reviewed.</DialogEmpty>}
          </ReportBlock>
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
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="score"
          initialDir="asc"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
    {
      key: "places",
      label: "By place",
      content: (
        <PagedTable
          size="lg"
          rows={review.by_place}
          columns={PLACE_COLUMNS}
          rowKey={(r) => r.review_place}
          initialSort="score"
          initialDir="asc"
          searchText={placeSearch}
          searchPlaceholder="Search places…"
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Cleaning Review"
      category="quality"
      stats={[
        { label: "Overall score", value: fmtPct(review.overall_score), tone: scoreColor(review.overall_score) },
        { label: "Passed", value: fmtNum(review.passes), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Failed", value: fmtNum(failed), tone: failed > 0 ? "text-red-600 dark:text-red-400" : undefined },
        { label: "Reviewed", value: fmtNum(review.total) },
        { label: "Places", value: fmtNum(review.by_place.length) },
        { label: "Stores", value: fmtNum(stores.filter((s) => s.data.total > 0).length), sub: "with a review" },
      ]}
      tabs={tabs}
    />
  );
}

/** Cleaning reviews over the range: overall pass score and each review place. */
export function BrCleaningReviewCard({ data }: { data: QualitySection }) {
  const [open, setOpen] = useState(false);
  const review = data.cleaning_review;
  const empty = review.total === 0;
  const allPassed = !empty && review.passes === review.total;

  return (
    <V1Card
      reportId="br-cleaning-review"
      title="Cleaning Review"
      category="quality"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      {empty ? (
        <V1Empty icon={Sparkles}>No cleaning reviews in this range.</V1Empty>
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          <div className="flex items-center justify-between rounded-md bg-background/55 px-2.5 py-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Overall Score</span>
            <span className={cn("text-base font-bold tabular-nums", scoreColor(review.overall_score))}>
              {fmtPct(review.overall_score)}
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold tabular-nums",
                allPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {fmtNum(review.passes)}/{fmtNum(review.total)} passed
            </span>
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-1 overflow-y-auto">
            {review.by_place.map((p) => {
              const passed = p.total > 0 && p.passes === p.total;
              return (
                <div key={p.review_place} className="flex items-center justify-between gap-2 rounded bg-background/45 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium">
                    {passed ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="truncate">{p.review_place}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[9px] tabular-nums">
                    <span className="text-muted-foreground">
                      {fmtNum(p.passes)}/{fmtNum(p.total)}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-semibold",
                        passed
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400",
                      )}
                    >
                      {fmtPct(p.overall_score)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {open && <CleaningDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
