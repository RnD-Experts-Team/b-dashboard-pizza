"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TechnicianStanding } from "@/lib/maintenance-tickets/technician-ranking";

/**
 * "Covers this store", "Call first", "Go-to" and the stars, beside a
 * technician's name in a picker. Renders nothing when none applies.
 */
export function TechnicianStandingBadges({
  standing,
  className,
}: {
  standing: TechnicianStanding;
  className?: string;
}) {
  if (!standing.coversStore && !standing.callFirst && !standing.goTo && standing.stars == null) return null;

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {standing.coversStore && (
        <span
          className="rounded-full bg-sky-500/15 px-1.5 py-px text-[10px] font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
          title="They cover this ticket's store"
        >
          Covers this store
        </span>
      )}
      {standing.callFirst && (
        <span
          className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          title="The one to call first for this issue"
        >
          Call first
        </span>
      )}
      {standing.goTo && (
        <span
          className="rounded-full border border-emerald-500/40 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300"
          title="The one to call first for anything"
        >
          Go-to
        </span>
      )}
      {standing.stars != null && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground"
          title={`${standing.stars} of 5 stars ${standing.starsForIssue ? "for this issue" : "overall"}`}
        >
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          {standing.stars}
          {!standing.starsForIssue && <span>overall</span>}
        </span>
      )}
    </span>
  );
}
