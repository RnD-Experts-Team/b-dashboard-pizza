"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, addMonths, dayKey, isSameMonth, rangeContains, startOfMonth, viewRange } from "@/lib/calendar/dates";
import { fiscalPeriodRange, fiscalWeekOf, WEEKS_PER_PERIOD } from "@/lib/calendar/fiscal";
import type { CalendarEvent, CalendarView } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { MiniMonth } from "./mini-month";
import { useCalendarFormat } from "./use-calendar-format";

/** The rail draws no event dots: dots would cost one more set of feed requests per month shown. */
const NO_EVENTS = new Map<string, CalendarEvent[]>();

/**
 * Where the open day sits in its Little Caesars period: the period's dates and
 * its four weeks, the open one marked. A week jumps to its Tuesday.
 */
function PeriodCard({ cursor, onPick }: { cursor: Date; onPick: (key: string) => void }) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const open = fiscalWeekOf(cursor);
  const current = fiscalWeekOf(now);
  const range = fiscalPeriodRange(open.year, open.period);
  const firstWeek = (open.period - 1) * WEEKS_PER_PERIOD + 1;

  return (
    <section aria-label={t("rail.period", { period: open.period })} className="rounded-xl border bg-card p-3 text-card-foreground shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">{t("rail.period", { period: open.period })}</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">{t("rail.fiscalYear", { year: open.year })}</span>
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{f.range(range.start, range.end, { month: "short", day: "numeric" })}</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => {
          const week = firstWeek + i;
          const start = addDays(range.start, i * 7);
          const isOpen = week === open.week;
          const isNow = open.year === current.year && week === current.week;
          const passed = open.year < current.year || (open.year === current.year && week < current.week);
          return (
            <button
              key={week}
              type="button"
              onClick={() => onPick(dayKey(start))}
              aria-label={t("rail.goWeek", { week })}
              aria-current={isOpen ? "true" : undefined}
              title={f.fiscalLabel(start)}
              className="group/wk flex flex-col items-center gap-1 rounded-md py-1 outline-none transition-colors duration-150 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  isNow ? "bg-primary" : passed ? "bg-foreground/35" : "bg-muted",
                  isOpen && !isNow && "ring-2 ring-primary/40",
                )}
              />
              <span className={cn("text-[10px] tabular-nums", isOpen ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {f.fiscalWeekShort(start)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("rail.weekOf", { n: open.weekInPeriod, total: WEEKS_PER_PERIOD })}</p>
    </section>
  );
}

/**
 * The column beside the calendar (wide screens, like Google Calendar's): a small
 * month with Little Caesars week numbers to jump to any day, and where the open
 * day sits in its period. The small month pages on its own and follows the open
 * day whenever that leaves the month shown.
 */
export function CalendarRail({
  view,
  cursor,
  onPick,
  className,
}: {
  view: CalendarView;
  cursor: Date;
  onPick: (key: string) => void;
  className?: string;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const [month, setMonth] = useState(() => startOfMonth(cursor));
  // Follow the open day when it moves into a month the rail isn't showing.
  const [followed, setFollowed] = useState(() => dayKey(cursor));
  const cursorKey = dayKey(cursor);
  if (cursorKey !== followed) {
    setFollowed(cursorKey);
    if (!isSameMonth(cursor, month)) setMonth(startOfMonth(cursor));
  }
  // Band the open day or week; a whole month or year band would just be noise.
  const highlight = useMemo(() => {
    if (view !== "day" && view !== "week") return undefined;
    const open = viewRange(view, cursor);
    return (d: Date) => rangeContains(open, d);
  }, [view, cursor]);

  return (
    <aside aria-label={t("rail.label")} className={cn("w-64 shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain", className)}>
      <section className="rounded-xl border bg-card p-3 text-card-foreground shadow-xs">
        <div className="mb-1 flex items-center justify-between ps-1">
          <h3 className="font-heading text-sm font-semibold">{f.format(month, { month: "long", year: "numeric" })}</h3>
          <div className="flex">
            <Button variant="ghost" size="icon-xs" aria-label={t("toolbar.prevMonth")} onClick={() => setMonth((m) => addMonths(m, -1))}>
              <ChevronLeft className="size-3.5 rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label={t("toolbar.nextMonth")} onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </Button>
          </div>
        </div>
        <MiniMonth month={month} grouped={NO_EVENTS} onPick={onPick} highlight={highlight} weekNumbers />
      </section>
      <PeriodCard cursor={cursor} onPick={onPick} />
    </aside>
  );
}
