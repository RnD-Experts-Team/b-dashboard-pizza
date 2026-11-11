"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, monthGrid42 } from "@/lib/calendar/dates";
import { attentionCount, type DayCount, type HeatLevel } from "@/lib/calendar/day-counts";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { DayDots } from "./event-parts";
import { usePeek } from "./event-peek";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * A day's tint in the Year view: one hue (the calendar's red, kept for overdue or
 * missed) in four steps of strength. The number stays in the normal text colour so
 * it reads on every step; days with nothing overdue get no tint at all.
 */
export const HEAT_CLASS: Record<HeatLevel, string> = {
  1: "bg-destructive/[0.07] dark:bg-destructive/10",
  2: "bg-destructive/20 dark:bg-destructive/30",
  3: "bg-destructive/35 dark:bg-destructive/50",
  4: "bg-destructive/60 dark:bg-destructive/80",
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
  levels,
  onPick,
  highlight,
  peek = false,
  showOutside = true,
  cellClass = "h-8",
}: {
  month: Date;
  grouped: Map<string, CalendarEvent[]>;
  /** Year view: each day's numbers (`group=day`). A counted day peeks its tally. */
  counts?: Map<string, DayCount>;
  /** Year view: the tint level of each day with something overdue or missed (`heatLevels`). */
  levels?: ReadonlyMap<string, HeatLevel>;
  onPick: (key: string) => void;
  highlight?: (d: Date) => boolean;
  /** Hovering a day with events previews them (Year view). */
  peek?: boolean;
  /** Show the neighbouring months' days in the first and last week (the date picker does; the Year view doesn't). */
  showOutside?: boolean;
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
        <span key={i} className="grid h-6 place-items-center text-[10px] font-medium uppercase text-muted-foreground/80">
          {n}
        </span>
      ))}
      {days.map((d, i) => {
        const k = dayKey(d);
        if (!isSameMonth(d, month)) {
          return (
            <span key={k} aria-hidden className={cn("grid place-items-center text-[11px] tabular-nums text-muted-foreground/35", cellClass)}>
              {showOutside ? d.getDate() : null}
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
        const counted = !!count && count.total > 0;
        const level = levels?.get(k);
        const weekend = col >= 5;
        // A counted day peeks its numbers; otherwise its events (if any).
        const peekBind = !peek
          ? null
          : counted
            ? peekProps({ type: "counts", id: k }, { onActivate: () => onPick(k) })
            : list.length
              ? peekProps({ type: "day", id: k }, { onActivate: () => onPick(k) })
              : null;
        // Not only colour: the label says how many items are overdue or missed.
        const overdue = count ? attentionCount(count) : 0;
        const label = count
          ? `${f.longDate(d)}, ${t("year.total", { n: count.total })}${overdue ? `, ${t("year.overdueCount", { n: overdue })}` : ""}`
          : f.longDate(d);
        return (
          <button
            key={k}
            type="button"
            {...peekBind}
            onClick={peekBind ? peekBind.onClick : () => onPick(k)}
            aria-label={label}
            className={cn("group/day relative grid place-items-center outline-none", cellClass, band)}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-[11px] tabular-nums transition-colors duration-150 group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring/50",
                today
                  ? "bg-primary font-semibold text-primary-foreground"
                  : on
                    ? "font-semibold"
                    : level
                      ? cn(
                          HEAT_CLASS[level],
                          "font-medium group-hover/day:ring-2 group-hover/day:ring-ring/40 group-data-[peek-open=true]/day:ring-2 group-data-[peek-open=true]/day:ring-ring/60",
                        )
                      : cn(
                          // Weekends step back a little so the weeks read at a glance.
                          counts && weekend && "text-muted-foreground",
                          "group-hover/day:bg-accent group-data-[peek-open=true]/day:bg-accent",
                        ),
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
