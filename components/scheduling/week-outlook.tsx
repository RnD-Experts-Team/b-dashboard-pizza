"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, ChartColumn, Info, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isoDateLabel, type Basis, type WeekPlan } from "@/lib/scheduling/day-plan";
import { useWeekOutlookStore, type OddView } from "@/lib/scheduling/week-outlook.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "./delayed-tooltip";
import { KINDS } from "./odd-days-kinds";
import { OddDaysWindow } from "./odd-days-window";
import { Segmented, type SegmentedOption } from "./segmented";

/**
 * What the week's history is based on, and the dates that were out of the
 * ordinary. The numbers themselves are elsewhere: the week's totals in the stats
 * tiles beside it, each day's detail in the grid's plan row, so nothing is shown
 * twice.
 *
 * One neutral card in the app's own card style, with a single title row: which
 * weeks the numbers come from, a switch for whether odd days count in the
 * averages, and a switch between the calendar (a click on a day opens its
 * hour-by-hour chart) and plain sentences.
 * Colours are the DSPR dashboard's: green above usual, red below, blue both.
 */

const BASIS_OPTIONS: readonly SegmentedOption<Basis>[] = [
  { value: "typical", label: "Left out" },
  { value: "avg", label: "Included" },
];

const VIEW_OPTIONS: readonly SegmentedOption<OddView>[] = [
  { value: "charts", label: "Charts", icon: <ChartColumn className="h-3 w-3" aria-hidden /> },
  { value: "list", label: "List", icon: <List className="h-3 w-3" aria-hidden /> },
];

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
}

export function WeekOutlook({
  plan,
  isLoading,
  error,
  onRetry,
  basis,
  onBasisChange,
  className,
}: WeekOutlookProps) {
  const view = useWeekOutlookStore((s) => s.oddView);
  const setView = useWeekOutlookStore((s) => s.setOddView);

  if (!plan) {
    if (isLoading) return <Skeleton className={cn("h-10 w-full rounded-xl", className)} />;
    if (!error) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-muted-foreground",
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
  const status = basis === "typical" ? "left out of the averages" : "counted in the averages";
  const history = `${format(parseISO(plan.window.start), "MMM d")} – ${format(parseISO(plan.window.end), "MMM d")} · the last 4 weeks`;

  // The basis switch, with its explanation. It lives on the card's one title
  // row, so it costs no height of its own.
  const basisControl = (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-xs text-muted-foreground @md:inline">In the averages</span>
      <Segmented label="Odd days in the averages" value={basis} onChange={onBasisChange} options={BASIS_OPTIONS} />
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What are odd days?"
            className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-64 text-xs">
          Odd days are dates that were far from a usual week. <b>Left out</b> keeps them out of the averages, so one
          wild day does not skew your plan. <b>Included</b> counts every day.
          <span className="mt-1 block font-semibold">Now: {status}.</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <Card
      data-guide-id="sched-staffing-guide"
      className={cn("@container min-w-0 gap-0 overflow-hidden p-0", className)}
    >
      {notes.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-heading text-sm font-semibold">Usual numbers</h3>
            <span className="text-xs text-muted-foreground">{history} · no odd days</span>
          </div>
          {basisControl}
        </div>
      ) : (
        <div className="flex-1 px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-sm font-semibold">Odd days</h3>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                {notes.length}
              </span>
              <span className="text-xs text-muted-foreground">{history}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {basisControl}
              <Segmented label="Show the odd days as" value={view} onChange={setView} options={VIEW_OPTIONS} />
            </div>
          </div>

          <OddDaysWindow
            plan={plan}
            odd={notes}
            basis={basis}
            view={view}
            list={
              <ul className="space-y-1.5">
                {notes.map((d) => {
                  const style = KINDS[d.kind];
                  const Icon = style.icon;
                  const date = isoDateLabel(d.date);
                  const rest = d.text.startsWith(`${date}: `) ? d.text.slice(date.length + 2) : d.text;
                  return (
                    <li key={d.date} className="flex items-start gap-2 text-xs text-foreground">
                      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", style.text)} aria-label={style.label} />
                      <span>
                        <b className="font-semibold">{date}:</b> {rest}
                      </span>
                    </li>
                  );
                })}
              </ul>
            }
          />
        </div>
      )}
    </Card>
  );
}




