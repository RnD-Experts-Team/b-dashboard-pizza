"use client";

import { useMemo, useState } from "react";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./delayed-tooltip";
import { KINDS, LensLegend, lensHelp, type CalendarLens, type Kind, type LegendItem } from "./odd-days-kinds";
import type { Basis, OddDay, WeekPlan } from "@/lib/scheduling/day-plan";
import { buildOddCalendar, kindTotals } from "@/lib/scheduling/odd-days";

/**
 * The history window as a calendar, weeks in rows and the store's weekdays in
 * columns, so the odd days can be seen at a glance and picked.
 *
 * Every cell stays neutral. An odd day carries a small arrow in its colour and a
 * thin bar for how far off it was (against the furthest-off day, on a faint
 * track so lengths can be compared); a normal day is just a dim number. The
 * legend beside it is a lens: hover or focus an entry and its days light up and
 * the rest fade, with a line below saying what that kind of day is and what
 * happens to it in the averages.
 */

const CELL =
  "relative flex h-6 min-w-0 items-start justify-center rounded-md pt-0.5 text-[11px] font-medium tabular-nums transition-[opacity,box-shadow,background-color,transform] duration-200 motion-reduce:transition-none @lg:h-8 @lg:pt-1";

function KindMark({ kind }: { kind: Kind }) {
  const Icon = KINDS[kind].icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", KINDS[kind].text)} aria-hidden />;
}

export function OddCalendar({
  plan,
  odd,
  basis,
  selected,
  onOpen,
  cellRef,
}: {
  plan: WeekPlan;
  odd: OddDay[];
  basis: Basis;
  /** The date whose chart is open, if any. */
  selected: string | null;
  onOpen: (date: string) => void;
  /** Lets the window return the keyboard to the day you came from. */
  cellRef: (date: string, el: HTMLButtonElement | null) => void;
}) {
  const calendar = useMemo(() => buildOddCalendar(plan, odd), [plan, odd]);
  const totals = useMemo(() => kindTotals(calendar), [calendar]);

  const [hovered, setHovered] = useState<CalendarLens | null>(null);
  const [pinned, setPinned] = useState<CalendarLens | null>(null);
  const lens = hovered ?? pinned;

  const items: LegendItem<CalendarLens>[] = [
    ...(["spike", "dip", "mixed"] as const).map((k) => ({
      key: k,
      label: KINDS[k].label,
      mark: <KindMark kind={k} />,
      count: totals[k],
    })),
    {
      key: "normal" as const,
      label: "Normal",
      mark: <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />,
      count: totals.normal,
    },
  ];

  const dim = (own: CalendarLens) => lens !== null && lens !== own;
  const lit = (own: CalendarLens) => lens !== null && lens === own;

  return (
    // Its own container, so the legend moves beside the grid when this pane is
    // wide enough and under it when it is not, whatever the page around it does.
    <div className="@container h-full overflow-y-auto pe-1">
      <div className="flex flex-col gap-2 @lg:flex-row @lg:items-start @lg:gap-6">
        <div className="w-full max-w-[19rem] shrink-0 space-y-1">
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {calendar.columns.map((c) => (
              <span key={c.weekday}>{c.name.slice(0, 3)}</span>
            ))}
          </div>

          <div role="group" aria-label="Odd days in the last four weeks" className="grid grid-cols-7 gap-1">
            {calendar.cells.flatMap((row, r) =>
              row.map((cell, c) => {
                if (!cell) return <div key={`${r}-${c}`} aria-hidden />;

                const label = (
                  <>
                    {cell.month && (
                      <span className="text-[8px] font-semibold uppercase text-muted-foreground">{cell.month}</span>
                    )}
                    {cell.day}
                  </>
                );

                if (!cell.odd) {
                  return (
                    <div
                      key={cell.date}
                      aria-hidden
                      className={cn(
                        CELL,
                        "border border-transparent text-muted-foreground/60",
                        dim("normal") && "opacity-30",
                        lit("normal") && "bg-muted ring-1 ring-foreground/30",
                      )}
                    >
                      <span className="flex items-center gap-0.5">{label}</span>
                    </div>
                  );
                }

                const kind = cell.odd.kind;
                const style = KINDS[kind];
                const Icon = style.icon;
                return (
                  <Tooltip key={cell.date}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        ref={(el) => cellRef(cell.date, el)}
                        onClick={() => onOpen(cell.date)}
                        aria-label={cell.odd.text}
                        className={cn(
                          CELL,
                          "cursor-pointer border bg-card text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                          dim(kind) && "opacity-30",
                          lit(kind) && cn("ring-1", style.ring),
                          selected === cell.date && "ring-2 ring-primary",
                        )}
                      >
                        <span className="flex items-center gap-0.5">
                          <Icon className={cn("h-2.5 w-2.5 shrink-0", style.text)} aria-hidden />
                          {label}
                        </span>
                        <span aria-hidden className="absolute inset-x-1.5 bottom-0.5 h-[3px] rounded-full bg-border @lg:bottom-1">
                          <span
                            className={cn("block h-full rounded-full", style.bar)}
                            style={{ width: `${(cell.share ?? 1) * 100}%` }}
                          />
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64 text-xs">
                      {cell.odd.text}
                    </TooltipContent>
                  </Tooltip>
                );
              }),
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 @lg:max-w-xs">
          <LensLegend
            label="Light up days by kind"
            items={items}
            pinned={pinned}
            onHover={setHovered}
            onPin={setPinned}
          />
          {/* Room for two lines is kept only beside the grid. Under it the pane is
              short of height and the line is allowed to grow instead. */}
          <p aria-live="polite" className="px-2 pt-1 text-[11px] leading-snug text-muted-foreground @lg:min-h-8 @lg:pt-1.5">
            {lensHelp(lens, basis)}
          </p>
        </div>
      </div>
    </div>
  );
}
