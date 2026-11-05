"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  History,
  Layers,
  ListChecks,
  Lock,
  MapPin,
  Pencil,
  Trash2,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/calendar/categories";
import { dayKey, fromKey, isDayKey, startOfDay } from "@/lib/calendar/dates";
import { feedHref } from "@/lib/calendar/feed-links";
import { COUNT_STATUSES, storesNeedingAttention, type DayCount } from "@/lib/calendar/day-counts";
import { commonCategory, groupStats, needsAction } from "@/lib/calendar/grouping";
import { isMultiDay, lastDay, spanDays } from "@/lib/calendar/layout";
import { EVENT_STATUSES, type CalendarEvent, type EventStatus } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { EventActions } from "./event-actions";
import { usePeek } from "./event-peek";
import { AvatarStack, EventDot, StatusBadge } from "./event-parts";
import { useShowStore } from "./store-label";
import { useCalendarFormat } from "./use-calendar-format";

function Row({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A summary event's numbers: "15 Done · 2 Pending · 2 Overdue" (zeros left out). */
function useCountsLine(ev: CalendarEvent): string | null {
  const t = useTranslations("calendar");
  const c = ev.counts;
  if (!c) return null;
  const parts: string[] = [];
  if (c.employees != null) parts.push(t("feed.employees", { n: c.employees }));
  if (c.managers != null) parts.push(t("feed.managers", { n: c.managers }));
  for (const s of EVENT_STATUSES) {
    const n = (c as Partial<Record<EventStatus, number>>)[s];
    if (n) parts.push(`${n} ${t(`status.${s}`)}`);
  }
  if (c.total != null && c.employees == null) parts.push(t("feed.total", { n: c.total }));
  return parts.length ? parts.join(" · ") : null;
}

/** "Moved from Oct 15 · 09:00" for a rescheduled visit (`extra.rescheduled_from`). */
function useMovedFrom(ev: CalendarEvent): string | null {
  const t = useTranslations("calendar.feed");
  const f = useCalendarFormat();
  const from = ev.extra?.rescheduled_from as { date?: unknown; hour?: unknown } | null | undefined;
  if (!from || typeof from !== "object" || typeof from.date !== "string" || !isDayKey(from.date)) return null;
  const hour = typeof from.hour === "string" ? from.hour.slice(0, 5) : "";
  return t("movedFrom", { when: hour ? `${f.shortDate(fromKey(from.date))} · ${hour}` : f.shortDate(fromKey(from.date)) });
}

/** Full event details. "Open day" lands on today for an ongoing multi-day event. */
export function EventPeekCard({
  ev,
  onOpenDay,
  onEdit,
  onDelete,
  onDone,
  reminders,
  onBack,
}: {
  ev: CalendarEvent;
  onOpenDay: (key: string) => void;
  /** Only events created in the calendar can be edited or deleted. */
  onEdit?: (ev: CalendarEvent) => void;
  onDelete?: (ev: CalendarEvent) => void;
  /** After something was done to the event from its card (a task step, a reminder): close the card. */
  onDone: () => void;
  /** Reminders I already set for this event, to say so on its card. */
  reminders?: readonly CalendarEvent[];
  /** Opened from a group's list: a way back to it. */
  onBack?: () => void;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const locale = useLocale();
  const now = useCalendarClock();
  const cat = categoryOf(ev.category);
  const countsLine = useCountsLine(ev);
  const movedFrom = useMovedFrom(ev);
  const href = feedHref(ev, locale);

  let subtitle = "";
  if (ev.meta?.age != null) subtitle = `${ev.meta.role} · ${t("pop.turns", { n: ev.meta.age })}`;
  else if (ev.meta?.years != null) subtitle = `${ev.meta.role} · ${t("pop.years", { n: ev.meta.years })}`;

  const today = startOfDay(new Date(now));
  const ongoing = ev.start < today && lastDay(ev) >= today;
  const target = dayKey(ongoing ? today : ev.start);
  const editable = ev.source === "user";

  return (
    <div className="w-72 space-y-3 p-3" aria-label={f.title(ev)}>
      {onBack && (
        <Button type="button" variant="ghost" size="sm" className="-ms-1.5 -mt-1 h-6 gap-1 px-1.5 text-xs text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="size-3 rtl:rotate-180" />
          {t("group.backToList")}
        </Button>
      )}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="gap-1.5 border-transparent bg-muted text-[11px] text-muted-foreground">
          <EventDot category={ev.category} />
          <cat.icon className="size-3" />
          {ev.typeLabel ?? t(`categories.${ev.category}`)}
        </Badge>
        {editable ? (
          <span className="text-[11px] text-muted-foreground">{t("editor.yours")}</span>
        ) : (
          <StatusBadge status={ev.status} />
        )}
      </div>

      <div>
        <h3 dir="auto" className="text-start font-heading text-base font-semibold leading-snug">
          {f.title(ev)}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="space-y-2 text-xs">
        <Row icon={Clock}>
          {isMultiDay(ev) ? (
            <span className="tabular-nums">
              {f.range(ev.start, lastDay(ev), { weekday: "short", month: "short", day: "numeric" })}{" "}
              <span className="text-muted-foreground">({t("pop.days", { n: spanDays(ev) })})</span>
            </span>
          ) : (
            <span className="tabular-nums">
              {f.shortDate(ev.start)} <span className="text-muted-foreground">·</span> {f.when(ev)}
            </span>
          )}
        </Row>
        {movedFrom && <Row icon={History}>{movedFrom}</Row>}
        {ev.scope === "private" ? (
          <Row icon={Lock}>{t("feed.privateOnlyYou")}</Row>
        ) : ev.layer === "mine" ? (
          <Row icon={User}>{t("feed.onlyYou")}</Row>
        ) : ev.companyWide ? (
          <Row icon={Building2}>{t("feed.companyWide")}</Row>
        ) : (
          <Row icon={MapPin}>
            {ev.store.name} <span className="tabular-nums text-muted-foreground">{ev.store.code}</span>
          </Row>
        )}
        {/* A public item is one copy per store: say it went to every store, not just this one. */}
        {ev.scope === "public" && <Row icon={Globe}>{t("feed.public")}</Row>}
        {countsLine && (
          <Row icon={ListChecks}>
            <span className="tabular-nums">{countsLine}</span>
          </Row>
        )}
        {ev.people.length > 0 && (
          <Row icon={Users}>
            <div className="flex items-center gap-2">
              <AvatarStack people={ev.people} />
              <span className="truncate text-muted-foreground">{ev.people.join(", ")}</span>
            </div>
          </Row>
        )}
      </div>

      {ev.notes && (
        <p dir="auto" className="line-clamp-3 border-s-2 ps-2 text-start text-xs text-muted-foreground">
          {ev.notes}
        </p>
      )}

      <EventActions ev={ev} onDone={onDone} reminders={reminders} />

      <div className="-mx-1 -mb-1 flex items-center gap-1 border-t pt-2">
        {editable && onEdit && (
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onEdit(ev)}>
            <Pencil className="size-3" />
            {t("editor.edit")}
          </Button>
        )}
        {editable && onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("editor.delete")}
            title={t("editor.delete")}
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(ev)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        {href && (
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Link href={href}>
              {t("feed.open")}
              <ArrowUpRight className="size-3 rtl:-scale-x-100" />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={() => onOpenDay(target)}>
          {t("pop.openDay")}
          <ArrowRight className="size-3 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

/** One row of a group: only what needs a look gets a mark (the tally above says the rest). */
function RowStatus({ status }: { status?: EventStatus }) {
  const t = useTranslations("calendar.status");
  if (!status) return null;
  if (status === "overdue" || status === "missed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-destructive">
        {status === "overdue" ? <TriangleAlert className="size-3" /> : <Ban className="size-3" />}
        {t(status)}
      </span>
    );
  }
  if (status === "done") return <Check className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("done")} />;
  if (status === "in_progress" || status === "cancelled") {
    return <span className="shrink-0 text-[11px] text-muted-foreground">{t(status)}</span>;
  }
  return null;
}

/**
 * All-day roll-ups lead with the store (the title repeats in every row); the
 * "+N" stack of timed events leads with the title and puts the time and store
 * under it. A row opens that event's own card (with its actions, e.g. "Remind
 * me") inside the same popover; the card's "Open" button goes to its page.
 */
function GroupRow({
  ev,
  allDay,
  showStatus,
  onSelect,
}: {
  ev: CalendarEvent;
  allDay: boolean;
  showStatus: boolean;
  onSelect: (ev: CalendarEvent) => void;
}) {
  const f = useCalendarFormat();
  const store = ev.store.name || ev.store.code;
  const primary = allDay ? store : f.title(ev);
  const secondary = allDay ? f.title(ev) : [f.time(ev.start), store].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(ev)}
      className="group/row flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-start outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
    >
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-start text-xs font-medium">
          {primary}
        </span>
        <span dir="auto" className="block truncate text-start text-[11px] tabular-nums text-muted-foreground">
          {secondary}
        </span>
      </span>
      {showStatus && <RowStatus status={ev.status} />}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover/row:text-foreground rtl:rotate-180" />
    </button>
  );
}

/**
 * What a roll-up chip ("Cleaning · 39 stores") or a "+N" stack holds: a tally
 * of statuses, then every event. Rows that need attention come first. Rows open
 * the event's own page.
 */
export function GroupPeekCard({
  events,
  onOpenDay,
  onDone,
  remindersByTarget,
}: {
  events: readonly CalendarEvent[];
  onOpenDay: (key: string) => void;
  onDone: () => void;
  /** My reminders by the event they were made from. */
  remindersByTarget?: ReadonlyMap<string, readonly CalendarEvent[]>;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const { pin } = usePeek();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const first = events[0];
  const common = commonCategory(events);
  const cat = categoryOf(common ?? "other");
  const allDay = events.every((e) => e.allDay);
  const { stores } = groupStats(events);
  // Every row alike ("29 in progress") → the tally says it once; marks only help when rows differ.
  const mixedStatus = new Set(events.map((e) => e.status)).size > 1;

  const sorted = useMemo(
    () =>
      [...events].sort(
        allDay
          ? (a, b) => Number(needsAction(b.status)) - Number(needsAction(a.status)) || a.store.name.localeCompare(b.store.name)
          : (a, b) => +a.start - +b.start || a.store.name.localeCompare(b.store.name),
      ),
    [events, allDay],
  );
  const tally = EVENT_STATUSES.filter((s) => s !== "scheduled" && s !== "info")
    .map((s) => [s, events.filter((e) => e.status === s).length] as const)
    .filter(([, n]) => n > 0);

  const last = events.reduce((a, e) => (+e.end > +a ? e.end : a), first.end);
  const today = startOfDay(new Date(now));
  const ongoing = first.start < today && lastDay(first) >= today;
  const target = dayKey(ongoing ? today : first.start);
  const Icon = common ? cat.icon : Layers;

  // One event picked from the list: its own card, with a way back.
  if (selected) {
    return (
      <EventPeekCard
        ev={selected}
        onOpenDay={onOpenDay}
        onDone={onDone}
        reminders={remindersByTarget?.get(selected.id)}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="w-80 max-w-full p-3" aria-label={t("group.listLabel")}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="gap-1.5 border-transparent bg-muted text-[11px] text-muted-foreground">
          {common && <EventDot category={common} />}
          <Icon className="size-3" />
          {common ? (first.typeLabel ?? t(`categories.${common}`)) : t("group.mixed")}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          {allDay && stores > 1 ? t("group.stores", { n: stores }) : t("group.events", { n: events.length })}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="tabular-nums">
          {allDay ? (
            isMultiDay(first) ? (
              <>
                {f.range(first.start, lastDay(first), { weekday: "short", month: "short", day: "numeric" })}{" "}
                <span className="text-muted-foreground">({t("pop.days", { n: spanDays(first) })})</span>
              </>
            ) : (
              f.shortDate(first.start)
            )
          ) : (
            <>
              {f.shortDate(first.start)} <span className="text-muted-foreground">·</span> {f.timeRange(first.start, last)}
            </>
          )}
        </span>
      </div>

      {tally.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs tabular-nums">
          {tally.map(([s, n]) => (
            <span key={s} className={cn(needsAction(s) ? "font-medium text-destructive" : "text-muted-foreground")}>
              {n} {t(`status.${s}`)}
            </span>
          ))}
        </p>
      )}

      <ul className="-mx-1 mt-2 max-h-72 space-y-px overflow-y-auto overscroll-contain border-t pt-1.5">
        {sorted.map((ev) => (
          <li key={ev.id}>
            <GroupRow
              ev={ev}
              allDay={allDay}
              showStatus={mixedStatus}
              onSelect={(picked) => {
                // The card now holds something to act on: don't let moving the pointer away close it.
                pin();
                setSelected(picked);
              }}
            />
          </li>
        ))}
      </ul>

      <div className="-mx-1 -mb-1 mt-1 flex items-center border-t pt-2">
        <Button variant="ghost" size="sm" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={() => onOpenDay(target)}>
          {t("pop.openDay")}
          <ArrowRight className="size-3 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

/** At most this many stores are named on a Year-view day; the rest are "+N". */
const ATTENTION_NAMES = 8;

/**
 * A Year-view day's numbers (`group=day`): the tally by status, and — with
 * several stores — which stores have something overdue or missed. The events
 * themselves load when the day is opened.
 */
export function DayCountsPeekCard({
  date,
  day,
  storeNames,
  showStores,
  onOpenDay,
}: {
  date: Date;
  day: DayCount;
  /** store number → name, for the attention list. */
  storeNames: ReadonlyMap<string, string>;
  showStores: boolean;
  onOpenDay: (key: string) => void;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const attention = useMemo(() => (showStores ? storesNeedingAttention(day) : []), [day, showStores]);
  const shown = attention.slice(0, ATTENTION_NAMES);
  const rest = attention.length - shown.length;

  return (
    <div className="w-72 max-w-full space-y-2.5 p-3" aria-label={f.shortDate(date)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">{f.shortDate(date)}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{t("year.total", { n: day.total })}</span>
      </div>

      <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs tabular-nums">
        {COUNT_STATUSES.filter((s) => day.byStatus[s]).map((s) => (
          <span key={s} className={cn(needsAction(s) ? "font-medium text-destructive" : "text-muted-foreground")}>
            {day.byStatus[s]} {t(`status.${s}`)}
          </span>
        ))}
      </p>

      {shown.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("year.needAttention")}</p>
          <ul className="space-y-0.5">
            {shown.map((s) => (
              <li key={s.store} className="flex items-center justify-between gap-2 text-xs">
                <span dir="auto" className="min-w-0 truncate text-start">
                  {storeNames.get(s.store) ?? s.store}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-medium tabular-nums text-destructive">
                  <TriangleAlert className="size-3" />
                  {s.count}
                </span>
              </li>
            ))}
          </ul>
          {rest > 0 && <p className="text-xs text-muted-foreground">{t("year.moreStores", { n: rest })}</p>}
        </div>
      )}

      <div className="-mx-1 -mb-1 flex items-center border-t pt-2">
        <Button variant="ghost" size="sm" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={() => onOpenDay(dayKey(date))}>
          {t("pop.openDay")}
          <ArrowRight className="size-3 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

/** Compact list of one day's events ("+N more", year-view day hover). */
export function DayPeekCard({
  date,
  events,
  onOpenDay,
}: {
  date: Date;
  events: readonly CalendarEvent[];
  onOpenDay: (key: string) => void;
}) {
  const f = useCalendarFormat();
  const showStore = useShowStore();
  const key = dayKey(date);
  return (
    <div className="w-64" aria-label={f.shortDate(date)}>
      <div className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-3">
        <h3 className="font-heading text-sm font-semibold">{f.shortDate(date)}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{f.countLabel(events.length)}</span>
      </div>
      <ul className="max-h-64 space-y-px overflow-y-auto px-1.5 pb-1.5">
        {events.map((ev) => (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => onOpenDay(key)}
              className={cn(
                "flex w-full min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-start text-xs outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <EventDot category={ev.category} />
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                  {ev.allDay ? f.when(ev, date) : f.time(ev.start)}
                </span>
                <span dir="auto" className="min-w-0 flex-1 truncate text-start font-medium">
                  {f.title(ev)}
                </span>
              </span>
              {/* Several stores: the full name, under the title (room here that chips don't have). */}
              {showStore && !ev.companyWide && ev.store.name && (
                <span dir="auto" className="truncate ps-[4.375rem] text-start text-[11px] text-muted-foreground">
                  {ev.store.name}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
