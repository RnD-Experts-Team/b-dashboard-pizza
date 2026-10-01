"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowDownUp, History, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Basis, OddDay, WeekPlan } from "@/lib/scheduling/day-plan";

/**
 * What the week's history is based on, and the dates that were out of the
 * ordinary. The numbers themselves are elsewhere: the week's totals in the stats
 * tiles beside it, each day's detail in the grid's plan row, so nothing is shown
 * twice.
 *
 * Odd dates are one plain sentence each, furthest off first. They sit in a short
 * list that scrolls, so a month of them never grows the card and nothing needs a
 * click to reveal.
 */

function NoteIcon({ kind }: { kind: OddDay["kind"] }) {
  const className = "mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400";
  if (kind === "spike") return <TrendingUp className={className} />;
  if (kind === "dip") return <TrendingDown className={className} />;
  return <ArrowDownUp className={className} />;
}

export interface WeekOutlookProps {
  plan: WeekPlan | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  basis: Basis;
  onBasisChange: (basis: Basis) => void;
  /**
   * Merged onto the root of every state (card, skeleton, error), so the page can
   * size and place it without this file knowing where it sits.
   */
  className?: string;
  /**
   * Merged onto the odd-day scroll window. The default height suits a card that
   * stands alone; a page that sets the card beside something taller or shorter
   * can resize the window to fill the difference instead of leaving a gap.
   */
  listClassName?: string;
}

export function WeekOutlook({
  plan,
  isLoading,
  error,
  onRetry,
  basis,
  onBasisChange,
  className,
  listClassName,
}: WeekOutlookProps) {
  if (!plan) {
    if (isLoading) return <Skeleton className={cn("h-10 w-full rounded-lg", className)} />;
    if (!error) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground",
          className,
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1">{error}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const notes = plan.keepInMind;

  return (
    // A column, so that when the page stretches the card to the height of the
    // tiles beside it, the amber box takes up the slack instead of leaving a gap.
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 sm:px-4",
        className,
      )}
      data-guide-id="sched-staffing-guide"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5 shrink-0" />
          <span>
            Usual numbers come from{" "}
            <span className="font-medium text-foreground">
              {format(parseISO(plan.window.start), "MMM d")} – {format(parseISO(plan.window.end), "MMM d")}
            </span>
            , the last 4 weeks
          </span>
        </p>

        {/* A label, then the choice. Only the two options are buttons. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Odd days in the averages:</span>
          <div role="radiogroup" aria-label="Odd days in the averages" className="flex rounded-md border p-0.5">
            {(
              [
                ["typical", "Left out"],
                ["avg", "Included"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={basis === value}
                onClick={() => onBasisChange(value)}
                className={cn(
                  "rounded px-2.5 py-0.5 text-xs font-medium transition-colors",
                  basis === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="flex-1 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/25">
          <p className="mb-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Keep in mind: {notes.length} odd {notes.length === 1 ? "day" : "days"} in the last 4 weeks
            {basis === "typical" ? ", left out of the averages" : ", counted in the averages"}
          </p>
          {/* A fixed window onto the list. It scrolls rather than growing, so the
              card keeps its height however many odd days there are. Focusable so
              the keyboard can scroll it too. */}
          <div
            role="region"
            aria-label="Odd days"
            tabIndex={0}
            className={cn(
              "max-h-20 overflow-y-auto rounded-sm pe-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-600/50",
              listClassName,
            )}
          >
            <ul className="space-y-0.5">
              {notes.map((d) => (
                <li key={d.date} className="flex items-start gap-1.5 text-xs">
                  <NoteIcon kind={d.kind} />
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
