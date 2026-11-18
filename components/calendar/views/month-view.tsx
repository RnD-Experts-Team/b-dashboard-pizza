"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, monthGrid } from "@/lib/calendar/dates";
import { eventHeatLevels, type HeatLevel } from "@/lib/calendar/day-counts";
import { fiscalWeekOf } from "@/lib/calendar/fiscal";
import { groupAllDay } from "@/lib/calendar/grouping";
import { byDay, eventPriority, lanes } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { DayAgenda } from "../day-agenda";
import { DayDots, EventBar, LaneCell, MoreButton } from "../event-parts";
import { HEAT_CLASS } from "../mini-month";
import { useCalendarFormat } from "../use-calendar-format";

const LANE = 24; // px per lane (20px item + 4px gap: room to breathe)
const HEAD = 30; // px for the day-number strip
const WEEKDAY_ROW = 33; // px for the weekday header
/**
 * Fewest lanes a week row keeps. With one, a busy day's only lane turned into
 * "+7 more" and no event showed at all; with three, a day shows two lines and the
 * "+N more" that opens the day. Below this the month scrolls.
 */
const MIN_LANES = 3;
const MIN_ROW = HEAD + MIN_LANES * LANE + 8;

/** How many lanes fit in a week row when the month fills `hostHeight`. */
function lanesFor(hostHeight: number, weeks: number): number {
  const rowH = Math.max(MIN_ROW, (hostHeight - WEEKDAY_ROW) / weeks);
  return Math.max(MIN_LANES, Math.min(8, Math.floor((rowH - HEAD - 6) / LANE)));
}

/**
 * Days of the previous / next month: a slightly sunken surface (muted in light
 * themes, the page background — darker than the card — in dark ones), so where
 * the month ends reads at a glance without a loud colour. Their dates and lines
 * are quieter too, and every 1st carries its month ("Dec 1").
 */
const OUTSIDE_CELL = "bg-muted/70 hover:bg-muted dark:bg-background/70 dark:hover:bg-background";
const INSIDE_CELL = "hover:bg-muted/40";
/** Lines in another month's days step back until hovered or focused. */
const OUTSIDE_LINE = "opacity-55 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100";

/** The week-number column on the start side of the Month grid (wide layout only). */
const WEEK_GUTTER = "2.25rem";
const COLS_WITH_GUTTER = `${WEEK_GUTTER} repeat(7, minmax(0, 1fr))`;

