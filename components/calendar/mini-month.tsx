"use client";

import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, monthGrid42 } from "@/lib/calendar/dates";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { DayDots } from "./event-parts";
import { usePeek } from "./event-peek";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * A 6-week mini month (constant height while paging). Used by the Year view
 * and the toolbar's date picker. Highlighted days render as one continuous
 * band (the open week, or the open day).
 */
export function MiniMonth({
  month,
  grouped,
  onPick,
  highlight,
  peek = false,
  cellClass = "h-8",
}: {
  month: Date;
  grouped: Map<string, CalendarEvent[]>;
  onPick: (key: string) => void;
  highlight?: (d: Date) => boolean;
  /** Hovering a day with events previews them (Year view). */
  peek?: boolean;
  cellClass?: string;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const { peekProps } = usePeek();
  const days = monthGrid42(month);
  const hl = (d: Date | undefined) => !!d && isSameMonth(d, month) && !!highlight?.(d);

  return (
    <div className="grid grid-cols-7 gap-y-0.5">
      {f.weekdayNames("narrow").map((n, i) => (
        <span key={i} className="grid h-6 place-items-center text-[10px] font-semibold uppercase text-muted-foreground">
          {n}
        </span>
      ))}
      {days.map((d, i) => {
        const k = dayKey(d);
        if (!isSameMonth(d, month)) {
          return (
            <span key={k} aria-hidden className={cn("grid place-items-center text-[11px] tabular-nums text-muted-foreground/35", cellClass)}>
              {d.getDate()}
            </span>
          );
        }
        const col = i % 7;
        const on = hl(d);
        const band = on
          ? cn("bg-accent/70", !(col > 0 && hl(days[i - 1])) && "rounded-s-full", !(col < 6 && hl(days[i + 1])) && "rounded-e-full")
          : "";
        const list = grouped.get(k) ?? [];
        const today = isSameDay(d, now);
        const peekBind = peek && list.length ? peekProps({ type: "day", id: k }, { onActivate: () => onPick(k) }) : null;
        return (
          <button
            key={k}
            type="button"
            {...peekBind}
            onClick={peekBind ? peekBind.onClick : () => onPick(k)}
            aria-label={f.longDate(d)}
            className={cn("group/day relative grid place-items-center outline-none", cellClass, band)}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-[11px] tabular-nums transition-colors duration-150 group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring/50",
                today
                  ? "bg-primary font-semibold text-primary-foreground"
                  : on
                    ? "font-semibold"
                    : "group-hover/day:bg-accent group-data-[peek-open=true]/day:bg-accent",
              )}
            >
              {d.getDate()}
            </span>
            {list.length > 0 && (
              <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-px">
                <DayDots events={list} className="size-[3px]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
