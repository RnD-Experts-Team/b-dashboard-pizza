"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Coffee,
  Flag,
  Info,
  Plus,
  Radio,
  RotateCcw,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
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
  retentionMinDate,
  shiftDate,
} from "@/lib/break-logger/work-date";
import type { BreakCategory, BreakDay } from "@/types/breaks.types";
import { BreakEntryActions, type BreakEntryHandlers } from "./break-entry-actions";
import {
  AllowanceBar,
  CountedBadge,
  RunningBadge,
  useBreakErrorText,
  useFormatTime,
} from "./break-ui";

function Kpi({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-heading text-xl font-semibold tabular-nums",
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
}: {
  title: string;
  minutes: string;
  items: BreakCategory[];
}) {
  const t = useTranslations("breaks");
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        <span className="tabular-nums">{minutes}</span>
      </div>
      {items.map((c) => (
        <div
          key={`${c.break_type_id}-${c.label}`}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                c.counts_toward_limit ? "bg-amber-500" : "bg-muted-foreground/40"
              )}
            />
            <span className="truncate">{c.label}</span>
            {c.entry_count > 1 && (
              <span className="text-xs text-muted-foreground">×{c.entry_count}</span>
            )}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {t("minutes", { minutes: c.minutes })}
          </span>
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
        <DatePicker
          value={viewed ?? ""}
          onChange={(v) => v && go(v)}
          className="w-40"
          fromYear={minDate ? Number(minDate.slice(0, 4)) : undefined}
          toYear={todayDate ? Number(todayDate.slice(0, 4)) : undefined}
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

  const fired = [...day.milestones.fired].sort(
    (a, b) => new Date(a.crossed_at).getTime() - new Date(b.crossed_at).getTime()
  );
  // Pending as the server last saw it, minus any the live total has already passed.
  const upcoming = day.milestones.pending.filter((m) => m > countedMinutes);
  const nextMilestone = upcoming.length ? Math.min(...upcoming) : null;
  const countedCategories = day.categories.filter((c) => c.counts_toward_limit);
  const excludedCategories = day.categories.filter((c) => !c.counts_toward_limit);

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
        <div className="col-span-3 space-y-2 rounded-lg border bg-card p-3 lg:col-span-2">
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
          <p className="font-heading text-xl font-semibold tabular-nums">
            <span className={cn(over && "text-red-600 dark:text-red-400")}>
              {t("minutes", { minutes: countedMinutes })}
            </span>
            <span className="text-base font-normal text-muted-foreground">
              {" / "}
              {t("minutes", { minutes: allowance })}
            </span>
          </p>
          <AllowanceBar
            countedMinutes={countedMinutes}
            allowanceMinutes={allowance}
            thresholds={day.milestones.thresholds}
          />
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {over ? (
              <span className="font-medium text-red-600 dark:text-red-400">
                {t("allowance.over", { minutes: countedMinutes - allowance })}
              </span>
            ) : (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
        <Kpi
          label={t("today.kpiExcluded")}
          value={t("minutes", { minutes: day.excluded_minutes })}
          muted
        />
        <Kpi label={t("today.kpiTotal")} value={t("minutes", { minutes: totalMinutes })} />
        <Kpi label={t("today.kpiEntries")} value={String(day.entry_count)} />
      </div>

      {running && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Radio className="h-3.5 w-3.5 motion-safe:animate-pulse" />
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
                <Coffee className="h-8 w-8 text-muted-foreground" />
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
                    <li key={entry.id} className="flex items-start gap-3 py-2.5">
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
                />
                <CategoryGroup
                  title={t("today.excludedGroup")}
                  minutes={t("minutes", { minutes: day.excluded_minutes })}
                  items={excludedCategories}
                />
              </CardContent>
            </Card>
          )}

          {/* Milestones — show crossed_at (the true instant), not noticed_at. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("today.milestones")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {fired.length === 0 && day.milestones.pending.length === 0 ? (
                <p className="text-muted-foreground">{t("today.noMilestones")}</p>
              ) : (
                <>
                  {fired.map((f) => (
                    <div key={`${f.kind}-${f.threshold_minutes}`} className="flex items-center gap-2">
                      <Flag
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          f.kind === "allowance"
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      />
                      <span className="flex-1">
                        {f.kind === "allowance"
                          ? t("today.allowanceReached", { minutes: f.threshold_minutes })
                          : t("today.milestoneReached", { minutes: f.threshold_minutes })}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {t("today.at", { time: formatTime(f.crossed_at) })}
                      </span>
                    </div>
                  ))}
                  {day.milestones.pending.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground">{t("today.pending")}</span>
                      {day.milestones.pending.map((m) => (
                        <Badge key={m} variant="outline" className="gap-1 tabular-nums">
                          {t("minutes", { minutes: m })}
                          {m > countedMinutes && (
                            <span className="font-normal text-muted-foreground">
                              · {t("today.inMinutes", { minutes: m - countedMinutes })}
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
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
