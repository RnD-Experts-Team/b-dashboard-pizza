"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck2, FunnelX, Plus, SearchX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSameDay, weekDays } from "@/lib/calendar/dates";
import { fiscalWeekOf } from "@/lib/calendar/fiscal";
import type { CalendarView } from "@/lib/calendar/types";
import { useCalendarClock } from "./calendar-clock";
import { useNewItemLabel } from "./use-new-item-label";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * Why a range shows nothing — each has its own words and its own way out:
 * - "empty": nothing is planned → add something, or look wider;
 * - "filtered": there are events, but the event-type filters hide them all → show all types;
 * - "search": the search matches nothing → clear it.
 */
export type EmptyReason = "empty" | "filtered" | "search";

const ICONS: Record<EmptyReason, LucideIcon> = { empty: CalendarCheck2, filtered: FunnelX, search: SearchX };

/**
 * The illustration: the week as seven little Tuesday–Monday day cards, the open
 * day ringed. Empty slots are dashed when nothing is planned; when filters hide
 * the events, the cards carry faint dots (something IS there). Decorative only.
 */
function WeekStrip({ days, focus, reason }: { days: Date[]; focus?: Date; reason: EmptyReason }) {
  const f = useCalendarFormat();
  const reduce = useReducedMotion();
  const names = f.weekdayNames("narrow");
  return (
    <div aria-hidden className="flex items-end justify-center gap-1.5">
      {days.map((d, i) => {
        const on = !!focus && isSameDay(d, focus);
        return (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.035 * i, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col items-center gap-1"
          >
            <span className={cn("text-[9px] font-semibold uppercase", on ? "text-foreground" : "text-muted-foreground/70")}>{names[i]}</span>
            <span
              className={cn(
                "flex h-11 w-7 flex-col items-center justify-between rounded-lg border py-1 transition-colors",
                on
                  ? "border-primary/50 bg-primary/10 shadow-sm"
                  : reason === "empty"
                    ? "border-dashed bg-muted/30"
                    : "bg-muted/40",
              )}
            >
              <span className={cn("text-[10px] font-semibold tabular-nums", on ? "text-foreground" : "text-muted-foreground")}>
                {d.getDate()}
              </span>
              {reason === "filtered" ? (
                <span className="flex gap-0.5">
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                  <span className="size-1 rounded-full bg-muted-foreground/25" />
                </span>
              ) : (
                <span className={cn("h-1 w-3 rounded-full", on && reason === "empty" ? "bg-primary/40" : "bg-transparent")} />
              )}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * A calm empty state. `strip` draws the week illustration (the page overlay);
 * `compact` is the small version for a day's list (the day dialog, the Day view's
 * schedule, the phone list): no card, no strip.
 */
export function EmptyState({
  reason = "empty",
  title,
  hint,
  strip,
  compact,
  children,
  className,
}: {
  reason?: EmptyReason;
  title: string;
  hint?: ReactNode;
  strip?: { days: Date[]; focus?: Date };
  compact?: boolean;
  /** The actions. */
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[reason];
  if (compact) {
    return (
      <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
        <span className="grid size-10 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="max-w-64 text-xs text-muted-foreground">{hint}</p>}
        {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
      </div>
    );
  }
  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("w-full max-w-sm rounded-2xl border bg-popover px-6 pb-6 pt-5 text-center text-popover-foreground shadow-lg", className)}
    >
      {strip && (
        <div className="relative mx-auto mb-7 w-fit">
          <WeekStrip days={strip.days} focus={strip.focus} reason={reason} />
          <span className="absolute -bottom-4 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border bg-popover shadow-sm">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </span>
        </div>
      )}
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      {hint && <p className="mx-auto mt-1 max-w-72 text-sm text-muted-foreground">{hint}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </motion.div>
  );
}

/**
 * What the page shows over an empty Day / Week / Month: the reason in plain words
 * and the one or two things to do next. The week strip shows the open day's week
 * (the cursor's), ringing the open day (Day view) or today.
 */
export function RangeEmptyState({
  reason,
  view,
  cursor,
  query,
  hidden,
  onCreate,
  onShowAll,
  onClearSearch,
  onView,
}: {
  reason: EmptyReason;
  view: Exclude<CalendarView, "year">;
  cursor: Date;
  /** The search text (for "search"). */
  query: string;
  /** How many events the filters hide (for "filtered"). */
  hidden: number;
  onCreate: () => void;
  onShowAll: () => void;
  onClearSearch: () => void;
  onView: (v: CalendarView) => void;
}) {
  const t = useTranslations("calendar");
  const newLabel = useNewItemLabel();
  const f = useCalendarFormat();
  const now = new Date(useCalendarClock());
  const strip = { days: weekDays(cursor), focus: view === "day" ? cursor : now };

  if (reason === "search") {
    return (
      <EmptyState reason="search" strip={strip} title={t("empty.noMatches", { q: query })} hint={t("empty.noMatchesHint")}>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          {t("empty.clearSearch")}
        </Button>
      </EmptyState>
    );
  }
  if (reason === "filtered") {
    return (
      <EmptyState reason="filtered" strip={strip} title={t("empty.hidden", { n: hidden })} hint={t("empty.hiddenHint")}>
        <Button size="sm" onClick={onShowAll}>
          {t("empty.showAll")}
        </Button>
      </EmptyState>
    );
  }

  const title = view === "day" ? t("empty.clearDay") : view === "week" ? t("empty.clearWeek") : t("empty.quietMonth");
  const hint =
    view === "day"
      ? t("empty.clearDayHint", { date: f.longDate(cursor) })
      : view === "week"
        ? t("empty.clearWeekHint", { week: fiscalWeekOf(cursor).week, range: f.rangeLabel("week", cursor) })
        : t("empty.quietMonthHint", { month: f.format(cursor, { month: "long", year: "numeric" }) });
  return (
    <EmptyState reason="empty" strip={strip} title={title} hint={hint}>
      <Button size="sm" onClick={onCreate}>
        <Plus className="size-4" />
        {newLabel}
      </Button>
      {view !== "month" && (
        <Button variant="outline" size="sm" onClick={() => onView(view === "day" ? "week" : "month")}>
          {view === "day" ? t("empty.seeWeek") : t("empty.seeMonth")}
        </Button>
      )}
      <p className="hidden w-full pt-1 text-[11px] text-muted-foreground sm:block">
        {t.rich("empty.tip", {
          kbd: (chunks) => <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">{chunks}</kbd>,
        })}
      </p>
    </EmptyState>
  );
}
