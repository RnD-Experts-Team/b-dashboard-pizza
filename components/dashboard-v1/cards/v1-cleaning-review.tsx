"use client";

import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { V1Card } from "../v1-card";
import { V1Empty } from "../v1-ui";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import type { CleaningReview } from "@/types/dashboard-report.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1CleaningReviewCard — Dashboard V1, category "quality", period "W".
 * ────────────────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function V1CleaningReviewCard({
  data,
  isLoading,
  span = 2,
  className,
}: {
  data?: CleaningReview;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { overall_score, entries } = data;
  const passCount = entries.filter((e) => e.score.toLowerCase() === "pass").length;
  const allPassed = entries.length > 0 && passCount === entries.length;

  return (
    <V1Card title="Cleaning Review" category="quality" period="W" span={span} className={className}>
      {entries.length === 0 ? (
        <V1Empty icon={Sparkles}>No cleaning review this period.</V1Empty>
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          <div className="flex items-center justify-between rounded-md bg-background/55 px-2.5 py-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Overall Score
            </span>
            <span className={cn("text-base font-bold tabular-nums", scoreColor(overall_score))}>
              {overall_score}%
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold",
                allPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {passCount}/{entries.length} passed
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto">
            {entries.map((entry, i) => {
              const passed = entry.score.toLowerCase() === "pass";
              return (
                <div
                  key={`${entry.review_place}-${i}`}
                  className="flex items-center justify-between gap-2 rounded bg-background/45 px-2 py-1"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium">
                    {passed ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="truncate">{entry.review_place}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                      passed
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/15 text-red-600 dark:text-red-400",
                    )}
                  >
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </V1Card>
  );
}
