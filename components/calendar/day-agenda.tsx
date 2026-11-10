"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/calendar/dates";
import { actionCount, agendaSections, itemAction, type AgendaSection } from "@/lib/calendar/day-agenda";
import { groupStats, needsAction } from "@/lib/calendar/grouping";
import { isPast } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { CalendarEmpty, EVENT_FOCUS, EventDot } from "./event-parts";
import { usePeek } from "./event-peek";
import { EventSigns } from "./event-signs";
import { RowStatus } from "./peek-cards";
import { useCalendarFormat } from "./use-calendar-format";

/** The "needs attention" count: just a red number — the one colour on this panel. */
function ActionCount({ n }: { n: number }) {
  const t = useTranslations("calendar");
  return (
    <span className="shrink-0 text-xs font-medium tabular-nums text-destructive">
      {n}
      <span className="sr-only">{t("group.needsAction", { n })}</span>
    </span>
  );
}

/**
 * One event: its name, then the time and store under it. Only what needs a look
 * gets a mark on the right (`RowStatus`). The category is the section's, so the row
 * doesn't repeat it.
 */
function PanelRow({ ev }: { ev: CalendarEvent }) {
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const { peekProps } = usePeek();
  const past = !ev.allDay && isPast(ev, now);
  const sub = [ev.allDay ? null : `${f.time(ev.start)} – ${f.time(ev.end)}`, ev.store.name].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      {...peekProps({ type: "event", id: ev.id }, { side: "inline" })}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors duration-150 hover:bg-muted/70",
        EVENT_FOCUS,
        past && "opacity-70",
      )}
    >
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-start text-sm font-medium leading-snug">
          {f.title(ev)}
        </span>
        {sub && (
          <span dir="auto" className="block truncate text-start text-xs tabular-nums text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      <EventSigns ev={ev} />
      <RowStatus status={ev.status} />
    </button>
  );
}

/**
 * The same kind of event in several stores as ONE row ("Cleaning · 38 stores"),
 * opening to the stores — needs-attention ones first. A store's row opens that
 * event's own card.
 */
function GroupItem({ ev }: { ev: CalendarEvent }) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const { peekProps } = usePeek();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const members = useMemo(
    () =>
      [...(ev.members ?? [])].sort(
        (a, b) => Number(needsAction(b.status)) - Number(needsAction(a.status)) || a.store.name.localeCompare(b.store.name),
      ),
    [ev.members],
  );
  const { stores } = groupStats(members);
  const action = itemAction(ev);
  const label = ev.title ?? ev.typeLabel ?? t(`categories.${ev.category}`);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors duration-150 hover:bg-muted/70",
          EVENT_FOCUS,
        )}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
        )}
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-sm font-medium leading-snug">
            {label}
          </span>
          <span className="block text-xs tabular-nums text-muted-foreground">{t("group.stores", { n: stores })}</span>
        </span>
        {action > 0 && <ActionCount n={action} />}
      </button>
      {open && (
        <ul id={listId} aria-label={t("group.listLabel")} className="ms-4 border-s ps-1.5">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                {...peekProps({ type: "event", id: m.id }, { side: "inline" })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors duration-150 hover:bg-muted/70",
                  EVENT_FOCUS,
                )}
              >
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-start text-xs font-medium">
                    {m.store.name || m.store.code}
                  </span>
                  <span dir="auto" className="block truncate text-start text-[11px] tabular-nums text-muted-foreground">
                    {f.title(m)}
                  </span>
                </span>
                <EventSigns ev={m} />
                <RowStatus status={m.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One category: a header with its counts, and its items. Collapsible. */
function Section({ section }: { section: AgendaSection }) {
  const t = useTranslations("calendar");
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  return (
    <section className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors duration-150 hover:bg-muted/50",
          EVENT_FOCUS,
        )}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
        )}
        <EventDot category={section.category} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{t(`categories.${section.category}`)}</span>
        {section.action > 0 && <ActionCount n={section.action} />}
        <span className="text-xs tabular-nums text-muted-foreground">{section.total}</span>
      </button>
      {open && (
        <div id={bodyId} className="space-y-0.5 pt-0.5">
          {section.items.map((ev) => (ev.members ? <GroupItem key={ev.id} ev={ev} /> : <PanelRow key={ev.id} ev={ev} />))}
        </div>
      )}
    </section>
  );
}

/**
 * Every event of one day, for views whose cells can't hold them (Month): grouped
 * by category, the same kind of event across stores rolled up into one row, what
 * needs attention first. `scroll` — once the Month card is wide enough for a side
 * column (64rem, a container query) the list scrolls inside it; elsewhere it just
 * flows with the page.
 */
export function DayAgenda({
  day,
  events,
  onOpenDay,
  scroll = true,
}: {
  day: Date;
  events: readonly CalendarEvent[];
  onOpenDay?: (key: string) => void;
  scroll?: boolean;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const sections = useMemo(() => agendaSections(events), [events]);
  const action = useMemo(() => actionCount(events), [events]);

  return (
    <div className={cn("flex flex-col", scroll && "@[64rem]:h-full @[64rem]:min-h-0")}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold">{f.shortDate(day)}</h3>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {f.countLabel(events.length)}
            {action > 0 && (
              <>
                {" · "}
                <span className="font-medium text-destructive">{t("group.needsAction", { n: action })}</span>
              </>
            )}
          </p>
        </div>
        {onOpenDay && (
          <Button variant="ghost" size="sm" className="-me-2 h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => onOpenDay(dayKey(day))}>
            {t("pop.openDay")}
            <ArrowRight className="size-3 rtl:rotate-180" />
          </Button>
        )}
      </div>
      {/* `relative`: the screen-reader-only spans in the rows are absolutely positioned — without a
          positioned parent they escape this scroller and stretch the page's scroll area. */}
      <div className={cn("relative p-2", scroll && "@[64rem]:min-h-0 @[64rem]:flex-1 @[64rem]:overflow-y-auto @[64rem]:overscroll-contain")}>
        {sections.length ? (
          sections.map((s) => <Section key={s.category} section={s} />)
        ) : (
          <CalendarEmpty title={t("noEvents")} hint={t("noEventsHint")} compact />
        )}
      </div>
    </div>
  );
}
