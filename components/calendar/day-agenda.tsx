"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/calendar/dates";
import { actionCount, agendaSections, itemAction, type AgendaSection } from "@/lib/calendar/day-agenda";
import { groupStats, needsAction } from "@/lib/calendar/grouping";
import { isPast } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { EmptyState } from "./calendar-empty-state";
import { EVENT_FOCUS, EventDot } from "./event-parts";
import { usePeek } from "./event-peek";
import { EventSigns } from "./event-signs";
import { RowStatus, useCountsLine } from "./peek-cards";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * How a row opens its event: inside the dialog it sits in (`onSelect`, the Month
 * day dialog), or as its own peek card beside the row (the phone list under the
 * month grid).
 */
type OnSelect = ((ev: CalendarEvent) => void) | undefined;

function useRowOpen(ev: CalendarEvent, onSelect: OnSelect) {
  const { peekProps } = usePeek();
  return onSelect ? { onClick: () => onSelect(ev) } : peekProps({ type: "event", id: ev.id }, { side: "inline" });
}

function RowChevron() {
  return (
    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover/row:text-foreground rtl:rotate-180" />
  );
}

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
 * doesn't repeat it. `detailed` (the Month day popup) adds everything else the
 * event carries — its numbers, people and notes — and lets the title wrap.
 */
function PanelRow({ ev, day, onSelect, detailed }: { ev: CalendarEvent; day: Date; onSelect: OnSelect; detailed?: boolean }) {
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const open = useRowOpen(ev, onSelect);
  const countsLine = useCountsLine(ev);
  const past = !ev.allDay && isPast(ev, now);
  const place = ev.companyWide ? null : ev.store.name || ev.store.code;
  const sub = detailed
    ? [f.when(ev, day), place].filter(Boolean).join(" · ")
    : [ev.allDay ? null : f.timeRange(ev.start, ev.end), ev.store.name].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      {...open}
      className={cn(
        "group/row flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start transition-colors duration-150 hover:bg-muted/70",
        EVENT_FOCUS,
        past && "opacity-70",
      )}
    >
      <span className="min-w-0 flex-1">
        <span dir="auto" className={cn("block text-start text-sm font-medium leading-snug", detailed ? "line-clamp-2" : "truncate")}>
          {f.title(ev)}
        </span>
        {sub && (
          <span dir="auto" className="block truncate text-start text-xs tabular-nums text-muted-foreground">
            {sub}
          </span>
        )}
        {detailed && countsLine && <span className="block truncate text-xs tabular-nums text-muted-foreground">{countsLine}</span>}
        {detailed && ev.people.length > 0 && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3 shrink-0" aria-hidden />
            <span dir="auto" className="truncate text-start">
              {ev.people.join(", ")}
            </span>
          </span>
        )}
        {detailed && ev.notes && (
          <span dir="auto" className="mt-0.5 line-clamp-2 block text-start text-xs text-muted-foreground">
            {ev.notes}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 self-center">
        <EventSigns ev={ev} />
        <RowStatus status={ev.status} />
        {onSelect && <RowChevron />}
      </span>
    </button>
  );
}

/** One store inside an opened roll-up. */
function MemberRow({ ev, onSelect }: { ev: CalendarEvent; onSelect: OnSelect }) {
  const f = useCalendarFormat();
  const open = useRowOpen(ev, onSelect);
  return (
    <li>
      <button
        type="button"
        {...open}
        className={cn(
          "group/row flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors duration-150 hover:bg-muted/70",
          EVENT_FOCUS,
        )}
      >
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-xs font-medium">
            {ev.store.name || ev.store.code}
          </span>
          <span dir="auto" className="block truncate text-start text-[11px] tabular-nums text-muted-foreground">
            {f.title(ev)}
          </span>
        </span>
        <EventSigns ev={ev} />
        <RowStatus status={ev.status} />
        {onSelect && <RowChevron />}
      </button>
    </li>
  );
}

/**
 * The same kind of event in several stores as ONE row ("Cleaning · 38 stores"),
 * opening to the stores — needs-attention ones first. A store's row opens that
 * event's own card.
 */
function GroupItem({ ev, onSelect }: { ev: CalendarEvent; onSelect: OnSelect }) {
  const t = useTranslations("calendar");
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
            <MemberRow key={m.id} ev={m} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One category: a header with its counts, and its items. Collapsible. */
function Section({ section, day, onSelect, detailed }: { section: AgendaSection; day: Date; onSelect: OnSelect; detailed?: boolean }) {
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
          {section.items.map((ev) =>
            ev.members ? (
              <GroupItem key={ev.id} ev={ev} onSelect={onSelect} />
            ) : (
              <PanelRow key={ev.id} ev={ev} day={day} onSelect={onSelect} detailed={detailed} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A day's events grouped by category, the same kind of event across stores
 * rolled up into one row, what needs attention first (`agendaSections`).
 * Renders nothing for an empty list — the caller says what that means.
 */
export function DayAgendaList({
  day,
  events,
  onSelect,
  detailed,
}: {
  day: Date;
  events: readonly CalendarEvent[];
  /** Open a picked event inside the caller (the Month day popup) instead of its own peek. */
  onSelect?: (ev: CalendarEvent) => void;
  detailed?: boolean;
}) {
  const sections = useMemo(() => agendaSections(events), [events]);
  return (
    <>
      {sections.map((s) => (
        <Section key={s.category} section={s} day={day} onSelect={onSelect} detailed={detailed} />
      ))}
    </>
  );
}

/**
 * Every event of one day, listed under the phone-size Month grid (on wider
 * screens a day's list opens in a centered dialog instead — `DayDetailsDialog`). It flows
 * with the page: no inner scroll.
 */
export function DayAgenda({
  day,
  events,
  onOpenDay,
}: {
  day: Date;
  events: readonly CalendarEvent[];
  onOpenDay?: (key: string) => void;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const action = useMemo(() => actionCount(events), [events]);

  return (
    <div className="flex flex-col">
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
          positioned parent they escape and stretch the page's scroll area. */}
      <div className="relative p-2">
        {events.length ? <DayAgendaList day={day} events={events} /> : <EmptyState compact title={t("empty.dayTitle")} hint={t("empty.dayHint")} />}
      </div>
    </div>
  );
}
