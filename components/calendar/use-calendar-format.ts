"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, startOfMonth, startOfWeek, weekDays } from "@/lib/calendar/dates";
import { dayIndex, isMultiDay, spanDays } from "@/lib/calendar/layout";
import type { CalendarEvent, CalendarView } from "@/lib/calendar/types";

/** LTR isolate marks: an RTL paragraph can never flip a time range to "11:00 - 09:00". */
const LRI = "⁦";
const PDI = "⁩";

/**
 * Locale-aware formatting for the calendar. Arabic keeps Latin digits
 * (`-u-nu-latn`) so tabular numbers line up across languages.
 *
 * Copy rule: no em/en dashes in visible text — Intl's range separator is
 * replaced with " - ".
 */
export function useCalendarFormat() {
  const locale = useLocale();
  const t = useTranslations("calendar");

  return useMemo(() => {
    const intlLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
    const cache = new Map<string, Intl.DateTimeFormat>();
    const fmt = (opts: Intl.DateTimeFormatOptions) => {
      const key = JSON.stringify(opts);
      let f = cache.get(key);
      if (!f) {
        f = new Intl.DateTimeFormat(intlLocale, opts);
        cache.set(key, f);
      }
      return f;
    };

    const format = (d: Date, opts: Intl.DateTimeFormatOptions) => fmt(opts).format(d);
    const time = (d: Date) => format(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const range = (a: Date, b: Date, opts: Intl.DateTimeFormatOptions) =>
      fmt(opts).formatRange(a, b).replace(/\s*[–—]\s*/g, " - ");

    const duration = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (!h) return t("duration.m", { n: m });
      if (!m) return t("duration.h", { n: h });
      return t("duration.hm", { h, m });
    };

    const title = (ev: CalendarEvent) =>
      ev.titleKey ? t(`ev.${ev.titleKey}`, ev.titleVars) : (ev.title ?? "");

    const timeRange = (a: Date, b: Date) => `${LRI}${time(a)} - ${time(b)}${PDI}`;

    return {
      locale: intlLocale,
      format,
      time,
      timeRange,
      range,
      duration,
      title,
      hourLabel: (h: number) => time(new Date(2000, 0, 1, h)),
      /** Weekday names in display order (week starts Monday). */
      weekdayNames: (style: "narrow" | "short" | "long" = "short") => {
        const base = startOfWeek(new Date(2024, 0, 10));
        return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), { weekday: style }));
      },
      monthName: (d: Date, style: "long" | "short" = "long") => format(d, { month: style }),
      longDate: (d: Date) => format(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      shortDate: (d: Date) => format(d, { weekday: "short", month: "short", day: "numeric" }),
      countLabel: (n: number) => t("eventCount", { n }),
      /** "All day", "Day 2/3" (multi-day, when a day is given) or "09:00 - 11:00". */
      when: (ev: CalendarEvent, day?: Date) => {
        if (ev.allDay && day && isMultiDay(ev)) return t("dayOf", { i: dayIndex(ev, day), n: spanDays(ev) });
        return ev.allDay ? t("allDay") : timeRange(ev.start, ev.end);
      },
      /** Toolbar title: month + year (just the year in Year view). */
      titleLabel: (view: CalendarView, cursor: Date) =>
        view === "year" ? format(cursor, { year: "numeric" }) : format(cursor, { month: "long", year: "numeric" }),
      /** Exact span the view covers, for the date-range button. */
      rangeLabel: (view: CalendarView, cursor: Date) => {
        const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
        if (view === "day") return format(cursor, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        if (view === "week") {
          const days = weekDays(cursor);
          return range(days[0], days[6], opts);
        }
        if (view === "month") {
          return range(startOfMonth(cursor), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), opts);
        }
        return range(new Date(cursor.getFullYear(), 0, 1), new Date(cursor.getFullYear(), 11, 31), opts);
      },
    };
  }, [locale, t]);
}

export type CalendarFormat = ReturnType<typeof useCalendarFormat>;
