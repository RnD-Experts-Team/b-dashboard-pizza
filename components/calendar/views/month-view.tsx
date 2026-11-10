"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, isWeekend, monthGrid } from "@/lib/calendar/dates";
import { eventHeatLevels, type HeatLevel } from "@/lib/calendar/day-counts";
import { groupAllDay, isRoutineRollUp } from "@/lib/calendar/grouping";
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
 * "+N more" that selects the day. Below this the month scrolls.
 */
const MIN_LANES = 3;
const MIN_ROW = HEAD + MIN_LANES * LANE + 8;

/** How many lanes fit in a week row when the month fills `hostHeight`. */
function lanesFor(hostHeight: number, weeks: number): number {
  const rowH = Math.max(MIN_ROW, (hostHeight - WEEKDAY_ROW) / weeks);
  return Math.max(MIN_LANES, Math.min(8, Math.floor((rowH - HEAD - 6) / LANE)));
}

function WeekdayHeader({ style }: { style: "short" | "narrow" }) {
  const f = useCalendarFormat();
  return (
    <div className="sticky top-0 z-20 grid shrink-0 grid-cols-7 border-b bg-card">
      {f.weekdayNames(style).map((n, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-2 text-center text-[11px] font-medium text-muted-foreground sm:px-3 sm:text-start",
            i > 0 && "sm:border-s",
          )}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function WeekRow({
  days,
  events,
  levels,
  maxLanes,
  cursor,
  last,
  onSelectDay,
}: {
  days: Date[];
  events: CalendarEvent[];
  /** The tint level of each day that stood out for overdue or missed work. */
  levels: ReadonlyMap<string, HeatLevel>;
  maxLanes: number;
  /** The selected day (and so the month shown). */
  cursor: Date;
  last: boolean;
  onSelectDay: (key: string) => void;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  // Lanes draw only what is worth a line: the all-day kinds rolled up across stores (grouping.ts)
  // minus the daily routine that every store repeats every day, the most important first (my
  // reminders, what people made in Toolbox, what needs action). The day panel holds the rest.
  const laneEvents = useMemo(
    () =>
      [...groupAllDay(events.filter((e) => e.allDay)).filter((e) => !isRoutineRollUp(e)), ...events.filter((e) => !e.allDay)].sort(
        (a, b) => eventPriority(b) - eventPriority(a),
      ),
    [events],
  );
  const lay = useMemo(() => lanes(days, laneEvents, maxLanes, true), [days, laneEvents, maxLanes]);

  return (
    <div
      className={cn("relative grid min-h-0 grid-cols-7", !last && "border-b")}
      style={{ gridTemplateRows: `${HEAD}px repeat(${maxLanes}, ${LANE}px) minmax(0, 1fr)` }}
    >
      {days.map((d, i) => {
        const k = dayKey(d);
        const outside = !isSameMonth(d, cursor);
        const today = isSameDay(d, now);
        const selected = isSameDay(d, cursor);
        const level = outside ? undefined : levels.get(k);
        return (
          // The whole cell selects its day (the number is the keyboard stop); the lines and
          // "+N more" are siblings above it, so they never trigger this click.
          <div
            key={k}
            onClick={() => onSelectDay(k)}
            className={cn(
              "group/cell flex min-w-0 cursor-pointer flex-col transition-colors duration-150 hover:bg-muted/40",
              i > 0 && "border-s",
              isWeekend(d) && "bg-muted/20",
              outside && "bg-muted/30",
              selected && "bg-accent/50 ring-1 ring-inset ring-foreground/25",
            )}
            style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
          >
            <div className="flex h-[30px] items-center px-1.5">
              {/* One quiet cue per day: its number is tinted when the day stood out for overdue
                  or missed work (the Year view's shading); the panel has the numbers. */}
              <button
                type="button"
                onClick={() => onSelectDay(k)}
                aria-label={f.longDate(d)}
                aria-pressed={selected}
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                  today
                    ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    : level
                      ? cn(HEAT_CLASS[level], "font-medium")
                      : "font-medium hover:bg-accent",
                  outside && !today && !level && "text-muted-foreground/60",
                )}
              >
                {d.getDate()}
              </button>
            </div>
          </div>
        );
      })}
      {lay.items.map((it) => (
        <LaneCell key={`${it.ev.id}-${it.col}`} col={it.col + 1} span={it.span} lane={it.lane + 2}>
          <EventBar item={it} plain />
        </LaneCell>
      ))}
      {lay.more.map((m) => (
        <LaneCell key={`more-${m.key}`} col={m.col + 1} span={1} lane={m.lane + 2}>
          {/* "+N more" selects the day: the panel lists all of it. */}
          <MoreButton more={m} onExpand={() => onSelectDay(m.key)} />
        </LaneCell>
      ))}
    </div>
  );
}

/**
 * Month view (sm+): the month as a grid, and the selected day's FULL list beside
 * it (below it while the card is narrower than 64rem). A cell can't hold a busy day — 150+ events across 39
 * stores — so the grid is a calm overview: plain lines (no fills) for what is notable
 * (a task sent to every store, a maintenance visit), the daily routine left out, and
 * one faint tint on the date when the day stood out for overdue or missed work. "+N
 * more" selects the day. The panel (`DayAgenda`) holds everything: by category, the
 * same kind across stores rolled up, what needs attention first. The selected day is
 * the page's cursor, as in the compact view.
 */
export function MonthView({
  cursor,
  events,
  onOpenDay,
  onSelectDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onOpenDay: (key: string) => void;
  onSelectDay: (key: string) => void;
}) {
  const t = useTranslations("calendar");
  const hostRef = useRef<HTMLDivElement>(null);
  const [maxLanes, setMaxLanes] = useState(MIN_LANES);
  const grouped = useMemo(() => byDay(events), [events]);
  const levels = useMemo(() => eventHeatLevels(grouped), [grouped]);
  const dayEvents = grouped.get(dayKey(cursor)) ?? [];
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

  // Below the grid the day can sit out of sight: bring it into view when a day is picked.
  const asideRef = useRef<HTMLElement>(null);
  const select = (key: string) => {
    onSelectDay(key);
    requestAnimationFrame(() => {
      const aside = asideRef.current;
      const host = hostRef.current;
      if (aside && host && aside.offsetTop > host.offsetTop) aside.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  return (
    // The card's WIDTH decides (it depends on the sidebar, not the screen): from 64rem the two
    // columns scroll on their own; narrower, the grid keeps the full width and the day sits under it.
    <div className="@container h-full">
      <div className="grid @[64rem]:h-full @[64rem]:grid-cols-[minmax(0,1fr)_21rem] @[64rem]:grid-rows-[minmax(0,1fr)]">
        <div ref={hostRef} className="relative flex min-w-0 flex-col @[64rem]:min-h-0 @[64rem]:overflow-y-auto @[64rem]:overscroll-contain">
          <WeekdayHeader style="short" />
          <div className="grid flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(${MIN_ROW}px, 1fr))` }}>
            {weeks.map((days, wi) => (
              <WeekRow
                key={dayKey(days[0])}
                days={days}
                events={events}
                levels={levels}
                maxLanes={maxLanes}
                cursor={cursor}
                last={wi === weeks.length - 1}
                onSelectDay={select}
              />
            ))}
          </div>
        </div>
        <aside
          ref={asideRef}
          aria-label={t("agenda.label")}
          className="min-w-0 scroll-mt-2 border-t @[64rem]:min-h-0 @[64rem]:border-s @[64rem]:border-t-0"
        >
          {/* Keyed by day: its open/closed groups start fresh for each day. */}
          <DayAgenda key={dayKey(cursor)} day={cursor} events={dayEvents} onOpenDay={onOpenDay} />
        </aside>
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
                selected ? "bg-muted/70" : "active:bg-muted/50",
                outside && "bg-muted/25",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-xs tabular-nums transition-colors duration-150",
                  today ? "bg-primary font-semibold text-primary-foreground" : selected && "bg-accent font-semibold",
                  outside && !today && "text-muted-foreground/60",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                <DayDots events={grouped.get(k) ?? []} />
              </span>
            </button>
          );
        })}
      </div>
      {/* The same grouped list as the wide layout (no inner scroll: the page scrolls). */}
      <div className="border-t">
        <DayAgenda key={dayKey(cursor)} day={cursor} events={dayEvents} onOpenDay={onOpenDay} scroll={false} />
      </div>
    </div>
  );
}
