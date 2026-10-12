"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay, isSameMonth, isWeekend, monthGrid } from "@/lib/calendar/dates";
import { byDay, lanes } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { AgendaRow, CalendarEmpty, DayDots, EventBar, LaneCell, MoreButton } from "../event-parts";
import { useCalendarFormat } from "../use-calendar-format";

const LANE = 22; // px per lane (20px item + 2px gap)
const HEAD = 30; // px for the day-number strip
const WEEKDAY_ROW = 33; // px for the weekday header
/** Smallest week row: the date strip + one lane. Below this the month scrolls. */
const MIN_ROW = HEAD + LANE + 8;

/** How many lanes fit in a week row when the month fills `hostHeight`. */
function lanesFor(hostHeight: number, weeks: number): number {
  const rowH = Math.max(MIN_ROW, (hostHeight - WEEKDAY_ROW) / weeks);
  return Math.max(1, Math.min(8, Math.floor((rowH - HEAD - 6) / LANE)));
}

function WeekdayHeader({ style }: { style: "short" | "narrow" }) {
  const f = useCalendarFormat();
  return (
    <div className="grid shrink-0 grid-cols-7 border-b">
      {f.weekdayNames(style).map((n, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-2.5 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-3 sm:text-start sm:text-[10px]",
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
  maxLanes,
  cursor,
  last,
  onOpenDay,
}: {
  days: Date[];
  events: CalendarEvent[];
  maxLanes: number;
  cursor: Date;
  last: boolean;
  onOpenDay: (key: string) => void;
}) {
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const lay = useMemo(() => lanes(days, events, maxLanes, true), [days, events, maxLanes]);
  const grouped = useMemo(() => byDay(events), [events]);

  return (
    <div
      className={cn("relative grid min-h-0 grid-cols-7", !last && "border-b")}
      style={{ gridTemplateRows: `${HEAD}px repeat(${maxLanes}, ${LANE}px) minmax(0, 1fr)` }}
    >
      {days.map((d, i) => {
        const k = dayKey(d);
        const outside = !isSameMonth(d, cursor);
        const today = isSameDay(d, now);
        const count = grouped.get(k)?.length ?? 0;
        return (
          <div
            key={k}
            className={cn(
              "group/cell flex min-w-0 flex-col transition-colors duration-150 hover:bg-muted/40",
              i > 0 && "border-s",
              isWeekend(d) && "cal-hatch",
              outside && "bg-muted/30",
              today && "bg-muted/50",
            )}
            style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
          >
            <div className="flex h-[30px] items-center justify-between px-1.5">
              <button
                type="button"
                onClick={() => onOpenDay(k)}
                aria-label={f.longDate(d)}
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
                  today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90" : "font-medium hover:bg-accent",
                  outside && !today && "text-muted-foreground/60",
                )}
              >
                {d.getDate()}
              </button>
              {count > 0 && (
                <span className="pe-1 text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/cell:opacity-100">
                  {f.countLabel(count)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {lay.items.map((it) => (
        <LaneCell key={`${it.ev.id}-${it.col}`} col={it.col + 1} span={it.span} lane={it.lane + 2}>
          <EventBar item={it} />
        </LaneCell>
      ))}
      {lay.more.map((m) => (
        <LaneCell key={`more-${m.key}`} col={m.col + 1} span={1} lane={m.lane + 2}>
          <MoreButton more={m} />
        </LaneCell>
      ))}
    </div>
  );
}

/**
 * Month view (sm+): one grid per week row. Multi-day events are continuous
 * bars, timed events fill the free lanes under them, and the lane count adapts
 * to the card's height — rows stretch to fill it, with "+N more" on overflow.
 */
export function MonthView({
  cursor,
  events,
  onOpenDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onOpenDay: (key: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [maxLanes, setMaxLanes] = useState(3);
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
    <div ref={hostRef} className="flex h-full flex-col">
      <WeekdayHeader style="short" />
      <div className="grid flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(${MIN_ROW}px, 1fr))` }}>
        {weeks.map((days, wi) => (
          <WeekRow
            key={dayKey(days[0])}
            days={days}
            events={events}
            maxLanes={maxLanes}
            cursor={cursor}
            last={wi === weeks.length - 1}
            onOpenDay={onOpenDay}
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
}: {
  cursor: Date;
  events: CalendarEvent[];
  onSelectDay: (key: string) => void;
}) {
  const t = useTranslations("calendar");
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
      <div className="space-y-1 border-t p-3">
        <div className="flex items-baseline justify-between px-2 pb-1">
          <h3 className="font-heading text-sm font-semibold">{f.shortDate(cursor)}</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{f.countLabel(dayEvents.length)}</span>
        </div>
        {dayEvents.length ? (
          dayEvents.map((ev) => <AgendaRow key={ev.id} ev={ev} day={cursor} />)
        ) : (
          <CalendarEmpty title={t("noEvents")} hint={t("noEventsHint")} compact />
        )}
      </div>
    </div>
  );
}
