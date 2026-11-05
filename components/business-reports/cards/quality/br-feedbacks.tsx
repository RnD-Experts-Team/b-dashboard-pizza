"use client";

import { useMemo, useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { compareText, fmtDate, fmtNumD } from "@/components/business-reports/report-format";
import type { WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, NO_VALUE, meanOf, plural } from "@/components/business-reports/cards/operations/br-shared";
import { DetailItem, RecordsDialog, useWbrRecords, type RecordStore, type WbrRecord } from "./br-records";

const RATING_MAX = 5;
/** A rating at or under this counts as low. */
const LOW_RATING = 2;

type Feedback = WbrRecord<"feedbacks">;

const fullName = (f: Feedback) => `${f.first_name} ${f.last_name}`.trim();
const dateOf = (f: Feedback) => f.submitted_at;
const isLow = (f: Feedback) =>
  f.valued_respected_appreciated_rating <= LOW_RATING || f.work_schedule_satisfaction_rating <= LOW_RATING;

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

const COLUMNS: PagedColumn<Feedback>[] = [
  { key: "date", header: "Date", sortValue: dateOf, render: (f) => fmtDate(f.submitted_at), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (f) => f.storeDisplay, render: (f) => f.storeDisplay },
  { key: "name", header: "Employee", sortValue: fullName, render: fullName },
  { key: "valued", header: "Valued", numeric: true, sortValue: (f) => f.valued_respected_appreciated_rating, render: (f) => rating(f.valued_respected_appreciated_rating) },
  { key: "schedule", header: "Schedule", numeric: true, sortValue: (f) => f.work_schedule_satisfaction_rating, render: (f) => rating(f.work_schedule_satisfaction_rating) },
  {
    key: "feedback",
    header: "Feedback",
    render: (f) => <span className="line-clamp-2 min-w-[260px] whitespace-normal">{f.improvement_feedback || NO_VALUE}</span>,
  },
];

const STORE_COLUMNS: PagedColumn<RecordStore<Feedback>>[] = [
  {
    key: "valued",
    header: "Avg Valued",
    numeric: true,
    sortValue: (s) => meanOf(s.rows.map((f) => f.valued_respected_appreciated_rating)),
    render: (s) => rating(meanOf(s.rows.map((f) => f.valued_respected_appreciated_rating))),
  },
  {
    key: "schedule",
    header: "Avg Schedule",
    numeric: true,
    sortValue: (s) => meanOf(s.rows.map((f) => f.work_schedule_satisfaction_rating)),
    render: (s) => rating(meanOf(s.rows.map((f) => f.work_schedule_satisfaction_rating))),
  },
  { key: "low", header: "Low ratings", numeric: true, sortValue: (s) => s.rows.filter(isLow).length, render: (s) => s.rows.filter(isLow).length.toLocaleString() },
];

const searchText = (f: Feedback) => `${fullName(f)} ${f.storeDisplay} ${f.improvement_feedback ?? ""}`;

function FeedbackDetail({ f }: { f: Feedback }) {
  return (
    <>
      <DetailItem label="Store" value={f.storeDisplay} />
      <DetailItem label="Submitted" value={fmtDate(f.submitted_at)} />
      <DetailItem label="Valued / Respected" value={rating(f.valued_respected_appreciated_rating)} />
      <DetailItem label="Work Schedule" value={rating(f.work_schedule_satisfaction_rating)} />
      <DetailItem label="Feedback" value={f.improvement_feedback} wide />
    </>
  );
}

function useAverages(records: Feedback[]) {
  return useMemo(
    () => ({
      valued: meanOf(records.map((f) => f.valued_respected_appreciated_rating)),
      schedule: meanOf(records.map((f) => f.work_schedule_satisfaction_rating)),
      low: records.filter(isLow).length,
    }),
    [records],
  );
}

function FeedbackDialog({ records, onClose }: { records: Feedback[]; onClose: () => void }) {
  const averages = useAverages(records);
  return (
    <RecordsDialog
      title="Employee Feedback"
      category="quality"
      noun="response"
      rows={records}
      dateOf={dateOf}
      stats={[
        { label: "Avg Valued", value: rating(averages.valued), sub: "valued / respected" },
        { label: "Avg Schedule", value: rating(averages.schedule), sub: "work schedule" },
        {
          label: "Low ratings",
          value: averages.low.toLocaleString(),
          sub: `a rating of ${LOW_RATING} or less`,
          tone: averages.low > 0 ? "text-red-600 dark:text-red-400" : undefined,
        },
      ]}
      storeColumns={STORE_COLUMNS}
      columns={COLUMNS}
      rowKey={(f) => f.id}
      initialSort="date"
      searchText={searchText}
      detailTitle={(f) => (
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span>{fullName(f) || "Feedback"}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {f.storeDisplay} · {fmtDate(f.submitted_at)}
          </span>
        </span>
      )}
      renderDetail={(f) => <FeedbackDetail f={f} />}
      onClose={onClose}
    />
  );
}

/** Employee feedback across the stores: average ratings and the latest entries. */
export function BrFeedbacksCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "feedbacks");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => compareText(b.submitted_at, a.submitted_at)),
    [records],
  );
  const averages = useAverages(records);
  const empty = records.length === 0;

  return (
    <V1Card
      reportId="br-feedbacks"
      title="Employee Feedback"
      category="quality"
      period="R"
      span={2}
      headerNote={empty ? undefined : plural(records.length, "response")}
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
                    <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{f.storeDisplay}</span>
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
      {open && <FeedbackDialog records={records} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
