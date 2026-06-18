"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageSquareHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/wbr-reports/primitives";
import type { WbrFeedback } from "@/types/hooks.types";
import { fmtDate, WbrCardSkeleton } from "./wbr-format";
import { WbrDetailDialog, DetailField } from "./wbr-detail-dialog";

function Rating({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Stars rating={value} />
      <span className="text-[11px] text-muted-foreground">{value}/5</span>
    </span>
  );
}

export function WbrFeedbacksCard({
  data,
  isLoading,
  className,
}: {
  data?: WbrFeedback[];
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const empty = data.length === 0;

  return (
    <>
      <Card
        onClick={() => !empty && setOpen(true)}
        className={cn(
          "flex h-[280px] flex-col gap-0 py-1.5 transition-shadow bg-linear-to-r from-pink-50 via-pink-100 to-pink-200 dark:from-pink-950/20 dark:via-pink-900/40 dark:to-pink-800/50",
          !empty && "cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-pink-500/15 p-0.5 dark:bg-pink-500/20">
              <MessageSquareHeart className="h-3 w-3 text-pink-500" />
            </div>
            Weekly Feedback
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto h-4 px-1.5 py-0 text-[10px]",
                data.length > 0
                  ? "bg-pink-500/15 text-pink-600 dark:text-pink-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {data.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2">
          {empty ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              No feedback this week.
            </p>
          ) : (
            data.map((f) => (
              <div key={f.id} className="rounded-md bg-background/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    {f.first_name} {f.last_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(f.submitted_at)}
                  </span>
                </div>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {f.improvement_feedback}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
                  value={<Rating value={f.valued_respected_appreciated_rating} />}
                />
                <DetailField
                  label="Work Schedule"
                  value={<Rating value={f.work_schedule_satisfaction_rating} />}
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
    </>
  );
}
