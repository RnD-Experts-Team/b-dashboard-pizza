"use client";

import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CleaningReview } from "@/types/dashboard-report.types";
import { fmtDate, WbrCardSkeleton } from "./wbr-format";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function WbrCleaningReviewCard({
  data,
  isLoading,
  className,
}: {
  data?: CleaningReview;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, overall_score, entries } = data;
  const passCount = entries.filter((e) => e.score.toLowerCase() === "pass").length;
  const allPassed = entries.length > 0 && passCount === entries.length;

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-green-50 via-green-100 to-green-200 dark:from-green-950/20 dark:via-green-900/40 dark:to-green-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-green-500/15 p-0.5 dark:bg-green-500/20">
            <Sparkles className="h-3 w-3 text-green-500" />
          </div>
          Cleaning Review
          <span className="ml-auto font-normal text-muted-foreground">
            {fmtDate(filtering.week_start)} → {fmtDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        <div className="flex items-center justify-between rounded-md bg-background/50 px-2.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Overall Score
          </span>
          <span className={cn("text-lg font-bold tabular-nums", scoreColor(overall_score))}>
            {overall_score}%
          </span>
        </div>

        {entries.length > 0 && (
          <div className="flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
            <span>{entries.length} areas reviewed</span>
            <span
              className={cn(
                "font-semibold",
                allPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {passCount}/{entries.length} passed
            </span>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 py-4 text-center">
            <Sparkles className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No cleaning review this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {entries.map((entry, i) => {
              const passed = entry.score.toLowerCase() === "pass";
              return (
                <div
                  key={`${entry.review_place}-${i}`}
                  className="flex items-center justify-between gap-2 rounded bg-background/40 px-2 py-1"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium">
                    {passed ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="truncate">{entry.review_place}</span>
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-4 shrink-0 px-1.5 py-0 text-[9px] font-semibold",
                      passed
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/15 text-red-600 dark:text-red-400",
                    )}
                  >
                    {entry.score}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
