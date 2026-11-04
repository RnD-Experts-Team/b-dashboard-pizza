"use client";

import { useMemo, useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import { DetailField } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { fmtDate, fmtNumD } from "@/components/business-reports/report-format";
import type { WbrBulkFeedback, WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, NO_VALUE, meanOf } from "@/components/business-reports/cards/operations/br-shared";
import { RecordsDialog, useWbrRecords } from "./br-records";

const RATING_MAX = 5;

const fullName = (f: WbrBulkFeedback) => `${f.first_name} ${f.last_name}`.trim();

function rating(value: number | null | undefined): string {
  return value === null || value === undefined ? NO_VALUE : `${fmtNumD(value)}/${RATING_MAX}`;
}

function StarRating({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold tabular-nums text-foreground">{rating(value)}</span>
      <span className="text-muted-foreground/80">{label}</span>
    </span>
  );
}

const COLUMNS: PagedColumn<WbrBulkFeedback>[] = [
  { key: "date", header: "Date", sortValue: (f) => f.submitted_at, render: (f) => fmtDate(f.submitted_at), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (f) => f.store_label, render: (f) => f.store_label },
  { key: "name", header: "Employee", sortValue: fullName, render: fullName },
  { key: "valued", header: "Valued", numeric: true, sortValue: (f) => f.valued_respected_appreciated_rating, render: (f) => rating(f.valued_respected_appreciated_rating) },
  { key: "schedule", header: "Schedule", numeric: true, sortValue: (f) => f.work_schedule_satisfaction_rating, render: (f) => rating(f.work_schedule_satisfaction_rating) },
  {
    key: "feedback",
    header: "Feedback",
    render: (f) => <span className="line-clamp-2 min-w-[220px] whitespace-normal">{f.improvement_feedback || NO_VALUE}</span>,
  },
];

function FeedbackDetail({ f }: { f: WbrBulkFeedback }) {
  return (
    <>
      <DetailField label="Store" value={f.store_label} />
      <DetailField label="Submitted" value={fmtDate(f.submitted_at)} />
      <DetailField label="Valued / Respected" value={rating(f.valued_respected_appreciated_rating)} />
      <DetailField label="Work Schedule" value={rating(f.work_schedule_satisfaction_rating)} />
      <DetailField label="Feedback" value={f.improvement_feedback} wrap />
    </>
  );
}

/** Employee feedback across the stores: average ratings and the latest entries. */
export function BrFeedbacksCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "feedbacks");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    [records],
  );
  const averages = useMemo(
    () => ({
      valued: meanOf(records.map((f) => f.valued_respected_appreciated_rating)),
      schedule: meanOf(records.map((f) => f.work_schedule_satisfaction_rating)),
    }),
    [records],
  );
  const empty = records.length === 0;

  return (
    <V1Card
      reportId="br-feedbacks"
      title="Employee Feedback"
      category="quality"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      {empty ? (
        <V1Empty icon={MessageSquareHeart}>No feedback in this range</V1Empty>
      ) : (
        <div className="space-y-1.5">
          <V1MetricGrid cols={3}>
            <V1Metric label="Feedback" value={records.length.toLocaleString()} size="sm" />
            <V1Metric label="Avg Valued" value={rating(averages.valued)} size="sm" />
            <V1Metric label="Avg Schedule" value={rating(averages.schedule)} size="sm" />
          </V1MetricGrid>
          <div className="space-y-1.5">
            {latest.slice(0, CARD_LIST_LIMIT).map((f) => (
              <div key={f.id} className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] font-semibold">
                    {fullName(f)}
                    <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{f.store_label}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(f.submitted_at)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <StarRating label="valued" value={f.valued_respected_appreciated_rating} />
                  <StarRating label="schedule" value={f.work_schedule_satisfaction_rating} />
                </div>
                {f.improvement_feedback && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{f.improvement_feedback}</p>
                )}
              </div>
            ))}
            {records.length > CARD_LIST_LIMIT && (
              <p className="text-[10px] text-muted-foreground">
                +{(records.length - CARD_LIST_LIMIT).toLocaleString()} more — open for all
              </p>
            )}
          </div>
        </div>
      )}
      {open && (
        <RecordsDialog
          title="Employee Feedback"
          noun="record"
          rows={records}
          columns={COLUMNS}
          rowKey={(f) => f.id}
          initialSort="date"
          detailTitle={(f) => (
            <span className="flex items-center justify-between gap-2">
              <span>{fullName(f)}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{fmtDate(f.submitted_at)}</span>
            </span>
          )}
          renderDetail={(f) => <FeedbackDetail f={f} />}
          onClose={() => setOpen(false)}
        />
      )}
    </V1Card>
  );
}