function WeekdayHeader({ style, gutter = false }: { style: "short" | "narrow"; gutter?: boolean }) {
  const f = useCalendarFormat();
  return (
    <div
      className={cn("sticky top-0 z-20 grid shrink-0 border-b bg-card", !gutter && "grid-cols-7")}
      style={gutter ? { gridTemplateColumns: COLS_WITH_GUTTER } : undefined}
    >
      {gutter && <div aria-hidden />}
      {f.weekdayNames(style).map((n, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-2 text-center text-[11px] font-medium text-muted-foreground sm:px-3 sm:text-start",
            (i > 0 || gutter) && "sm:border-s",
          )}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

/**
 * A row's Little Caesars week: "W47", and "P12" on the week a period starts —
 * like the printed period sheet. A Tuesday–Monday row is exactly one fiscal week.
 */
function WeekNumber({ start, current }: { start: Date; current: boolean }) {
  const f = useCalendarFormat();
  const t = useTranslations("calendar");
  const w = fiscalWeekOf(start);
  return (
    <div
      title={f.fiscalLabel(start)}
      className="flex flex-col items-center gap-1 pt-2 text-[10px] font-medium leading-none tabular-nums"
      style={{ gridColumn: 1, gridRow: "1 / -1" }}
    >
      <span className={cn(current ? "font-semibold text-foreground" : "text-muted-foreground/80")}>
        <span aria-hidden>{f.fiscalWeekShort(start)}</span>
        <span className="sr-only">{f.fiscalLabel(start)}</span>
      </span>
      {w.weekInPeriod === 1 && (
        <span aria-hidden className="rounded-sm bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
          {t("fiscal.periodShort", { period: w.period })}
        </span>
      )}
    </div>
  );
}

function WeekRow({
  days,
  events,
  grouped,
  levels,
  maxLanes,
  cursor,
  last,
  onShowDay,
}: {
  days: Date[];
  events: CalendarEvent[];
  /** Each day's events, for the day number's label. */
  grouped: ReadonlyMap<string, CalendarEvent[]>;
  /** The tint level of each day that stood out for overdue or missed work. */
  levels: ReadonlyMap<string, HeatLevel>;
  maxLanes: number;
  /** A day in the month shown (days of other months are drawn quieter). */
  cursor: Date;
  last: boolean;
  /** Open the day's dialog with every event (`eventId`: straight on that event's card). */
  onShowDay: (key: string, eventId?: string) => void;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  // Lanes draw the all-day kinds rolled up across stores (grouping.ts) and the timed events, the
  // most important first (my reminders, what people made in Toolbox, what needs action); the daily
  // routine every store repeats sorts last, so it is the first to fold into "+N more". The day's
  // dialog (`DayDetailsDialog`) holds everything.
  const laneEvents = useMemo(
    () =>
      [...groupAllDay(events.filter((e) => e.allDay)), ...events.filter((e) => !e.allDay)].sort(
        (a, b) => eventPriority(b) - eventPriority(a),
      ),
    [events],
  );
  const lay = useMemo(() => lanes(days, laneEvents, maxLanes, true), [days, laneEvents, maxLanes]);
  const thisWeek = days.some((d) => isSameDay(d, now));

  return (
    <div
      className={cn("relative grid min-h-0", !last && "border-b")}
      style={{ gridTemplateColumns: COLS_WITH_GUTTER, gridTemplateRows: `${HEAD}px repeat(${maxLanes}, ${LANE}px) minmax(0, 1fr)` }}
    >
      <WeekNumber start={days[0]} current={thisWeek} />
      {days.map((d, i) => {
        const k = dayKey(d);
        const outside = !isSameMonth(d, cursor);
        const today = isSameDay(d, now);
        const level = outside ? undefined : levels.get(k);
        return (
          // A click anywhere in the cell opens the day's dialog (the number is the keyboard
          // stop); the lines and "+N more" are siblings above it with their own actions.
          <div
            key={k}
            onClick={() => onShowDay(k)}
            className={cn(
              "group/cell flex min-w-0 cursor-pointer flex-col border-s transition-colors duration-150",
              outside ? OUTSIDE_CELL : INSIDE_CELL,
            )}
            style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
          >
            <div className="flex h-[30px] items-center px-1.5">
              {/* One quiet cue per day: its number is tinted when the day stood out for overdue
                  or missed work (the Year view's shading); the dialog has the numbers. */}
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.stopPropagation(); // the cell's own click would open it a second time
                  onShowDay(k);
                }}
                aria-label={`${f.longDate(d)}, ${f.countLabel(grouped.get(k)?.length ?? 0)}`}
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                  today
                    ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    : level
                      ? cn(HEAT_CLASS[level], "font-medium")
                      : "font-medium hover:bg-accent",
                  outside && !today && !level && "font-normal text-muted-foreground/70",
                  d.getDate() === 1 && "px-2",
                )}
              >
                {/* The 1st says its month, so the change of month is named, not just shaded. */}
                {d.getDate() === 1 ? f.format(d, { month: "short", day: "numeric" }) : d.getDate()}
              </button>
            </div>
          </div>
        );
      })}
      {lay.items.map((it) => (
        <LaneCell
          key={`${it.ev.id}-${it.col}`}
          col={it.col + 2}
          span={it.span}
          lane={it.lane + 2}
          className={cn(days.slice(it.col, it.col + it.span).every((d) => !isSameMonth(d, cursor)) && OUTSIDE_LINE)}
        >
          {/* No hover card in the Month: a click opens the day's dialog on this event (a
              roll-up, on the day's list), on the first day of the line in this row. */}
          <EventBar item={it} plain onOpen={() => onShowDay(dayKey(days[it.col]), it.ev.members ? undefined : it.ev.id)} />
        </LaneCell>
      ))}
      {lay.more.map((m) => (
        <LaneCell
          key={`more-${m.key}`}
          col={m.col + 2}
          span={1}
          lane={m.lane + 2}
          className={cn(!isSameMonth(days[m.col], cursor) && OUTSIDE_LINE)}
        >
          {/* "+N more" opens the day's dialog with everything. */}
          <MoreButton more={m} onExpand={() => onShowDay(m.key)} />
        </LaneCell>
      ))}
    </div>
  );
}

