"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { MINUTE, dayKey, isSameDay, isWeekend, minutesOfDay } from "@/lib/calendar/dates";
import { commonCategory, groupAllDay, groupPeekId } from "@/lib/calendar/grouping";
import {
  MIN_BLOCK_MINUTES,
  byDay,
  durationMinutes,
  isLive,
  isPast,
  lanes,
  overlapLayout,
  type OverlapItem,
  type OverlapStack,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarClock } from "../calendar-clock";
import { AvatarStack, EVENT_FOCUS, EventBar, EventDot, LaneCell, MoreButton, PrivateMark } from "../event-parts";
import { usePeek } from "../event-peek";
import { StoreLabel } from "../store-label";
import { useCalendarFormat } from "../use-calendar-format";

const DEFAULT_HOUR = 48; // px per hour (Week). Day view passes a taller hour.
const GUTTER = "3.5rem";
const GUTTER_PX = 56; // GUTTER at the default 16px root size, for measuring the day columns
const DAY_SLOT_MAX = "24rem"; // Day view: overlapping slots never stretch across a wide screen
const RAIL_GAP = 7; // px: rail (3px) + breathing room before the card

/**
 * How many events may sit side by side before the rest fold into a "+N" stack.
 * A card needs ~60px to stay readable (cascade lets each overlap the next at
 * 1.7 slots); Day view's cards are roomier and each needs ~150px. A column too
 * narrow for even two cards (< ~125px) gets one column: a crowd is just a stack.
 */
function maxColumns(columnWidth: number, cascade: boolean): number {
  if (columnWidth <= 0) return 3;
  const n = Math.floor(columnWidth / (cascade ? 62 : 150));
  return Math.min(cascade ? 4 : 5, Math.max(1, n));
}

/** Where a block sits: vertical extent from its times, horizontal slot from its column. */
function blockBox(start: Date, end: Date, col: number, cols: number, hour: number, cascade: boolean) {
  const startMin = minutesOfDay(start);
  const endMin = Math.min(1440, startMin + Math.max(MIN_BLOCK_MINUTES, (+end - +start) / MINUTE));
  const top = (startMin * hour) / 60 + 1;
  const height = ((endMin - startMin) * hour) / 60 - 3;

  const slot = 100 / cols;
  if (cascade) {
    const left = col * slot;
    const w = col < cols - 1 ? Math.min(100 - left, slot * 1.7) : slot;
    return { top, height, insetInlineStart: `calc(${left}% + 2px)`, width: `calc(${w}% - 4px)` };
  }
  const slotCss = `min(${slot}%, ${DAY_SLOT_MAX})`;
  return { top, height, insetInlineStart: `calc(${slotCss} * ${col} + 2px)`, width: `calc(${slotCss} - 4px)` };
}

export type GridScroll = "auto" | "keep";

interface TimeGridProps {
  days: Date[];
  events: CalendarEvent[];
  /** Hide the day-name header (single-day views). */
  header?: boolean;
  allDayMax?: number;
  hour?: number;
  /** Narrow columns: later events overlap earlier ones at ~1.7 slots wide. */
  cascade?: boolean;
  /** Day view: larger type plus store and people. */
  rich?: boolean;
  /** Inline height (defaults to filling the card). */
  style?: CSSProperties;
  onOpenDay: (key: string) => void;
  scroll: GridScroll;
  /** Survives remounts so paging can keep the time-of-day scroll position. */
  scrollMemory: MutableRefObject<number | null>;
}

