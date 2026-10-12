"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { dayKey, isSameMonth } from "@/lib/calendar/dates";
import { byDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { MiniMonth } from "../mini-month";
import { useCalendarFormat } from "../use-calendar-format";

/**
 * Year view: 12 mini months. Days with (non-routine) events carry up to three
 * category dots; hovering one previews that day, clicking drills into Day
 * view, and a month's name opens Month view.
 */
export function YearView({
  cursor,
  events,
  onOpenDay,
  onOpenMonth,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onOpenDay: (key: string) => void;
  onOpenMonth: (key: string) => void;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const grouped = useMemo(() => byDay(events), [events]);
  const year = cursor.getFullYear();

  return (
    <div className="grid min-h-full gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
            <MiniMonth month={month} grouped={grouped} onPick={onOpenDay} peek cellClass="h-7" />
          </section>
        );
      })}
    </div>
  );
}
