"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameMonth } from "@/lib/calendar/dates";
import type { DayCount, DayHeat } from "@/lib/calendar/day-counts";
import { byDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { MiniMonth } from "../mini-month";
import { useCalendarFormat } from "../use-calendar-format";

/** Same tints as the day cells (`mini-month.tsx`), for the legend. */
const SWATCH: Record<DayHeat, string> = {
  attention: "bg-destructive/15 dark:bg-destructive/25",
  active: "bg-foreground/20",
  open: "bg-muted",
  done: "bg-muted/40 ring-1 ring-border",
};
const LEGEND: readonly DayHeat[] = ["attention", "active", "open", "done"];

/**
 * Year view: 12 mini months. Each day is tinted by its worst status across the
 * stores shown (`counts`, from `group=day`): hovering a day shows its tally and
 * the stores that need attention, clicking it opens that day (where the events
 * load), and a month's name opens Month view. Events created here before the
 * Toolbox writes (`events`) still add their dots.
 */
export function YearView({
  cursor,
  events,
  counts,
  onOpenDay,
  onOpenMonth,
}: {
  cursor: Date;
  events: CalendarEvent[];
  counts: Map<string, DayCount>;
  onOpenDay: (key: string) => void;
  onOpenMonth: (key: string) => void;
}) {
  const t = useTranslations("calendar.year");
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const grouped = useMemo(() => byDay(events), [events]);
  const year = cursor.getFullYear();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
        {LEGEND.map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-full", SWATCH[h])} />
            {t(`legend.${h}`)}
          </span>
        ))}
      </div>
      <div className="grid flex-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const month = new Date(year, m, 1);
          const current = isSameMonth(month, now);
          return (
            <section key={m} className="bg-card p-3 sm:p-4">
              <button
                type="button"
                onClick={() => onOpenMonth(dayKey(month))}
                className={cn(
                  "mb-1.5 rounded-md px-1.5 py-0.5 font-heading text-sm font-semibold outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  current && "underline decoration-2 underline-offset-4",
                )}
              >
                {f.monthName(month)}
              </button>
              <MiniMonth month={month} grouped={grouped} counts={counts} onPick={onOpenDay} peek cellClass="h-7" />
            </section>
          );
        })}
      </div>
    </div>
  );
}