/**
 * Event = a slim DURATION RAIL + a content-sized CARD. Nothing else is painted.
 *
 * A box filling the whole duration × column spent most of its area on empty
 * space, so instead:
 * - the positioned wrapper is transparent and pointer-events-none (the grid
 *   shows through a long shift);
 * - a 3px neutral rail on the start edge spans the duration — for an
 *   in-progress event it fills down to "now", a quiet progress bar;
 * - the card holds the content, is only as big as its text, and is sticky:
 *   scrolling through a long shift keeps it pinned under the sticky header.
 *   The wrapper is `overflow-clip`, NEVER `overflow-hidden` — a hidden-overflow
 *   box becomes the scroll container and silently stops the card sticking;
 * - hovering the card lightly highlights the event's whole time span.
 *
 * The card adapts: 1 line (short events), 2 lines (time + title), or the full
 * stack (time · duration · live status, title, and in Day view store + people).
 * Container queries drop the time row/duration/status as a column narrows.
 */
function EventBlock({
  it,
  hour,
  cascade,
  rich,
}: {
  it: OverlapItem;
  hour: number;
  cascade: boolean;
  rich: boolean;
}) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const { peekProps } = usePeek();
  const ev = it.ev;

  const { top, height, insetInlineStart, width } = blockBox(ev.start, ev.end, it.col, it.cols, hour, cascade);
  const past = isPast(ev, now);
  const live = isLive(ev, now);
  const lines = height < 34 ? 1 : height < 58 ? 2 : 3;

  const title = f.title(ev);
  const progress = live ? Math.min(100, ((now - +ev.start) / (+ev.end - +ev.start)) * 100) : 0;

  return (
    <div
      className="group/ev pointer-events-none absolute overflow-clip @container hover:z-[9]! focus-within:z-[9]!"
      style={{ zIndex: 1 + it.col, top, height, insetInlineStart, width }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-md bg-muted/0 transition-colors duration-150 group-hover/ev:bg-muted/60"
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 start-0 w-[3px] overflow-hidden rounded-full",
          past ? "bg-foreground/10" : "bg-foreground/20",
        )}
      >
        {live && (
          <span className="absolute inset-x-0 top-0 rounded-full bg-foreground/70" style={{ height: `${progress}%` }} />
        )}
      </span>

      <button
        type="button"
        {...peekProps({ type: "event", id: ev.id }, { side: "inline" })}
        className={cn(
          "pointer-events-auto sticky top-(--cal-sticky) z-[1] flex w-fit min-w-0 flex-col gap-1 overflow-clip rounded-md border bg-card text-start text-[11px] leading-tight shadow-xs transition-[box-shadow,border-color] duration-150 hover:border-foreground/25 hover:shadow-md",
          EVENT_FOCUS,
          "data-[peek-open=true]:border-foreground/25 data-[peek-open=true]:bg-card data-[peek-open=true]:shadow-md",
          lines === 1 ? "h-full justify-center px-2" : "px-2 py-1.5",
          live && "border-foreground/30",
          // A reminder is a nudge, not an event: dashed, so a reminder about "Clocked in: X" is never mistaken for it.
          ev.feedType === "reminder" && "border-dashed border-foreground/30",
          past && "opacity-70",
        )}
        style={{ marginInlineStart: RAIL_GAP, maxWidth: `calc(100% - ${RAIL_GAP}px)`, maxHeight: height }}
      >
        {lines === 1 ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <EventDot category={ev.category} />
            <StoreLabel ev={ev} />
            <PrivateMark ev={ev} />
            <span dir="auto" className="truncate text-start font-medium text-foreground">
              {title}
            </span>
            <span className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground @[7rem]:inline">
              {f.time(ev.start)}
            </span>
          </span>
        ) : (
          <>
            {/* Below ~5.5rem the time would only show as "13:.." — drop it, keep the title. */}
            <span className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-muted-foreground @[5.5rem]:flex">
              <EventDot category={ev.category} />
              {/* No end known (a reminder, a visit with only a start): the stand-in end isn't shown. */}
              <span className="truncate tabular-nums">
                {ev.feedType === "reminder"
                  ? `${t("reminderLabel")} · ${f.time(ev.start)}`
                  : ev.openEnded
                    ? f.time(ev.start)
                    : f.timeRange(ev.start, ev.end)}
              </span>
              {!ev.openEnded && (
                <span className="hidden shrink-0 tabular-nums text-muted-foreground/70 @[9rem]:inline">
                  · {f.duration(durationMinutes(ev))}
                </span>
              )}
              {live && (
                <span className="hidden shrink-0 items-center gap-1 ps-2 font-medium text-foreground @[13rem]:inline-flex">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  {t("left", { d: f.duration(Math.max(1, Math.round((+ev.end - now) / MINUTE))) })}
                </span>
              )}
            </span>
            <span
              dir="auto"
              className={cn(
                "text-start font-medium leading-snug text-foreground",
                rich && "text-[13px]",
                lines === 2 ? "truncate" : "line-clamp-2",
              )}
            >
              {/* Several stores: lead with the store's badge so equal titles stay apart. */}
              <StoreLabel ev={ev} className="me-1.5 align-[1px]" />
              <PrivateMark ev={ev} className="me-1 align-[-1px]" />
              {title}
            </span>
            {rich && height >= 84 && (
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {ev.store.name && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{ev.store.name}</span>
                  </span>
                )}
                {ev.people.length > 0 && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <AvatarStack people={ev.people} ring="ring-card" />
                    <span className="truncate">{ev.people.map((p) => p.split(" ")[0]).join(", ")}</span>
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}

/**
 * A crowded overlap cluster folded into one block: "+17 Staff". Same rail and
 * sticky card as an event so it sits in the grid like one, but dashed and muted
 * so it never passes for a real event. Clicking lists everything it holds.
 */
function StackBlock({ stack, hour, cascade }: { stack: OverlapStack; hour: number; cascade: boolean }) {
  const t = useTranslations("calendar");
  const f = useCalendarFormat();
  const { peekProps } = usePeek();
  const { top, height, insetInlineStart, width } = blockBox(stack.start, stack.end, stack.col, stack.cols, hour, cascade);
  const n = stack.events.length;
  const common = commonCategory(stack.events);
  const caption = common ? (stack.events[0].typeLabel ?? t(`categories.${common}`)) : t("group.more");
  const range = f.timeRange(stack.start, stack.end);
  const label = `${t("group.moreEvents", { n })}, ${range}`;
  const oneLine = height < 34;

  return (
    <div
      className="group/ev pointer-events-none absolute overflow-clip @container hover:z-[9]! focus-within:z-[9]!"
      style={{ zIndex: 1 + stack.col, top, height, insetInlineStart, width }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-md bg-muted/0 transition-colors duration-150 group-hover/ev:bg-muted/60"
      />
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] rounded-full bg-foreground/20" />
      <button
        type="button"
        aria-label={label}
        title={label}
        {...peekProps({ type: "group", id: groupPeekId(stack.events) }, { side: "inline" })}
        className={cn(
          "pointer-events-auto sticky top-(--cal-sticky) z-[1] flex w-fit min-w-0 flex-col justify-center gap-0.5 overflow-clip rounded-md border border-dashed bg-muted/70 px-1.5 text-start text-[11px] leading-tight transition-[box-shadow,border-color,background-color] duration-150 hover:border-foreground/40 hover:bg-muted hover:shadow-md",
          EVENT_FOCUS,
          "data-[peek-open=true]:border-foreground/40 data-[peek-open=true]:bg-muted data-[peek-open=true]:shadow-md",
          oneLine ? "h-full" : "py-1.5",
        )}
        style={{ marginInlineStart: RAIL_GAP, maxWidth: `calc(100% - ${RAIL_GAP}px)`, maxHeight: height }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Layers className="size-3 shrink-0 text-muted-foreground" />
          <span className="font-semibold tabular-nums text-foreground">+{n}</span>
          <span className="hidden truncate text-muted-foreground @[6rem]:inline">{caption}</span>
        </span>
        {!oneLine && (
          <span className="hidden truncate text-[10px] tabular-nums text-muted-foreground @[6rem]:block">{range}</span>
        )}
      </button>
    </div>
  );
}

function AllDayRow({
  days,
  events,
  cols,
  max,
}: {
  days: Date[];
  events: CalendarEvent[];
  cols: string;
  max: number;
}) {
  const t = useTranslations("calendar");
  const now = useCalendarClock();
  const [open, setOpen] = useState(false);
  const single = days.length === 1;
  // `full` holds every lane; `capped` is the same cut at `max` lanes (skipped when nothing overflows).
  // "+N more" and the chevron open the row instead of listing the overflow in a popover.
  const full = useMemo(() => lanes(days, events, 99, false), [days, events]);
  const canExpand = full.lanes > max;
  const capped = useMemo(() => (canExpand ? lanes(days, events, max, false) : full), [canExpand, days, events, max, full]);
  const lay = open && canExpand ? full : capped;
  const rows = Math.max(1, lay.lanes);
  return (
    <div
      className={cn("relative grid border-b py-1", open && canExpand && "max-h-60 overflow-y-auto overscroll-contain")}
      style={{ gridTemplateColumns: cols, gridTemplateRows: `repeat(${rows}, 22px)` }}
    >
      <div
        className="flex flex-col items-end gap-0.5 pe-2 pt-1 text-[10px] font-medium leading-tight text-muted-foreground"
        style={{ gridColumn: 1, gridRow: "1 / -1" }}
      >
        <span>{t("allDay")}</span>
        {canExpand && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? t("group.collapse") : t("group.expand")}
            title={open ? t("group.collapse") : t("group.expand")}
            onClick={() => setOpen((o) => !o)}
            className="grid size-5 place-items-center rounded-sm outline-none transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
          </button>
        )}
      </div>
      {days.map((d, i) => (
        <div
          key={dayKey(d)}
          className={cn(
            "-my-1 border-s",
            !single && isWeekend(d) && "cal-hatch",
            !single && isSameDay(d, new Date(now)) && "bg-muted/50",
          )}
          style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
        />
      ))}
      {lay.items.map((it) => (
        <LaneCell key={`${it.ev.id}-${it.col}`} col={it.col + 2} span={it.span} lane={it.lane + 1}>
          <EventBar item={it} day={single ? days[0] : undefined} />
        </LaneCell>
      ))}
      {lay.more.map((m) => (
        <LaneCell key={`more-${m.key}`} col={m.col + 2} span={1} lane={m.lane + 1}>
          <MoreButton more={m} onExpand={() => setOpen(true)} />
        </LaneCell>
      ))}
    </div>
  );
}

export function TimeGrid({
  days,
  events,
  header = true,
  allDayMax = 3,
  hour = DEFAULT_HOUR,
  cascade = true,
  rich = false,
  style,
  onOpenDay,
  scroll,
  scrollMemory,
}: TimeGridProps) {
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  const nowDate = new Date(now);
  const isTodayCol = (d: Date) => isSameDay(d, nowDate);
  const hasToday = days.some(isTodayCol);
  const nowTop = (minutesOfDay(nowDate) * hour) / 60;
  const cols = `${GUTTER} repeat(${days.length}, minmax(0, 1fr))`;
  const grouped = useMemo(() => byDay(events), [events]);
  const names = f.weekdayNames("short");
  // The same kind of event from several stores becomes one chip (grouping.ts).
  const allDayEvents = useMemo(() => groupAllDay(events.filter((e) => e.allDay)), [events]);

  // Day column width → how many overlapping events fit side by side before the rest fold into "+N".
  const [columnWidth, setColumnWidth] = useState(0);
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const measure = () => setColumnWidth(Math.round((sc.clientWidth - GUTTER_PX) / days.length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [days.length]);
  const maxCols = maxColumns(columnWidth, cascade);
  const layouts = useMemo(
    () => days.map((d) => overlapLayout((grouped.get(dayKey(d)) ?? []).filter((e) => !e.allDay), maxCols)),
    [days, grouped, maxCols],
  );

  // Keep event cards sticking just under the sticky header + all-day row.
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    const sticky = stickyRef.current;
    if (!sc || !sticky) return;
    const apply = () => sc.style.setProperty("--cal-sticky", `${sticky.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(sticky);
    return () => ro.disconnect();
  }, []);

  // On mount: keep the previous time-of-day when paging, else jump to now−2h (or 07:00).
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    if (scroll === "keep" && scrollMemory.current != null) {
      sc.scrollTop = scrollMemory.current;
    } else {
      const target = hasToday ? Math.max(0, nowDate.getHours() - 2) : 7;
      sc.scrollTop = target * hour;
    }
    scrollMemory.current = sc.scrollTop;
    // Mount-only on purpose: the parent remounts the grid per range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gutterLabels = [];
  for (let h = 1; h < 24; h++) {
    if (hasToday && Math.abs(minutesOfDay(nowDate) - h * 60) < 18) continue;
    gutterLabels.push(
      <span
        key={h}
        className="absolute end-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
        style={{ top: h * hour }}
      >
        {f.hourLabel(h)}
      </span>,
    );
  }

  return (
    <div
      ref={scrollerRef}
      data-slot="calendar-time-grid"
      onScroll={(e) => {
        scrollMemory.current = e.currentTarget.scrollTop;
      }}
      className="relative overflow-x-hidden overflow-y-auto overscroll-contain"
      style={{ height: "100%", ["--cal-sticky" as string]: "0px", ...style }}
    >
      <div ref={stickyRef} className="sticky top-0 z-20 bg-card">
        {header && (
          <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d) => {
              const today = isTodayCol(d);
              return (
                <button
                  key={dayKey(d)}
                  type="button"
                  onClick={() => onOpenDay(dayKey(d))}
                  aria-label={f.longDate(d)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1.5 border-s outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50",
                    today && "bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      today ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {names[(d.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={cn(
                      "font-heading text-sm font-semibold tabular-nums",
                      today && "grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <AllDayRow days={days} events={allDayEvents} cols={cols} max={allDayMax} />
      </div>

      <div
        className="relative grid"
        style={{ gridTemplateColumns: cols, height: 24 * hour, ["--cal-hour" as string]: `${hour}px` }}
      >
        <div className="relative">
          {gutterLabels}
          {hasToday && (
            <span
              className="absolute end-1 z-10 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-px text-[9px] font-semibold tabular-nums text-white"
              style={{ top: nowTop }}
            >
              {f.time(nowDate)}
            </span>
          )}
        </div>

        {days.map((d, i) => {
          const today = isTodayCol(d);
          const { items, stacks } = layouts[i];
          return (
            <div
              key={dayKey(d)}
              className={cn(
                "cal-hours relative border-s",
                days.length > 1 && isWeekend(d) && "cal-hatch",
                today && days.length > 1 && "bg-muted/30",
              )}
            >
              {items.map((it) => (
                <EventBlock key={it.ev.id} it={it} hour={hour} cascade={cascade} rich={rich} />
              ))}
              {stacks.map((s) => (
                <StackBlock key={`stack-${s.events[0].id}`} stack={s} hour={hour} cascade={cascade} />
              ))}
              {today && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                  <div className="relative h-0.5 -translate-y-1/2 rounded-full bg-destructive">
                    <span className="absolute -start-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-destructive" />
                    <span className="absolute -end-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-destructive" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* A faint now-line across every column; the today column draws the strong one. */}
        {hasToday && days.length > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[8] h-px bg-destructive/35"
            style={{ top: nowTop, insetInlineStart: GUTTER, insetInlineEnd: 0 }}
          />
        )}
      </div>
    </div>
  );
}
