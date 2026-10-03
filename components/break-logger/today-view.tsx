"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  ClipboardCopy,
  Coffee,
  Info,
  Plus,
  RotateCcw,
  StickyNote,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { liveCountedSeconds, useBreaksStore } from "@/lib/store/breaks.store";
import { useNow } from "@/lib/hooks/use-breaks";
import { BreakError } from "@/lib/break-logger/errors";
import {
  clampDate,
  elapsedSeconds,
  floorMinutes,
  formatClock,
  retentionMinDate,
  shiftDate,
} from "@/lib/break-logger/work-date";
import type { BreakCategory, BreakDay } from "@/types/breaks.types";
import { BreakEntryActions, type BreakEntryHandlers } from "./break-entry-actions";
import { BreakDateField } from "./break-date-field";
import { BreakHourglass } from "./break-hourglass";
import {
  CountedBadge,
  PulseDot,
  RunningBadge,
  useBreakErrorText,
  useFormatTime,
} from "./break-ui";

function Kpi({
  label,
  value,
  icon: Icon,
  muted,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={cn(
          "font-heading text-2xl font-semibold leading-none tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CategoryGroup({
  title,
  minutes,
  items,
  maxSeconds,
}: {
  title: string;
  minutes: string;
  items: BreakCategory[];
  /** Largest category of the day — each bar is its share of that. */
  maxSeconds: number;
}) {
  const t = useTranslations("breaks");
  if (items.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        <span className="tabular-nums">{minutes}</span>
      </div>
      {items.map((c) => (
        <div key={`${c.break_type_id}-${c.label}`} className="flex items-center">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate">{c.label}</span>
                {c.entry_count > 1 && (
                  <span className="text-xs tabular-nums text-muted-foreground">×{c.entry_count}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {t("minutes", { minutes: c.minutes })}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  c.counts_toward_limit ? "bg-amber-500 dark:bg-amber-400" : "bg-muted-foreground/40"
                )}
                style={{ width: `${Math.max(3, (c.seconds / maxSeconds) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodayView({
  date,
  onDateChange,
  day,
  loading,
  error,
  isToday,
  onRetry,
  onAdd,
  onExport,
  handlers,
}: {
  /** The work date being viewed (null until the store knows today's). */
  date: string | null;
  onDateChange: (date: string | null) => void;
  day: BreakDay | null;
  loading: boolean;
  error: BreakError | null;
  isToday: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onExport: () => void;
  handlers: BreakEntryHandlers;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const locale = useLocale();
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const todayDate = useBreaksStore((s) => s.today?.work_date ?? null);
  const active = useBreaksStore((s) => s.active);
  const running = isToday && !!day?.has_active_break;
  const now = useNow(running);

  const viewed = date ?? todayDate;
  const minDate = todayDate ? retentionMinDate(todayDate) : null;

  function go(next: string) {
    if (!todayDate || !minDate) return;
    const clamped = clampDate(next, minDate, todayDate);
    onDateChange(clamped === todayDate ? null : clamped);
  }

  /* Live totals for today: the server's snapshot + time since `as_of`. */
  const countedMinutes =
    day && running && now != null
      ? floorMinutes(liveCountedSeconds(day, active, now))
      : (day?.counted_minutes ?? 0);
  const allowance = day?.allowance_minutes ?? 0;
  const over = countedMinutes > allowance;
  // Total grows with ANY running break of today's, counted or not.
  const sinceAsOf =
    day && running && now != null
      ? Math.max(0, Math.floor((now - new Date(day.as_of).getTime()) / 1000))
      : 0;
  const totalMinutes = day ? floorMinutes(day.total_seconds + sinceAsOf) : 0;
  // The store's active break, while it belongs to the day on screen.
  const runningNow = running && active != null && now != null;
  const runningSeconds = running && active && now != null ? elapsedSeconds(active.started_at, now) : 0;

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label={t("today.prev")}
          disabled={!viewed || !minDate || viewed <= minDate}
          onClick={() => viewed && go(shiftDate(viewed, -1))}
        >
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
        </Button>
        {/* Only retention-horizon → today is pickable; future days are greyed out. */}
        <BreakDateField
          value={viewed ?? ""}
          onChange={(v) => v && go(v)}
          min={minDate}
          max={todayDate}
          className="w-44"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label={t("today.next")}
          disabled={!viewed || !todayDate || viewed >= todayDate}
          onClick={() => viewed && go(shiftDate(viewed, 1))}
        >
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => onDateChange(null)}>
            {t("today.goToday")}
          </Button>
        )}
      </div>
      <div className="ms-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport} disabled={!day || !viewed}>
          <ClipboardCopy className="me-1.5 h-4 w-4" />
          {t("today.copySummary")}
        </Button>
        <Button size="sm" onClick={onAdd}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("today.addBreak")}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-5">
          <Skeleton className="col-span-3 h-24 lg:col-span-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !day) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm">{error ? errorText(error) : t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t("actions.retry")}
          </Button>
        </div>
      </div>
    );
  }

  // Pending as the server last saw it, minus any the live total has already passed.
  const upcoming = day.milestones.pending.filter((m) => m > countedMinutes);
  const nextMilestone = upcoming.length ? Math.min(...upcoming) : null;
  const countedCategories = day.categories.filter((c) => c.counts_toward_limit);
  const excludedCategories = day.categories.filter((c) => !c.counts_toward_limit);
  const maxCategorySeconds = Math.max(1, ...day.categories.map((c) => c.seconds));

  // Fired (with their true crossed_at) and pending, as one ladder by threshold.
  const milestoneSteps = [
    ...day.milestones.fired.map((f) => ({
      key: `${f.kind}-${f.threshold_minutes}`,
      minutes: f.threshold_minutes,
      allowance: f.kind === "allowance",
      reached: true,
      crossedAt: f.crossed_at as string | null,
    })),
    ...day.milestones.pending.map((m) => ({
      key: `pending-${m}`,
      minutes: m,
      allowance: false,
      reached: m <= countedMinutes,
      crossedAt: null as string | null,
    })),
  ].sort((a, b) => a.minutes - b.minutes || Number(a.allowance) - Number(b.allowance));

  return (
    <div className="space-y-4">
      {header}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {t("today.workDayRange", {
          start: formatDateTime(day.work_day.starts_at),
          end: formatDateTime(day.work_day.ends_at),
        })}
      </p>

      {/* KPI strip — totals always from the server, never summed per row. */}
      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-5">
        {/* Hero: counted vs allowance is the one number that matters. */}
        <div className="col-span-3 flex items-center gap-4 rounded-lg border bg-card p-3 lg:col-span-2">
          {/* Same hourglass as the topbar: allowance sand when idle, and the
              per-minute flip while today's break runs. */}
          <span className="flex shrink-0 items-center justify-center">
            <BreakHourglass
              size={52}
              running={runningNow}
              over={over}
              minuteIndex={runningNow ? Math.floor(runningSeconds / 60) : undefined}
              fill={
                runningNow
                  ? (runningSeconds % 60) / 60
                  : Math.min(1, countedMinutes / Math.max(allowance, 1))
              }
            />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("today.allowanceTitle")}
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("today.softLimitInfo")}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-60">{t("allowance.softLimit")}</TooltipContent>
              </Tooltip>
            </div>
            <p className="font-heading text-2xl font-semibold leading-none tabular-nums">
              <span className={cn(over && "text-red-600 dark:text-red-400")}>
                {t("minutes", { minutes: countedMinutes })}
              </span>
              <span className="text-base font-normal text-muted-foreground">
                {" / "}
                {t("minutes", { minutes: allowance })}
              </span>
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {over ? (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {t("allowance.over", { minutes: countedMinutes - allowance })}
                </span>
              ) : (
                <span className="font-medium text-foreground">
                  {t("allowance.left", { minutes: allowance - countedMinutes })}
                </span>
              )}
              {nextMilestone != null && (
                <>
                  {" · "}
                  {t("today.nextMilestoneIn", { minutes: nextMilestone - countedMinutes })}
                </>
              )}
            </p>
          </div>
          {running && (
            <span className="hidden shrink-0 items-center gap-1.5 self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 sm:inline-flex dark:bg-amber-500/20 dark:text-amber-400">
              <PulseDot className="size-1.5" />
              {t("today.running")}
              {runningNow && <span className="tabular-nums">· {formatClock(runningSeconds)}</span>}
            </span>
          )}
        </div>
        <Kpi
          label={t("today.kpiExcluded")}
          value={t("minutes", { minutes: day.excluded_minutes })}
          icon={CircleSlash}
          muted
        />
        <Kpi
          label={t("today.kpiTotal")}
          value={t("minutes", { minutes: totalMinutes })}
          icon={Timer}
        />
        <Kpi label={t("today.kpiEntries")} value={String(day.entry_count)} icon={Coffee} />
      </div>

      {running && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <PulseDot />
          {t("today.live")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Entries */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("today.entriesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {day.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Coffee className="h-6 w-6" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium">{t("today.emptyTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("today.emptyHint")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={onAdd}>
                  <Plus className="me-1.5 h-4 w-4" />
                  {t("today.addBreak")}
                </Button>
              </div>
            ) : (
              <ol className="divide-y">
                {day.entries.map((entry) => {
                  const seconds =
                    entry.running && now != null
                      ? elapsedSeconds(entry.started_at, now)
                      : entry.duration_seconds;
                  return (
                    <li
                      key={entry.id}
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                    >
                      {/* Own column from sm up; on phones it sits above the label
                          so the label keeps the width. */}
                      <div className="hidden w-32 shrink-0 whitespace-nowrap pt-0.5 text-xs tabular-nums text-muted-foreground sm:block">
                        {formatTime(entry.started_at)} –{" "}
                        {entry.running ? "…" : formatTime(entry.ended_at)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:hidden">
                          {formatTime(entry.started_at)} –{" "}
                          {entry.running ? "…" : formatTime(entry.ended_at)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{entry.label}</span>
                          <CountedBadge counted={entry.counts_toward_limit} />
                          {entry.source === "manual" && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {t("today.manual")}
                            </Badge>
                          )}
                          {entry.running && <RunningBadge />}
                        </div>
                        {entry.notes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handlers.onNotes(entry)}
                            className="flex max-w-full items-start gap-1 text-start text-xs text-muted-foreground hover:text-foreground"
                          >
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">
                              {entry.notes[entry.notes.length - 1].body}
                            </span>
                          </button>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 pt-0.5 text-sm tabular-nums",
                          entry.counts_toward_limit
                            ? "font-semibold"
                            : "font-normal text-muted-foreground"
                        )}
                      >
                        {t("minutes", { minutes: floorMinutes(seconds) })}
                      </span>
                      <BreakEntryActions entry={entry} {...handlers} />
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Categories */}
          {day.categories.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("today.categories")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Group subtotals come from the server's day totals, never a client sum. */}
                <CategoryGroup
                  title={t("today.countedGroup")}
                  minutes={t("minutes", { minutes: day.counted_minutes })}
                  items={countedCategories}
                  maxSeconds={maxCategorySeconds}
                />
                <CategoryGroup
                  title={t("today.excludedGroup")}
                  minutes={t("minutes", { minutes: day.excluded_minutes })}
                  items={excludedCategories}
                  maxSeconds={maxCategorySeconds}
                />
              </CardContent>
            </Card>
          )}

          {/* Milestones — show crossed_at (the true instant), not noticed_at. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("today.milestones")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {milestoneSteps.length === 0 ? (
                <p className="text-muted-foreground">{t("today.noMilestones")}</p>
              ) : (
                /* Fired and pending as one ladder; the connector fills as you climb. */
                <ol>
                  {milestoneSteps.map((step, i) => {
                    const last = i === milestoneSteps.length - 1;
                    return (
                      <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                        {!last && (
                          <span
                            aria-hidden
                            className={cn(
                              "absolute start-[11px] top-6 bottom-0 w-px",
                              step.reached ? "bg-amber-500/60" : "bg-border"
                            )}
                          />
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                            step.reached
                              ? step.allowance
                                ? "border-red-500 bg-red-500 text-white dark:border-red-400 dark:bg-red-400"
                                : "border-amber-500 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950"
                              : "border-dashed border-muted-foreground/40 bg-card text-muted-foreground"
                          )}
                        >
                          {step.reached ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pt-0.5">
                          <span className={cn("tabular-nums", !step.reached && "text-muted-foreground")}>
                            {step.allowance
                              ? t("today.allowanceReached", { minutes: step.minutes })
                              : step.reached
                                ? t("today.milestoneReached", { minutes: step.minutes })
                                : t("minutes", { minutes: step.minutes })}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {step.crossedAt
                              ? t("today.at", { time: formatTime(step.crossedAt) })
                              : !step.reached
                                ? t("today.inMinutes", { minutes: step.minutes - countedMinutes })
                                : null}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {day.self_reported && <>{t("today.selfReported")} </>}
            {t("today.retentionNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
