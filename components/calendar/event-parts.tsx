"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CalendarX2, Check, ChevronLeft, ChevronRight, CircleDashed, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/calendar/categories";
import { dotCategories, isMultiDay, isPast, type LaneItem, type LaneMore } from "@/lib/calendar/layout";
import type { CalendarEvent, CategoryKey, CleaningStatus } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { usePeek, type PeekSide } from "./event-peek";
import { useCalendarFormat } from "./use-calendar-format";

/** Focus ring + the "this anchor's peek is open" tint, shared by every event button. */
export const EVENT_FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[peek-open=true]:bg-accent/60";

/* ── Atoms ── */

export function EventDot({ category, className }: { category: CategoryKey; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="calendar-dot"
      className={cn("size-1.5 shrink-0 rounded-full", categoryOf(category).dot, className)}
    />
  );
}

/** Up to 3 category dots for a day (daily routines skipped so dots stay meaningful). */
export function DayDots({ events, className }: { events: readonly CalendarEvent[]; className?: string }) {
  return (
    <>
      {dotCategories(events).map((k) => (
        <EventDot key={k} category={k} className={className} />
      ))}
    </>
  );
}

export function StatusBadge({ status }: { status?: CleaningStatus }) {
  const t = useTranslations("calendar.status");
  if (!status) return null;
  // Only "overdue" earns colour (it needs action); done/pending stay neutral.
  const map = {
    done: { cls: "bg-muted text-foreground", Icon: Check },
    overdue: { cls: "bg-destructive/10 text-destructive dark:bg-destructive/20", Icon: TriangleAlert },
    pending: { cls: "bg-muted text-muted-foreground", Icon: CircleDashed },
  } as const;
  const { cls, Icon } = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent text-[11px]", cls)}>
      <Icon className="size-3" />
      {t(status)}
    </Badge>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AvatarStack({
  people,
  max = 3,
  ring = "ring-popover",
}: {
  people: readonly string[];
  max?: number;
  ring?: string;
}) {
  const extra = people.length - max;
  const chip = cn(
    "grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2",
    ring,
  );
  return (
    <span className="flex -space-x-1.5 rtl:space-x-reverse">
      {people.slice(0, max).map((p) => (
        <span key={p} title={p} className={chip}>
          {initials(p)}
        </span>
      ))}
      {extra > 0 && <span className={cn(chip, "tabular-nums")}>+{extra}</span>}
    </span>
  );
}

/** Empty state: dashed border, muted icon, instructional copy (dashboard convention). */
export function CalendarEmpty({
  title,
  hint,
  compact,
  className,
}: {
  title: string;
  hint: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center",
        compact ? "py-8" : "py-16",
        className,
      )}
    >
      <CalendarX2 className="size-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-60 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ── Lane items (month rows, all-day rows) ── */

/** Places one lane item in a row grid; also the @container that reveals pill times. */
export function LaneCell({
  col,
  span,
  lane,
  children,
}: {
  col: number;
  span: number;
  lane: number;
  children: ReactNode;
}) {
  const style: CSSProperties = { gridColumn: `${col} / span ${span}`, gridRow: lane };
  return (
    <div className="@container z-[1] min-w-0 px-1" style={style}>
      {children}
    </div>
  );
}

/** Timed pill: dot · title · time (the time shows once the lane is wide enough). */
export function EventPill({ ev }: { ev: CalendarEvent }) {
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const { peekProps } = usePeek();
  return (
    <button
      type="button"
      {...peekProps({ type: "event", id: ev.id })}
      className={cn(
        "flex h-5 w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-start text-[11px] leading-none transition-colors duration-150 hover:bg-accent/60",
        EVENT_FOCUS,
        isPast(ev, now) && "text-muted-foreground",
      )}
    >
      <EventDot category={ev.category} />
      <span dir="auto" className="min-w-0 flex-1 truncate text-start font-medium">
        {f.title(ev)}
      </span>
      <span className="hidden shrink-0 tabular-nums text-muted-foreground @[9rem]:inline">
        {f.time(ev.start)}
      </span>
    </button>
  );
}

/**
 * One lane item: timed → pill; all-day → a neutral bar with a category dot.
 * Bars that continue past the row edge lose that corner and show a chevron.
 * `day` — show "Day i/n" on multi-day bars (single-column rows).
 */
export function EventBar({ item, day }: { item: LaneItem; day?: Date }) {
  const f = useCalendarFormat();
  const { peekProps } = usePeek();
  const { ev, before, after } = item;
  if (!ev.allDay) return <EventPill ev={ev} />;
  const radius = before && after ? "" : before ? "rounded-e-sm" : after ? "rounded-s-sm" : "rounded-sm";
  return (
    <button
      type="button"
      {...peekProps({ type: "event", id: ev.id })}
      className={cn(
        "flex h-5 w-full min-w-0 items-center gap-1.5 bg-muted px-1.5 text-start text-[11px] font-medium leading-none text-foreground transition-colors duration-150 hover:bg-accent",
        EVENT_FOCUS,
        "data-[peek-open=true]:bg-accent",
        radius,
      )}
    >
      {before ? (
        <ChevronLeft className="size-3 shrink-0 opacity-50 rtl:rotate-180" />
      ) : (
        <EventDot category={ev.category} />
      )}
      <span dir="auto" className="min-w-0 truncate text-start">
        {f.title(ev)}
      </span>
      {day && isMultiDay(ev) && (
        <span className="ms-auto shrink-0 ps-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          {f.when(ev, day)}
        </span>
      )}
      {after && <ChevronRight className="ms-auto size-3 shrink-0 opacity-50 rtl:rotate-180" />}
    </button>
  );
}

export function MoreButton({ more }: { more: LaneMore }) {
  const t = useTranslations("calendar");
  const { peekProps } = usePeek();
  return (
    <button
      type="button"
      {...peekProps({ type: "day", id: more.key })}
      className={cn(
        "flex h-5 w-full items-center rounded-sm px-1.5 text-start text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground",
        EVENT_FOCUS,
      )}
    >
      {t("more", { n: more.count })}
    </button>
  );
}

/* ── Agenda row ── */

/**
 * A quiet timeline row: time column · neutral rule · dot + title, category and
 * store. `day` — the day being listed (for "Day i/n").
 */
export function AgendaRow({
  ev,
  day,
  side = "block",
  compact,
}: {
  ev: CalendarEvent;
  day?: Date;
  side?: PeekSide;
  compact?: boolean;
}) {
  const t = useTranslations("calendar.categories");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const { peekProps } = usePeek();
  const cat = categoryOf(ev.category);
  const past = !ev.allDay && isPast(ev, now);
  return (
    <button
      type="button"
      {...peekProps({ type: "event", id: ev.id }, { side })}
      className={cn(
        "grid w-full grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-lg px-2 py-2 text-start transition-colors duration-150 hover:bg-muted/70",
        EVENT_FOCUS,
        past && "opacity-70",
      )}
    >
      <span className="flex flex-col gap-0.5 pt-px leading-tight">
        {ev.allDay ? (
          <span className="text-[11px] font-medium text-muted-foreground">{f.when(ev, day)}</span>
        ) : (
          <>
            <span className="text-[11px] font-medium tabular-nums">{f.time(ev.start)}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{f.time(ev.end)}</span>
          </>
        )}
      </span>
      <span className="min-w-0 border-s ps-3">
        <span className="flex min-w-0 items-center gap-2">
          <EventDot category={ev.category} />
          <span dir="auto" className="truncate text-start text-sm font-medium leading-snug">
            {f.title(ev)}
          </span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 ps-3.5 text-xs text-muted-foreground">
          <cat.icon className="size-3 shrink-0" />
          <span className="truncate">
            {ev.typeLabel ?? t(ev.category)} · {ev.store.name}
          </span>
        </span>
        {ev.status && !compact && (
          <span className="mt-1.5 block ps-3.5">
            <StatusBadge status={ev.status} />
          </span>
        )}
      </span>
    </button>
  );
}
