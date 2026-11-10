"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dayKey, isSameMonth } from "@/lib/calendar/dates";
import { heatLevels, type DayCount, type HeatLevel } from "@/lib/calendar/day-counts";
import { byDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { HEAT_CLASS, MiniMonth } from "../mini-month";
import { useCalendarFormat } from "../use-calendar-format";

const LEVELS: readonly HeatLevel[] = [1, 2, 3, 4];

/**
 * Year view: 12 mini months, with one colour in it. A day is tinted only when it
 * has something overdue or missed, in four steps by how much it stood out against
 * the rest of the year (`heatLevels`); everything else stays plain, and today is
 * the one filled circle. Hovering a day shows its numbers and the stores that need
 * attention; clicking a day (or a month's name) opens the Month view on it, where
 * the day's panel lists every event (the Year view itself only holds counts).
 * Events created here before the Toolbox writes (`events`) still add their dots.
 */
export function YearView({
  cursor,
  events,
  counts,
  onOpenMonth,
}: {
  cursor: Date;
  events: CalendarEvent[];
  counts: Map<string, DayCount>;
  /** A day key opens that day in the Month view; a month's first day opens the month. */
  onOpenMonth: (key: string) => void;
}) {
  const t = useTranslations("calendar.year");
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const grouped = useMemo(() => byDay(events), [events]);
  const levels = useMemo(() => heatLevels(counts), [counts]);
  const year = cursor.getFullYear();

  return (
    <div className="flex min-h-full flex-col">
      {/* Nothing counted (no source answered): no legend to explain. */}
      {counts.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          <p>{levels.size > 0 ? t("legend.title") : t("legend.none")}</p>
          {levels.size > 0 && (
            <div aria-hidden className="flex items-center gap-2">
              <span>{t("legend.less")}</span>
              <span className="flex items-center gap-1">
                <span className="size-3 rounded-full ring-1 ring-inset ring-border" />
                {LEVELS.map((l) => (
                  <span key={l} className={cn("size-3 rounded-full", HEAT_CLASS[l])} />
                ))}
              </span>
              <span>{t("legend.more")}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid flex-1 content-start gap-x-8 gap-y-8 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const month = new Date(year, m, 1);
          const current = isSameMonth(month, now);
          return (
            <section key={m} aria-label={f.monthName(month)}>
              <button
                type="button"
                onClick={() => onOpenMonth(dayKey(month))}
                className="-ms-1.5 mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-heading text-sm font-semibold outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {current && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                {f.monthName(month)}
              </button>
              <MiniMonth month={month} grouped={grouped} counts={counts} levels={levels} onPick={onOpenMonth} peek showOutside={false} cellClass="h-7" />
            </section>
          );
        })}
      </div>
    </div>
  );
}
