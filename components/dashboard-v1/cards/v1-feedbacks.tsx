"use client";

import { useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import type { WbrFeedback } from "@/types/hooks.types";
import { fmtDate, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1FeedbacksCard — weekly employee feedback (quality), expandable.
 *  Data shaping mirrors components/dspr/wbr-feedbacks-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

function StarRating({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold tabular-nums text-foreground">
        {value === null || value === undefined ? "—" : `${value}/5`}
      </span>
      <span className="text-muted-foreground/80">{label}</span>
    </span>
  );
}

export function V1FeedbacksCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: WbrFeedback[];
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Employee Feedback" category="quality" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const empty = data.length === 0;

  return (
      <V1Card
        title="Employee Feedback"
        category="quality"
        period="W"
        span={span}
        className={className}
        onExpand={empty ? undefined : () => setOpen(true)}
      >
        {empty ? (
          <V1Empty icon={MessageSquareHeart}>No feedback this week</V1Empty>
        ) : (
          <div className="space-y-1.5">
            <V1Metric label="Feedback" value={data.length} size="sm" />
            {data.map((f) => (
              <div key={f.id} className="rounded-md bg-background/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold">
                    {f.first_name} {f.last_name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {fmtDate(f.submitted_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <StarRating
                    label="valued"
                    value={f.valued_respected_appreciated_rating}
                  />
                  <StarRating
                    label="schedule"
                    value={f.work_schedule_satisfaction_rating}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Employee Feedback"
        badgeText={`${data.length} record${data.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-3">
          {data.map((f) => (
            <div
              key={f.id}
              className="space-y-2 rounded-lg border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {f.first_name} {f.last_name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDate(f.submitted_at)}
                </span>
              </div>
              <div className="space-y-1.5">
                <DetailField
                  label="Valued / Respected"
                  value={
                    f.valued_respected_appreciated_rating === null ||
                    f.valued_respected_appreciated_rating === undefined
                      ? "—"
                      : `${f.valued_respected_appreciated_rating}/5`
                  }
                />
                <DetailField
                  label="Work Schedule"
                  value={
                    f.work_schedule_satisfaction_rating === null ||
                    f.work_schedule_satisfaction_rating === undefined
                      ? "—"
                      : `${f.work_schedule_satisfaction_rating}/5`
                  }
                />
                <DetailField
                  label="Feedback"
                  value={f.improvement_feedback}
                  wrap
                />
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </V1Card>
  );
}
