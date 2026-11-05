"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, monthGrid42 } from "@/lib/calendar/dates";
import { dayHeat, type DayCount, type DayHeat } from "@/lib/calendar/day-counts";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { DayDots } from "./event-parts";
import { usePeek } from "./event-peek";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * A day's tint in the Year view, from its worst status. Red stays reserved for
 * overdue/missed (the calendar's one colour rule); the rest are neutral steps.
 */
const HEAT: Record<DayHeat, string> = {
  attention: "bg-destructive/15 font-semibold text-destructive dark:bg-destructive/25",
  active: "bg-foreground/20 font-semibold",
  open: "bg-muted font-medium",
  done: "bg-muted/40 text-muted-foreground",
};

/**
 * A 6-week mini month (constant height while paging). Used by the Year view
 * and the toolbar's date picker. Highlighted days render as one continuous
 * band (the open week, or the open day).
 */
export function MiniMonth({
  month,
  grouped,
  counts,
  onPick,
  highlight,
  peek = false,
  cellClass = "h-8",
}: {
  month: Date;
  grouped: Map<string, CalendarEvent[]>;
  /** Year view: each day's numbers (`group=day`). The day is tinted and peeks its tally. */
  counts?: Map<string, DayCount>;
  onPick: (key: string) => void;
  highlight?: (d: Date) => boolean;
  /** Hovering a day with events previews them (Year view). */
  peek?: boolean;
  cellClass?: string;
}) {
  const t = useTranslations("calendar");
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
        const count = counts?.get(k);
        const heat = count ? dayHeat(count) : null;
        // A counted day peeks its numbers; otherwise its events (if any).
        const peekBind = !peek
          ? null
          : heat
            ? peekProps({ type: "counts", id: k }, { onActivate: () => onPick(k) })
            : list.length
              ? peekProps({ type: "day", id: k }, { onActivate: () => onPick(k) })
              : null;
        return (
          <button
            key={k}
            type="button"
            {...peekBind}
            onClick={peekBind ? peekBind.onClick : () => onPick(k)}
            aria-label={count ? `${f.longDate(d)}, ${t("year.total", { n: count.total })}` : f.longDate(d)}
            className={cn("group/day relative grid place-items-center outline-none", cellClass, band)}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-[11px] tabular-nums transition-colors duration-150 group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring/50",
                today
                  ? "bg-primary font-semibold text-primary-foreground"
                  : on
                    ? "font-semibold"
                    : heat
                      ? cn(HEAT[heat], "group-hover/day:ring-2 group-hover/day:ring-ring/40 group-data-[peek-open=true]/day:ring-2 group-data-[peek-open=true]/day:ring-ring/60")
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
