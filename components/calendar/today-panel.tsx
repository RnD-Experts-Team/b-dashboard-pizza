"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MINUTE } from "@/lib/calendar/dates";
import { needsAction } from "@/lib/calendar/grouping";
import { eventPriority, isLive, isPast } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useReminderTargets } from "@/lib/hooks/use-calendar-events";
import { EventDot } from "./event-parts";
import { EventSigns, ReminderTargetsProvider } from "./event-signs";
import { useCalendarFormat } from "./use-calendar-format";

/** Attention rows shown before "+N more". */
const ATTENTION_ROWS = 4;

/** Which edges of a vertical scroller have hidden content. */
function useVerticalEdges(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setEdges({
        top: el.scrollTop > 1,
        bottom: el.scrollHeight - el.clientHeight - el.scrollTop > 1,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, edges };
}

/**
 * The topbar's "Today" panel — a glance, not a list, in the order a person
 * needs it:
 *
 * 1. a hero card for what matters NOW: the live event (with a progress bar
 *    and time left) or the next one (with a countdown);
 * 2. what NEEDS ATTENTION (overdue or missed), a few rows with "+N more" —
 *    the same items the topbar badge counts, so the two never disagree;
 * 3. today's notable all-day items (tasks, visits), then what is still to
 *    come, as compact one-line rows;
 * 4. the daily ROUTINE every store repeats (per-store summaries, sales) and
 *    the finished events fold away, collapsed until asked for.
 *
 * Tasks carry their signs (started / submitted / a reminder I set). Today's
 * events ignore the page's filters and search. Rows deep-link to today's Day
 * view; the footer adds an event right here or opens the calendar.
 */
export function TodayPanel({
  events,
  now,
  unseen,
  onMarkSeen,
  onNavigate,
  onNewEvent,
}: {
  events: CalendarEvent[];
  now: number;
  unseen: number;
  onMarkSeen: () => void;
  onNavigate: () => void;
  /** Opens the add-event dialog right here, on whatever page this is. */
  onNewEvent: () => void;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const locale = useLocale();
  const base = `/${locale}/dashboard/calendar`;
  const dayHref = `${base}?view=day`;
  const today = new Date(now);
  const [showEarlier, setShowEarlier] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);

  // My reminders by the event they were made from, for the signs on the rows — including
  // ones that ring on another day (a reminder set today for tomorrow still marks today's event).
  const reminders = useReminderTargets(events);

  const groups = useMemo(() => {
    const timed = events.filter((e) => !e.allDay);
    const hero = timed.find((e) => isLive(e, now)) ?? timed.find((e) => +e.start > now) ?? null;
    const others = events.filter((e) => e !== hero);
    const attention = others.filter((e) => needsAction(e.status));
    const rest = others.filter((e) => !needsAction(e.status));
    const restTimed = rest.filter((e) => !e.allDay);
    const restAllDay = rest.filter((e) => e.allDay);
    return {
      hero,
      attention,
      // Tasks, visits and the like stay in view; per-store daily summaries and sales fold away.
      allDay: restAllDay.filter((e) => eventPriority(e) >= 2),
      routine: restAllDay.filter((e) => eventPriority(e) < 2),
      later: restTimed.filter((e) => !isPast(e, now)),
      earlier: restTimed.filter((e) => isPast(e, now)),
      wrappedUp: timed.length > 0 && timed.every((e) => isPast(e, now)),
    };
  }, [events, now]);

  const attentionTotal = useMemo(() => events.filter((e) => needsAction(e.status)).length, [events]);

  // The store only earns space on a row when the list actually mixes stores
  // (company-wide events have no store and don't count).
  const mixedStores = useMemo(
    () => new Set(events.filter((e) => !e.companyWide).map((e) => e.store.code)).size > 1,
    [events],
  );

  const { ref: listRef, edges } = useVerticalEdges([events.length, showEarlier, showRoutine]);
  const fade = 20;
  const mask =
    edges.top || edges.bottom
      ? `linear-gradient(to bottom, ${edges.top ? "transparent" : "#000"} 0, #000 ${edges.top ? fade : 0}px, #000 calc(100% - ${edges.bottom ? fade : 0}px), ${edges.bottom ? "transparent" : "#000"} 100%)`
      : undefined;

  const minutesTo = (ms: number) => Math.max(1, Math.round(ms / MINUTE));

  /** One compact row: time · dot · title (· store when mixed) · signs · status. */
  const row = (ev: CalendarEvent, opts: { muted?: boolean } = {}) => (
    <li key={ev.id}>
      <Link
        href={dayHref}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-start outline-none transition-colors duration-150 hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
          opts.muted && "opacity-60 hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">
          {ev.allDay ? (ev.start < today && ev.end > today ? f.when(ev, today) : "") : f.time(ev.start)}
        </span>
        <EventDot category={ev.category} className="size-2" />
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-sm font-medium leading-tight">
            {f.title(ev)}
          </span>
          {mixedStores && <span className="block truncate text-[11px] text-muted-foreground">{ev.store.name}</span>}
        </span>
        <EventSigns ev={ev} />
        {needsAction(ev.status) && (
          <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px text-[10px] font-semibold text-destructive dark:bg-destructive/20">
            {ev.status === "missed" ? t("status.missed") : t("topbar.overdue")}
          </span>
        )}
        {ev.status === "done" && <Check className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("status.done")} />}
      </Link>
    </li>
  );

  const label = (text: string, extra?: React.ReactNode) => (
    <h4 className="flex items-baseline justify-between px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
      {text}
      {extra}
    </h4>
  );

  /** A folded group: a quiet toggle row, then its rows. */
  const fold = (text: string, open: boolean, toggle: () => void, rows: CalendarEvent[], muted = false) => (
    <div className="pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
        {text}
      </button>
      {open && <ul>{rows.map((ev) => row(ev, { muted }))}</ul>}
    </div>
  );

  const hero = groups.hero;
  const live = hero ? isLive(hero, now) : false;
  const progress = hero && live ? Math.min(100, ((now - +hero.start) / (+hero.end - +hero.start)) * 100) : 0;
  const shownAttention = groups.attention.slice(0, ATTENTION_ROWS);
  const moreAttention = groups.attention.length - shownAttention.length;

  return (
    <ReminderTargetsProvider value={reminders}>
      <div className="w-[22rem] max-w-[calc(100vw-1rem)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-semibold leading-tight">{t("topbar.title")}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {f.shortDate(today)}
              <span className="mx-1.5 opacity-50">·</span>
              {attentionTotal > 0 ? (
                <span className="font-medium tabular-nums text-destructive">{t("topbar.needAttention", { n: attentionTotal })}</span>
              ) : (
                <span className="tabular-nums">{f.countLabel(events.length)}</span>
              )}
            </p>
          </div>
          {unseen > 0 && (
            <Button variant="ghost" size="xs" className="-me-1 shrink-0 text-muted-foreground" onClick={onMarkSeen}>
              {t("topbar.markSeen")}
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 pb-8 pt-4 text-center">
            <span className="mb-2 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="size-5" />
            </span>
            <p className="text-sm font-medium">{t("topbar.empty")}</p>
            <p className="text-xs text-muted-foreground">{t("topbar.emptyHint")}</p>
          </div>
        ) : (
          <>
            {/* Hero: what matters right now */}
            {hero ? (
              <Link
                href={dayHref}
                onClick={onNavigate}
                className="group mx-3 mb-2 block rounded-xl border bg-muted/40 p-3 text-start outline-none transition-colors duration-150 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {live && (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60 motion-reduce:animate-none" />
                      <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                    </span>
                  )}
                  {live ? t("topbar.happeningNow") : t("topbar.upNext")}
                  <span className="ms-auto font-medium normal-case tracking-normal tabular-nums">
                    {live
                      ? t("topbar.timeLeft", { d: f.duration(minutesTo(+hero.end - now)) })
                      : t("topbar.startsIn", { d: f.duration(minutesTo(+hero.start - now)) })}
                  </span>
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <EventDot category={hero.category} className="size-2" />
                  <span dir="auto" className="min-w-0 flex-1 truncate text-start text-[15px] font-semibold leading-tight">
                    {f.title(hero)}
                  </span>
                  <EventSigns ev={hero} />
                </span>
                <span className="mt-1 block truncate text-xs tabular-nums text-muted-foreground">
                  {f.timeRange(hero.start, hero.end)}
                  {mixedStores && <> · {hero.store.name}</>}
                </span>
                {live && (
                  <span aria-hidden className="mt-3 block h-1 overflow-hidden rounded-full bg-border">
                    <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${progress}%` }} />
                  </span>
                )}
              </Link>
            ) : groups.wrappedUp && attentionTotal === 0 ? (
              <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Check className="size-3.5 shrink-0" />
                {t("topbar.allDone")}
              </p>
            ) : null}

            {/* Grouped list */}
            <div
              ref={listRef}
              className="cal-no-scrollbar max-h-[min(19rem,calc(var(--radix-popover-content-available-height,100vh)-17rem))] overflow-y-auto overscroll-contain px-1.5 pb-1"
              style={{ maskImage: mask, WebkitMaskImage: mask }}
            >
              {shownAttention.length > 0 && (
                <>
                  {label(t("topbar.attentionGroup"))}
                  <ul>{shownAttention.map((ev) => row(ev))}</ul>
                  {moreAttention > 0 && (
                    <Link
                      href={dayHref}
                      onClick={onNavigate}
                      className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {t("more", { n: moreAttention })}
                    </Link>
                  )}
                </>
              )}
              {groups.allDay.length > 0 && (
                <>
                  {label(t("topbar.allDayGroup"))}
                  <ul>{groups.allDay.map((ev) => row(ev))}</ul>
                </>
              )}
              {groups.later.length > 0 && (
                <>
                  {label(t("topbar.later"))}
                  <ul>{groups.later.map((ev) => row(ev))}</ul>
                </>
              )}
              {groups.routine.length > 0 &&
                fold(t("topbar.routine", { n: groups.routine.length }), showRoutine, () => setShowRoutine((v) => !v), groups.routine)}
              {groups.earlier.length > 0 &&
                fold(
                  showEarlier ? t("topbar.hideEarlier") : t("topbar.showEarlier", { n: groups.earlier.length }),
                  showEarlier,
                  () => setShowEarlier((v) => !v),
                  groups.earlier,
                  true,
                )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="grid grid-cols-2 gap-1.5 border-t p-2">
          <Button variant="outline" size="sm" onClick={onNewEvent}>
            <Plus className="size-3.5" />
            {t("newEvent")}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={base} onClick={onNavigate}>
              {t("topbar.openCalendar")}
              <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </ReminderTargetsProvider>
  );
}
