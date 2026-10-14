"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { addDays, addMonths, isSameDay, monthGrid42, rangeContains, startOfMonth, viewRange } from "@/lib/calendar/dates";
import { byDay } from "@/lib/calendar/layout";
import { CALENDAR_VIEWS, type CalendarEvent, type CalendarView } from "@/lib/calendar/types";
import { useCalendarEvents } from "@/lib/hooks/use-calendar-events";
import { useCalendarClock } from "./calendar-clock";
import { MiniMonth } from "./mini-month";
import { useCalendarFormat } from "./use-calendar-format";

const KEYS: Record<CalendarView, string> = { day: "D", week: "W", month: "M", year: "Y" };

/** Segmented view switcher — the active pill glides between options (shared layoutId). */
function ViewSwitcher({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const t = useTranslations("calendar.views");
  const reduce = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className="relative grid h-8 w-full grid-cols-4 items-center rounded-lg bg-muted p-[3px] text-muted-foreground sm:inline-grid sm:w-auto"
    >
      {CALENDAR_VIEWS.map((v) => {
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            title={t("hint", { view: t(v), key: KEYS[v] })}
            onClick={() => onChange(v)}
            className={cn(
              "relative inline-flex h-full items-center justify-center rounded-md px-3 text-[13px] font-medium outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-w-14",
              active && "text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="calendar-view-pill"
                aria-hidden
                className="absolute inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative z-10">{t(v)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The date-range button's popover: a mini month that bands the open day/week. */
function DatePickerBody({
  view,
  cursor,
  filter,
  onPick,
}: {
  view: CalendarView;
  cursor: Date;
  filter: (events: CalendarEvent[]) => CalendarEvent[];
  onPick: (key: string) => void;
}) {
  const t = useTranslations("calendar.toolbar");
  const f = useCalendarFormat();
  const [month, setMonth] = useState(() => startOfMonth(cursor));
  const range = useMemo(() => {
    const grid = monthGrid42(month);
    return { from: grid[0], to: addDays(grid[41], 1) };
  }, [month]);
  const { events } = useCalendarEvents(range);
  const grouped = useMemo(() => byDay(filter(events)), [events, filter]);
  const open = viewRange(view, cursor);
  // Band the open day or week; a whole month/year band would just be noise.
  const highlight = view === "day" || view === "week" ? (d: Date) => rangeContains(open, d) : undefined;

  return (
    <div className="w-68 p-3">
      <div className="mb-1 flex items-center justify-between ps-2">
        <h3 className="font-heading text-sm font-semibold">{f.format(month, { month: "long", year: "numeric" })}</h3>
        <div className="flex">
          <Button variant="ghost" size="icon-xs" aria-label={t("prevMonth")} onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="size-3.5 rtl:rotate-180" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={t("nextMonth")} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="size-3.5 rtl:rotate-180" />
          </Button>
        </div>
      </div>
      <MiniMonth month={month} grouped={grouped} onPick={onPick} highlight={highlight} />
    </div>
  );
}

/** Card toolbar: ← → · title · Today ··· view switcher · date-range picker. */
export function CalendarToolbar({
  view,
  cursor,
  filter,
  onStep,
  onToday,
  onView,
  onPick,
}: {
  view: CalendarView;
  cursor: Date;
  filter: (events: CalendarEvent[]) => CalendarEvent[];
  onStep: (dir: 1 | -1) => void;
  onToday: () => void;
  onView: (v: CalendarView) => void;
  onPick: (key: string) => void;
}) {
  const t = useTranslations("calendar.toolbar");
  const f = useCalendarFormat();
  const now = useCalendarClock();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Already on today → the button has nothing to do.
  const isOnToday = isSameDay(cursor, new Date(now));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={t("prev")} onClick={() => onStep(-1)}>
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("prev")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={t("next")} onClick={() => onStep(1)}>
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("next")}</TooltipContent>
        </Tooltip>
      </div>
      <h2 aria-live="polite" className="min-w-0 truncate font-heading text-lg font-semibold tracking-tight">
        {f.titleLabel(view, cursor)}
      </h2>
      <Button variant="outline" size="sm" onClick={onToday} disabled={isOnToday}>
        {t("today")}
      </Button>
      <div className="flex w-full flex-wrap items-center gap-2 sm:ms-auto sm:w-auto">
        <ViewSwitcher view={view} onChange={onView} />
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" aria-label={t("pickDate")} className="font-normal tabular-nums">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span>{f.rangeLabel(view, cursor)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <DatePickerBody
              view={view}
              cursor={cursor}
              filter={filter}
              onPick={(k) => {
                setPickerOpen(false);
                onPick(k);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
