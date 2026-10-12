"use client";

import { useMemo, type MutableRefObject } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameDay } from "@/lib/calendar/dates";
import { byDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { AgendaRow, CalendarEmpty } from "../event-parts";
import { useCalendarFormat } from "../use-calendar-format";
import { TimeGrid, type GridScroll } from "./time-grid";

function NowDivider() {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  return (
    <div aria-hidden className="flex items-center gap-2 px-2 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">{t("now")}</span>
      <span className="h-px flex-1 bg-destructive/40" />
      <span className="text-[10px] font-medium tabular-nums text-destructive">{f.time(new Date(now))}</span>
    </div>
  );
}

/** The day as a quiet timeline, with a "Now" divider between past and upcoming. */
function Schedule({ day, events }: { day: Date; events: CalendarEvent[] }) {
  const t = useTranslations("calendar");
  const now = useCalendarClock();
  if (!events.length) {
    return <CalendarEmpty title={t("noEvents")} hint={t("noEventsHint")} compact />;
  }
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);
  const nowIndex = isSameDay(day, new Date(now)) ? timed.findIndex((e) => +e.start > now) : -2;
  return (
    <>
      {allDay.length > 0 && (
        <div className="space-y-0.5 border-b pb-2">
          {allDay.map((ev) => (
            <AgendaRow key={ev.id} ev={ev} day={day} side="inline" />
          ))}
        </div>
      )}
      <div className="space-y-0.5 pt-2">
        {timed.map((ev, i) => (
          <div key={ev.id}>
            {i === nowIndex && <NowDivider />}
            <AgendaRow ev={ev} day={day} side="inline" />
          </div>
        ))}
        {nowIndex === -1 && <NowDivider />}
      </div>
    </>
  );
}

/**
 * Day view: a roomy hour grid (taller hours, side-by-side overlaps, blocks
 * show store and people) with multi-day events as "Day i/n" bars, plus the
 * day's schedule as a timeline on lg+.
 */
export function DayView({
  cursor,
  events,
  compact,
  onOpenDay,
  scroll,
  scrollMemory,
}: {
  cursor: Date;
  events: CalendarEvent[];
  compact: boolean;
  onOpenDay: (key: string) => void;
  scroll: GridScroll;
  scrollMemory: MutableRefObject<number | null>;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const dayEvents = useMemo(() => byDay(events).get(dayKey(cursor)) ?? [], [events, cursor]);

  return (
    <div
      className={cn("grid lg:grid-cols-[minmax(0,1fr)_19rem]", !compact && "h-full")}
      style={compact ? undefined : { gridTemplateRows: "minmax(0, 1fr)" }}
    >
      <TimeGrid
        days={[cursor]}
        events={dayEvents}
        header={false}
        allDayMax={4}
        hour={64}
        cascade={false}
        rich
        style={compact ? { height: "calc(100dvh - 19rem)", minHeight: "24rem" } : undefined}
        onOpenDay={onOpenDay}
        scroll={scroll}
        scrollMemory={scrollMemory}
      />
      <aside className="hidden min-h-0 flex-col border-s lg:flex">
        <div className="flex shrink-0 items-baseline justify-between border-b px-4 py-3">
          <h3 className="font-heading text-sm font-semibold">{t("schedule")}</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{f.countLabel(dayEvents.length)}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Schedule day={cursor} events={dayEvents} />
        </div>
      </aside>
    </div>
  );
}
