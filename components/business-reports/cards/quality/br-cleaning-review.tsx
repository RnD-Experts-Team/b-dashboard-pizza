"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { CleaningScore, QualitySection } from "@/types/business-reports.types";
import {
  scoreColor,
  useStoreFocus,
  useStoreRows,
  type StoreRow,
} from "@/components/business-reports/cards/operations/br-shared";

type Row = StoreRow<CleaningScore>;

const STORE_COLUMNS: PagedColumn<Row>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  {
    key: "score",
    header: "Score",
    numeric: true,
    sortValue: (r) => r.data.overall_score,
    render: (r) => <span className={cn("font-semibold", scoreColor(r.data.overall_score))}>{fmtPct(r.data.overall_score)}</span>,
  },
  { key: "passes", header: "Passed", numeric: true, sortValue: (r) => r.data.passes, render: (r) => fmtNum(r.data.passes) },
  { key: "total", header: "Reviewed", numeric: true, sortValue: (r) => r.data.total, render: (r) => fmtNum(r.data.total) },
  { key: "failed", header: "Failed", numeric: true, sortValue: (r) => r.data.total - r.data.passes, render: (r) => fmtNum(r.data.total - r.data.passes) },
];

function CleaningDialog({ data, onClose }: { data: QualitySection; onClose: () => void }) {
  const rows = useStoreRows(data.cleaning_review.by_store);
  const focus = useStoreFocus<Row>();
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Cleaning Review" badgeText="By store">
      <V1SubLabel className="mb-1">By store</V1SubLabel>
      <PagedTable
        rows={rows}
        columns={STORE_COLUMNS}
        rowKey={(r) => r.store}
        initialSort="score"
        initialDir="asc"
        onRowClick={focus.onRowClick}
        footerNote={focus.footerNote}
      />
    </WbrDetailDialog>
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
