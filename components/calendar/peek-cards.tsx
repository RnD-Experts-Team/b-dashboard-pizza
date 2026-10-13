"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Clock, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/calendar/categories";
import { dayKey, startOfDay } from "@/lib/calendar/dates";
import { isMultiDay, lastDay, spanDays } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { AvatarStack, EventDot, StatusBadge } from "./event-parts";
import { useCalendarFormat } from "./use-calendar-format";

function Row({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Full event details. "Open day" lands on today for an ongoing multi-day event. */
export function EventPeekCard({
  ev,
  onOpenDay,
  onEdit,
  onDelete,
}: {
  ev: CalendarEvent;
  onOpenDay: (key: string) => void;
  /** Only events created in the calendar can be edited or deleted. */
  onEdit?: (ev: CalendarEvent) => void;
  onDelete?: (ev: CalendarEvent) => void;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const cat = categoryOf(ev.category);

  let subtitle = "";
  if (ev.meta?.age != null) subtitle = `${ev.meta.role} · ${t("pop.turns", { n: ev.meta.age })}`;
  else if (ev.meta?.years != null) subtitle = `${ev.meta.role} · ${t("pop.years", { n: ev.meta.years })}`;

  const today = startOfDay(new Date(now));
  const ongoing = ev.start < today && lastDay(ev) >= today;
  const target = dayKey(ongoing ? today : ev.start);
  const editable = ev.source === "user";

  return (
    <div className="w-72 space-y-3 p-3" aria-label={f.title(ev)}>
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
        <Row icon={MapPin}>
          {ev.store.name} <span className="tabular-nums text-muted-foreground">{ev.store.code}</span>
        </Row>
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
        <Button variant="ghost" size="sm" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={() => onOpenDay(target)}>
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
                "flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-start text-xs outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60",
              )}
            >
              <EventDot category={ev.category} />
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                {ev.allDay ? f.when(ev, date) : f.time(ev.start)}
              </span>
              <span dir="auto" className="truncate text-start font-medium">
                {f.title(ev)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
