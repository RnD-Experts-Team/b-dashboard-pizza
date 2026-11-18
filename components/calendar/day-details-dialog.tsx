"use client";

import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fromKey } from "@/lib/calendar/dates";
import { actionCount } from "@/lib/calendar/day-agenda";
import type { CalendarEvent } from "@/lib/calendar/types";
import { DayAgendaList } from "./day-agenda";
import { EmptyState } from "./calendar-empty-state";
import { useCalendarFormat } from "./use-calendar-format";

/** From this many events on, the dialog offers a box to narrow the day down (and its list keeps a fixed height). */
const BUSY_FROM = 9;

/**
 * A Month-view day's FULL list in a centered dialog, opened by clicking the day's
 * cell, its number or "+N more". Every event of the day with its details —
 * grouped by category, the same kind across stores rolled up, what needs
 * attention first (`DayAgendaList`). Picking a row shows that event's own card in
 * the dialog (with its actions and a way back to the list); clicking one of the
 * day's lines in the Month grid opens the dialog straight on that card. The
 * dialog is as tall as what it shows — only a busy day's LIST keeps a fixed
 * height, so filtering it doesn't make the dialog jump.
 */
export function DayDetailsDialog({
  dayKey,
  eventId,
  grouped,
  onOpenChange,
  onOpenDay,
  renderEvent,
  returnFocusTo,
}: {
  /** The day shown ("YYYY-MM-DD"); `null` = closed. */
  dayKey: string | null;
  /** Open straight on this event's card (a line clicked in the Month grid). */
  eventId?: string;
  /** Every day's events (what the Month view draws). */
  grouped: ReadonlyMap<string, CalendarEvent[]>;
  onOpenChange: (open: boolean) => void;
  /** "Open day": the Day view on that day. */
  onOpenDay: (key: string) => void;
  /** The picked event's card; `back` returns to the list. */
  renderEvent: (ev: CalendarEvent, back: () => void) => ReactNode;
  /** Opened from code (no trigger): where focus goes back on close. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  // Keep the last day while the dialog animates closed (the parent clears `dayKey` at once).
  const [shown, setShown] = useState(dayKey ? { key: dayKey, eventId } : null);
  if (dayKey && (dayKey !== shown?.key || eventId !== shown?.eventId)) setShown({ key: dayKey, eventId });
  const shownKey = shown?.key ?? null;
  const events = useMemo(() => (shownKey ? (grouped.get(shownKey) ?? []) : []), [grouped, shownKey]);
  const busy = events.length >= BUSY_FROM;

  return (
    <Dialog open={dayKey != null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // `cal-scroll`: the calendar's thin scrollbars (the dialog is portaled outside the page).
        className="cal-scroll flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        onCloseAutoFocus={(e) => {
          const el = returnFocusTo?.current;
          if (el?.isConnected) {
            e.preventDefault();
            el.focus({ preventScroll: true });
          }
        }}
      >
        {shown && (
          // Keyed by day and event: the picked event and the filter start fresh each time.
          <DayDetails
            key={`${shown.key}|${shown.eventId ?? ""}`}
            dayKey={shown.key}
            initialEventId={shown.eventId}
            events={events}
            busy={busy}
            onOpenDay={onOpenDay}
            renderEvent={renderEvent}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DayDetails({
  dayKey,
  initialEventId,
  events,
  busy,
  onOpenDay,
  renderEvent,
}: {
  dayKey: string;
  initialEventId?: string;
  events: readonly CalendarEvent[];
  busy: boolean;
  onOpenDay: (key: string) => void;
  renderEvent: (ev: CalendarEvent, back: () => void) => ReactNode;
}) {
  const t = useTranslations("calendar");
  const tc = useTranslations("calendar.categories");
  const f = useCalendarFormat();
  const date = useMemo(() => fromKey(dayKey), [dayKey]);
  const [selectedId, setSelectedId] = useState<string | null>(initialEventId ?? null);
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const action = useMemo(() => actionCount(events), [events]);
  const shown = useMemo(
    () =>
      query
        ? events.filter((ev) =>
            [f.title(ev), ev.store.name, ev.store.code, ev.typeLabel ?? "", tc(ev.category), ...ev.people]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
        : events,
    [events, query, f, tc],
  );
  // Read the picked event from the live list, so a write that refetches shows its new state.
  const selected = selectedId ? events.find((e) => e.id === selectedId) : undefined;

  return (
    <>
      <div className="shrink-0 space-y-3 border-b px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-xl leading-tight">
              {f.format(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </DialogTitle>
            <DialogDescription className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums">
              <span title={f.fiscalLabel(date)}>{f.fiscalBadge(date)}</span>
              <span aria-hidden>·</span>
              <span>{f.countLabel(events.length)}</span>
              {action > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-destructive">{t("group.needsAction", { n: action })}</span>
                </>
              )}
            </DialogDescription>
          </div>
          <div className="-me-2 -mt-1 flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={() => onOpenDay(dayKey)}>
              {t("pop.openDay")}
              <ArrowRight className="size-3 rtl:rotate-180" />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("pop.close")} title={t("pop.close")} className="size-8 text-muted-foreground">
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </div>
        {busy && !selected && (
          <label className="relative block">
            <span className="sr-only">{t("pop.filterDay")}</span>
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoComplete="off"
              value={filter}
              placeholder={t("pop.filterDay")}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background pe-2 ps-8 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        )}
      </div>
      {/* `relative`: keeps the rows' screen-reader-only spans inside this scroller. Its height is
          its content (the dialog shrinks to an event's card); only a busy day's list is fixed. */}
      <div
        className={cn(
          "relative min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3",
          busy && !selected && "h-[min(64vh,36rem)]",
        )}
      >
        {selected ? (
          // The event card is built for a narrow popover: let it use the dialog's width.
          <div className="[&>div]:w-full">{renderEvent(selected, () => setSelectedId(null))}</div>
        ) : !events.length ? (
          <EmptyState compact title={t("empty.dayTitle")} hint={t("empty.dayHint")} />
        ) : shown.length ? (
          <DayAgendaList day={date} events={shown} onSelect={(ev) => setSelectedId(ev.id)} detailed />
        ) : (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">{t("search.noMatches", { q: filter.trim() })}</p>
        )}
      </div>
    </>
  );
}
