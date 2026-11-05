"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Ban, CalendarX2, Check, ChevronLeft, ChevronRight, CircleDashed, Lock, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/calendar/categories";
import { groupPeekId, groupStats } from "@/lib/calendar/grouping";
import { dotCategories, isMultiDay, isPast, type LaneItem, type LaneMore } from "@/lib/calendar/layout";
import type { CalendarEvent, CategoryKey, EventStatus } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { usePeek, type PeekSide } from "./event-peek";
import { StoreLabel } from "./store-label";
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

/** A small pulsing dot: "happening now" (same look as the Today panel's live hero). */
function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/40 opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-foreground/70" />
    </span>
  );
}

const RED = "bg-destructive/10 text-destructive dark:bg-destructive/20";

export function StatusBadge({ status }: { status?: EventStatus }) {
  const t = useTranslations("calendar.status");
  // Only overdue / missed earn colour (they need action); everything else stays
  // neutral. "scheduled" and "info" are the normal state — no badge at all.
  const map: Partial<Record<EventStatus, { cls: string; icon: ReactNode }>> = {
    done: { cls: "bg-muted text-foreground", icon: <Check className="size-3" /> },
    pending: { cls: "bg-muted text-muted-foreground", icon: <CircleDashed className="size-3" /> },
    in_progress: { cls: "bg-muted text-foreground", icon: <LiveDot /> },
    overdue: { cls: RED, icon: <TriangleAlert className="size-3" /> },
    missed: { cls: RED, icon: <Ban className="size-3" /> },
    cancelled: { cls: "bg-muted text-muted-foreground", icon: <X className="size-3" /> },
  };
  const entry = status ? map[status] : undefined;
  if (!status || !entry) return null;
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent text-[11px]", entry.cls)}>
      {entry.icon}
      {t(status)}
    </Badge>
  );
}

/**
 * A lock before the title of a private event or task: only its creator sees it
 * (guide §8.1). Neutral, like everything but overdue/missed.
 */
export function PrivateMark({ ev, className }: { ev: CalendarEvent; className?: string }) {
  const t = useTranslations("calendar.feed");
  if (ev.scope !== "private") return null;
  return (
    <span title={t("private")} className={cn("inline-flex shrink-0 text-muted-foreground", className)}>
      <Lock aria-hidden className="size-3" />
      <span className="sr-only">{t("private")}</span>
    </span>
  );
}

/** Cancelled events stay visible, struck through and muted. */
const struck = (ev: CalendarEvent) => ev.status === "cancelled" && "text-muted-foreground line-through";

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
      <StoreLabel ev={ev} />
      <PrivateMark ev={ev} />
      <span dir="auto" className={cn("min-w-0 flex-1 truncate text-start font-medium", struck(ev))}>
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
  if (ev.members) return <GroupBar item={item} />;
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
      <StoreLabel ev={ev} />
      <PrivateMark ev={ev} />
      <span dir="auto" className={cn("min-w-0 truncate text-start", struck(ev))}>
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

/**
 * One chip for the same kind of event in several stores (`grouping.ts`):
 * "Cleaning · 39 stores", with a red count when some of them need attention.
 * Clicking it lists the stores in a peek card.
 */
function GroupBar({ item }: { item: LaneItem }) {
  const t = useTranslations("calendar");
  const { peekProps } = usePeek();
  const { ev, before, after } = item;
  const members = ev.members ?? [];
  const { stores, action } = groupStats(members);
  const label = ev.title ?? ev.typeLabel ?? t(`categories.${ev.category}`);
  const radius = before && after ? "" : before ? "rounded-e-sm" : after ? "rounded-s-sm" : "rounded-sm";
  return (
    <button
      type="button"
      {...peekProps({ type: "group", id: groupPeekId(members) })}
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
        {label}
      </span>
      {/* The cell is the @container: "38 stores" needs ~9rem, else just the number; the label gives way first. */}
      <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
        <span aria-hidden className="@[9rem]:hidden">
          {stores}
        </span>
        <span className="hidden @[9rem]:inline">{t("group.stores", { n: stores })}</span>
        <span className="sr-only @[9rem]:hidden">{t("group.stores", { n: stores })}</span>
      </span>
      {action > 0 && (
        <span
          title={t("group.needsAction", { n: action })}
          className="ms-auto inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-destructive/10 px-1 py-0.5 tabular-nums text-destructive dark:bg-destructive/20"
        >
          <TriangleAlert className="hidden size-2.5 @[7rem]:block" aria-hidden />
          {action}
          <span className="sr-only">{t("group.needsAction", { n: action })}</span>
        </span>
      )}
      {after && <ChevronRight className={cn("size-3 shrink-0 opacity-50 rtl:rotate-180", action === 0 && "ms-auto")} />}
    </button>
  );
}

/**
 * "+N more". By default it peeks at the day's full list; with `onExpand` it
 * opens the row it sits in instead (the all-day row grows to show everything).
 */
export function MoreButton({ more, onExpand }: { more: LaneMore; onExpand?: () => void }) {
  const t = useTranslations("calendar");
  const { peekProps } = usePeek();
  return (
    <button
      type="button"
      {...(onExpand ? { onClick: onExpand } : peekProps({ type: "day", id: more.key }))}
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
          <PrivateMark ev={ev} />
          <span dir="auto" className={cn("truncate text-start text-sm font-medium leading-snug", struck(ev))}>
            {f.title(ev)}
          </span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 ps-3.5 text-xs text-muted-foreground">
          <cat.icon className="size-3 shrink-0" />
          <span className="truncate">
            {ev.typeLabel ?? t(ev.category)}
            {ev.store.name && ` · ${ev.store.name}`}
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
