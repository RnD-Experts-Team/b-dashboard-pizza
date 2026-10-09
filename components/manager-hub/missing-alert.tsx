"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CalendarX2, CheckCircle2, Clock3, Database, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/utils/date-display";
import { HUB_ENTER, TONE_BAR, TONE_BORDER_START, TONE_SOFT, TONE_TEXT, type Tone } from "./hub-ui";
import type { HubSummary } from "./summary";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The hero: how much is still missing, in one sentence, with the one      */
/*  button that starts fixing it. Neutral surface — the start border, the    */
/*  icon and the numbers carry the colour.                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const SEVERITY_TONE = { clear: "good", pending: "warn", overdue: "bad", loading: "muted" } as const satisfies Record<
  HubSummary["severity"],
  Tone
>;

function Chip({
  icon: Icon,
  tone,
  children,
  onClick,
}: {
  icon: typeof Database;
  tone: Tone;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
    >
      <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[tone])} aria-hidden="true" />
      {children}
    </button>
  );
}

export function MissingAlert({
  summary,
  isToday,
  anchor,
  canSeeCleaning,
  onStart,
  onReviewMissed,
  onGoTasks,
  onGoDebriefs,
}: {
  summary: HubSummary;
  isToday: boolean;
  anchor: string;
  canSeeCleaning: boolean;
  onStart: () => void;
  onReviewMissed: () => void;
  onGoTasks: () => void;
  onGoDebriefs: () => void;
}) {
  const t = useTranslations("managerHub.alert");
  const { severity } = summary;
  const tone = SEVERITY_TONE[severity];
  const day = formatDateOnly(anchor, "MMM d");
  const todayCount = summary.today.length;

  if (severity === "loading") {
    return (
      <section
        aria-busy="true"
        aria-label={t("loadingLabel")}
        className={cn("rounded-xl border border-s-4 bg-card p-4 sm:p-5", TONE_BORDER_START.muted)}
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const Icon = severity === "clear" ? CheckCircle2 : severity === "overdue" ? AlertTriangle : Clock3;

  let title: string;
  let body: string;
  if (severity === "clear") {
    title = t("clearTitle");
    body = canSeeCleaning
      ? isToday
        ? t("clearBodyToday")
        : t("clearBodyDay", { date: day })
      : isToday
        ? t("clearBodyTodayDebriefs")
        : t("clearBodyDayDebriefs", { date: day });
  } else if (todayCount > 0) {
    title = isToday ? t("pendingTitleToday", { count: todayCount }) : t("pendingTitleDay", { count: todayCount, date: day });
    body = summary.tasksOverdue > 0 ? t("overdueBody") : summary.backlogCount > 0 ? t("pendingBodyBacklog") : t("pendingBody");
  } else {
    title = t("backlogOnlyTitle", { count: summary.backlogCount });
    body = t("backlogOnlyBody");
  }

  const progress = summary.todayTotal > 0 ? Math.round((summary.todayDone / summary.todayTotal) * 100) : 100;

  return (
    <section
      role="status"
      aria-live="polite"
      data-report-target="card"
      data-report-label={t("reportLabel")}
      className={cn(
        "overflow-hidden rounded-xl border border-s-4 bg-card transition-colors duration-300",
        TONE_BORDER_START[tone],
      )}
    >
      <div key={`${severity}-${todayCount}-${summary.backlogCount}`} className={cn("p-4 sm:p-5", HUB_ENTER)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TONE_SOFT[tone])}>
              <Icon className={cn("h-5 w-5", TONE_TEXT[tone])} aria-hidden="true" />
              {severity !== "clear" && (
                <span className="absolute -end-0.5 -top-0.5 flex h-3 w-3" aria-hidden="true">
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden",
                      TONE_BAR[tone],
                    )}
                  />
                  <span className={cn("relative inline-flex h-3 w-3 rounded-full ring-2 ring-card", TONE_BAR[tone])} />
                </span>
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="font-heading text-lg font-semibold leading-tight">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
              {severity !== "clear" && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {summary.debriefsMissing > 0 && (
                    <Chip icon={Database} tone="warn" onClick={onGoDebriefs}>
                      {t("chipDebriefs", { count: summary.debriefsMissing })}
                    </Chip>
                  )}
                  {canSeeCleaning && summary.tasksOpen > 0 && (
                    <Chip icon={Sparkles} tone={summary.tasksOverdue > 0 ? "bad" : "warn"} onClick={onGoTasks}>
                      {t("chipTasks", { count: summary.tasksOpen })}
                      {summary.tasksOverdue > 0 && (
                        <span className={TONE_TEXT.bad}>· {t("chipOverdue", { count: summary.tasksOverdue })}</span>
                      )}
                    </Chip>
                  )}
                  {summary.backlogCount > 0 && (
                    <Chip icon={CalendarX2} tone="bad" onClick={onReviewMissed}>
                      {t("chipMissed", { count: summary.backlogCount })}
                    </Chip>
                  )}
                </div>
              )}
              {summary.partial && <p className="text-[11px] text-destructive">{t("partial")}</p>}
            </div>
          </div>

          {severity !== "clear" && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {summary.backlogCount > 0 && todayCount > 0 && (
                <Button variant="outline" size="sm" onClick={onReviewMissed}>
                  {t("reviewMissed")}
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={todayCount > 0 ? onStart : onReviewMissed}>
                {todayCount > 0 ? t("start") : t("reviewMissed")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </div>

        {summary.todayTotal > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isToday ? t("progressToday") : t("progressDay", { date: day })}</span>
              <span className="tabular-nums">
                {t("progressCount", { done: summary.todayDone, total: summary.todayTotal })}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  progress === 100 ? TONE_BAR.good : TONE_BAR.warn,
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
