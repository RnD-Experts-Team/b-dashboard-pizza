"use client";

import { useMemo, type MutableRefObject } from "react";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, weekDays } from "@/lib/calendar/dates";
import { byDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { DayDots } from "../event-parts";
import { useCalendarFormat } from "../use-calendar-format";
import { TimeGrid, type GridScroll } from "./time-grid";

interface WeekViewProps {
  cursor: Date;
  events: CalendarEvent[];
  compact: boolean;
  onOpenDay: (key: string) => void;
  onSelectDay: (key: string) => void;
  scroll: GridScroll;
  scrollMemory: MutableRefObject<number | null>;
}

/**
 * Week view. sm+: a 7-column hour grid. Below sm: a 7-day strip (tap to pick
 * a day) over a single-day timeline.
 */
export function WeekView({ cursor, events, compact, onOpenDay, onSelectDay, scroll, scrollMemory }: WeekViewProps) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const days = useMemo(() => weekDays(cursor), [cursor]);
  const grouped = useMemo(() => byDay(events), [events]);

  if (!compact) {
    return (
      <TimeGrid
        days={days}
        events={events}
        onOpenDay={onOpenDay}
        scroll={scroll}
        scrollMemory={scrollMemory}
      />
    );
  }

  const narrow = f.weekdayNames("narrow");
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 border-b p-2">
        {days.map((d, i) => {
          const selected = isSameDay(d, cursor);
          const today = isSameDay(d, now);
          return (
            <button
              key={dayKey(d)}
              type="button"
              onClick={() => onSelectDay(dayKey(d))}
              aria-pressed={selected}
              aria-label={f.longDate(d)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-1.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-accent/60",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  selected ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {narrow[i]}
              </span>
              <span
                className={cn(
                  "font-heading text-base leading-none tabular-nums",
                  today && !selected && "underline decoration-2 underline-offset-4",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex h-1 items-center gap-0.5">
                <DayDots events={grouped.get(dayKey(d)) ?? []} className="size-1" />
              </span>
            </button>
          );
        })}
      </div>
      <TimeGrid
        key={dayKey(cursor)}
        days={[cursor]}
        events={grouped.get(dayKey(cursor)) ?? []}
        header={false}
        style={{ height: "calc(100dvh - 22rem)", minHeight: "24rem" }}
        onOpenDay={onOpenDay}
        scroll={scroll}
        scrollMemory={scrollMemory}
      />
    </div>
  );
}