/**
 * Month view (sm+): the month as a grid over the card's full width. A cell can't
 * hold a busy day — 150+ events across 39 stores — so the grid is a calm overview:
 * plain lines (no fills), the most important first, and one faint tint on the date
 * when the day stood out for overdue or missed work. Clicking a day (its cell, its
 * number or "+N more") calls `onShowDay`, and the page opens a centered dialog with
 * EVERY event of that day and its details (`DayDetailsDialog`): by category, the
 * same kind across stores rolled up, what needs attention first.
 */
export function MonthView({
  cursor,
  events,
  onShowDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onShowDay: (key: string, eventId?: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [maxLanes, setMaxLanes] = useState(MIN_LANES);
  const grouped = useMemo(() => byDay(events), [events]);
  const levels = useMemo(() => eventHeatLevels(grouped), [grouped]);
  const weeks = useMemo(() => {
    const grid = monthGrid(cursor);
    const out: Date[][] = [];
    for (let i = 0; i < grid.length; i += 7) out.push(grid.slice(i, i + 7));
    return out;
  }, [cursor]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const fit = () => setMaxLanes(lanesFor(el.clientHeight, weeks.length));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

  return (
    // `relative`: the rows' screen-reader-only spans are absolutely positioned — without a
    // positioned parent inside this scroller they escape it and make the page body scroll.
    <div ref={hostRef} className="relative flex h-full min-w-0 flex-col overflow-y-auto overscroll-contain">
      <WeekdayHeader style="short" gutter />
      <div className="grid flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(${MIN_ROW}px, 1fr))` }}>
        {weeks.map((days, wi) => (
          <WeekRow
            key={dayKey(days[0])}
            days={days}
            events={events}
            grouped={grouped}
            levels={levels}
            maxLanes={maxLanes}
            cursor={cursor}
            last={wi === weeks.length - 1}
            onShowDay={onShowDay}
          />
        ))}
      </div>
    </div>
  );
}

/** Month view (< sm): compact cells with category dots; tapping a day lists it below. */
export function CompactMonthView({
  cursor,
  events,
  onSelectDay,
  onOpenDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onSelectDay: (key: string) => void;
  onOpenDay?: (key: string) => void;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const grouped = useMemo(() => byDay(events), [events]);
  const dayEvents = grouped.get(dayKey(cursor)) ?? [];

  return (
    <div>
      <WeekdayHeader style="narrow" />
      <div className="grid grid-cols-7 [&>*:nth-last-child(-n+7)]:border-b-0">
        {grid.map((d) => {
          const k = dayKey(d);
          const outside = !isSameMonth(d, cursor);
          const today = isSameDay(d, now);
          const selected = isSameDay(d, cursor);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectDay(k)}
              aria-pressed={selected}
              aria-label={f.longDate(d)}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 border-b border-e pt-1.5 outline-none transition-colors duration-150 [&:nth-child(7n)]:border-e-0",
                selected ? "bg-accent/60" : outside ? "bg-muted/70 dark:bg-background/70" : "active:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-xs tabular-nums transition-colors duration-150",
                  today ? "bg-primary font-semibold text-primary-foreground" : selected && "bg-accent font-semibold",
                  outside && !today && "text-muted-foreground/70",
                )}
              >
                {d.getDate()}
              </span>
              <span className={cn("flex h-1.5 items-center gap-0.5", outside && "opacity-50")}>
                <DayDots events={grouped.get(k) ?? []} />
              </span>
            </button>
          );
        })}
      </div>
      {/* Phones list the picked day under the grid (no room for a popup); the page scrolls. */}
      <div className="border-t">
        <DayAgenda key={dayKey(cursor)} day={cursor} events={dayEvents} onOpenDay={onOpenDay} />
      </div>
    </div>
  );
}
