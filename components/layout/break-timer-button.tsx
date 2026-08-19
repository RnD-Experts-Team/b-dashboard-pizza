"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Coffee, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useBreakTimerStore,
  isOnBreak,
  type BreakSession,
} from "@/lib/store/break-timer.store";
import { playSfx } from "@/lib/uisfx/play";

/** A second click inside this window counts as a double-click (open history)
 * instead of a second single-click (toggle the break). */
const DOUBLE_CLICK_MS = 300;

/** Live counter format for the running session — "m:ss". */
function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Summary format for totals — "1h 12m", "42m", or "45s".
 *
 * Sub-minute totals render as seconds: rounding them to "0m" read as though
 * nothing had been recorded, which is exactly wrong on a row that exists
 * precisely because a break was taken.
 */
function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Topbar break-timer trigger, beside the Drive Thru indicator. A single
 * click starts or ends a break; a second click within DOUBLE_CLICK_MS opens
 * the day's break history instead. State lives in localStorage via
 * useBreakTimerStore and resets automatically each day (and is cleared on
 * logout/account switch by resetIdentityScopedCaches in auth.store.ts).
 */
export function BreakTimerButton() {
  const t = useTranslations("breakTimer");
  const { sessions, ensureToday, startBreak, endBreak, reset, overtimeMinutes, setOvertimeMinutes } =
    useBreakTimerStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [thresholdInput, setThresholdInput] = useState(String(overtimeMinutes));
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setThresholdInput(String(overtimeMinutes));
  }, [overtimeMinutes]);

  useEffect(() => {
    ensureToday();
    setNow(Date.now());
  }, [ensureToday]);

  const onBreak = isOnBreak(sessions);

  // Live tick only while actually on break — no background timer otherwise.
  useEffect(() => {
    if (!onBreak) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onBreak]);

  useEffect(
    () => () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    },
    []
  );

  const current = sessions.find((s) => s.end === null) ?? null;
  const liveMs = current && now != null ? now - current.start : 0;
  /**
   * The clock face to paint. While a break runs it tracks `liveMs`; once the
   * break ends we keep painting its final value for the length of the collapse
   * animation. `liveMs` drops to 0 on the very frame the break ends, so reading
   * it directly would flip the text to "0:00" and then shrink it — the number
   * visibly resetting mid-glide instead of just sliding away.
   */
  const clockFaceRef = useRef("0:00");
  if (onBreak) clockFaceRef.current = formatClock(liveMs);
  const clockFace = clockFaceRef.current;
  const completedSessions = useMemo(
    () => sessions.filter((s): s is BreakSession & { end: number } => s.end !== null),
    [sessions]
  );
  /**
   * Total across COMPLETED breaks only — deliberately not the running one.
   *
   * The "N breaks · duration" summary counts `completedSessions`, so its
   * duration has to describe that same set. Including the live break made the
   * two halves disagree (3 breaks, but a duration covering four) and
   * double-counted time already shown by the live clock beside it.
   */
  const completedMs = useMemo(
    () => completedSessions.reduce((sum, s) => sum + (s.end - s.start), 0),
    [completedSessions]
  );
  const isOvertime = onBreak && liveMs >= overtimeMinutes * 60 * 1000;

  // Keep nagging every few seconds once overtime starts — stops only when the
  // user actually ends the break (isOvertime flips false), not on its own.
  useEffect(() => {
    if (!isOvertime) return;
    playSfx("warning", { volume: 1 });
    const id = setInterval(() => playSfx("warning", { volume: 1 }), 1200);
    return () => clearInterval(id);
  }, [isOvertime]);

  const commitThreshold = () => {
    const parsed = Number(thresholdInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      setOvertimeMinutes(parsed);
    } else {
      setThresholdInput(String(overtimeMinutes));
    }
  };

  const handleTriggerClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setHistoryOpen((v) => !v);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (isOnBreak(useBreakTimerStore.getState().sessions)) {
        endBreak();
      } else {
        startBreak();
      }
    }, DOUBLE_CLICK_MS);
  };

  // Avoid rendering a mismatched elapsed time before the first client tick.
  if (now == null) return null;

  return (
    <div className="relative flex items-center">
      {/* Overtime notice — sits in the empty topbar space just before the
          button (logical "end" side) instead of a corner toast, so it stays
          visually tied to the timer for as long as isOvertime is true. */}
      {isOvertime && (
        <div className="animate-in fade-in zoom-in-95 absolute end-full top-1/2 me-3 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-red-600/80 px-3 py-1 text-xs font-medium text-red-600 shadow-sm duration-300 dark:border-red-400/80 dark:text-red-400">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {t("overtimeAlert")}
          {/* Speech-bubble pointer, aimed back at the trigger button */}
          <span className="absolute -end-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-e border-t border-red-600/80 dark:border-red-400/80" />
        </div>
      )}

      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        {/* The day's totals live in a hover tooltip rather than inline in the
            topbar: the icon (plus the live clock while a break runs) is all
            that occupies the icon cluster, and the wordy summary is one hover
            away instead of permanently competing with the icons beside it.
            No `title` attr on the button — it would double up with this tooltip.

            Nesting order matters: Tooltip must sit OUTSIDE PopoverAnchor.
            `PopoverAnchor asChild` needs a real DOM child to measure and anchor
            against, and Radix's Tooltip root renders no element — so anchoring
            the popover to it would silently break the popover's positioning.
            Both `asChild` wrappers now collapse onto the Button itself. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverAnchor asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("trigger")}
                onClick={handleTriggerClick}
                className={cn(
                  // gap-0, not the size's default gap-1.5: the clock owns its
                  // own leading margin so the space between icon and clock
                  // collapses along with the clock instead of lingering as a
                  // permanent 6px gap next to a zero-width element.
                  "relative gap-0 px-2 transition-colors duration-300 ease-out",
                  isOvertime
                    ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    : onBreak
                      ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Coffee className="h-4 w-4 shrink-0" />

                {/*
                  Live clock. Stays mounted and COLLAPSES when the break ends,
                  rather than unmounting: an unmount resizes the button between
                  two frames, which snapped the icon (and the whole topbar
                  cluster after it) to its new spot. Collapsing it over 300ms
                  lets the button shrink gradually, so the coffee icon glides
                  back to its resting position.

                  The collapse animates a grid column from 1fr to 0fr rather
                  than a max-width. On an auto-width grid, 1fr resolves to the
                  text's own max-content width, so the track interpolates
                  between exactly the two real widths. A max-width instead needs
                  a hardcoded ceiling, and any ceiling above the ~30px the clock
                  actually occupies spends the first stretch of the animation
                  shrinking through empty slack — the icon sitting still, then
                  lurching. Widths here also change with the digit count
                  ("0:02" vs "12:34"), which no single constant tracks.

                  aria-hidden while collapsed — it is inert decoration then, and
                  a stale clock face should not reach a screen reader.
                */}
                <span
                  aria-hidden={!onBreak}
                  className={cn(
                    "grid transition-[grid-template-columns,margin,opacity] duration-300 ease-out",
                    onBreak ? "ms-1.5 grid-cols-[1fr] opacity-100" : "ms-0 grid-cols-[0fr] opacity-0"
                  )}
                >
                  <span className="overflow-hidden whitespace-nowrap text-xs font-semibold tabular-nums">
                    {clockFace}
                  </span>
                </span>

                {isOvertime && (
                  <span className="absolute -top-0.5 -end-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  </span>
                )}
              </Button>
            </PopoverAnchor>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="tabular-nums">
            {completedSessions.length === 0 && !onBreak
              ? t("todaySummaryZero")
              : t("todaySummary", {
                  breaks: t(
                    completedSessions.length === 1 ? "breaksCount" : "breaksCountPlural",
                    { count: completedSessions.length }
                  ),
                  duration: formatDuration(completedMs),
                })}
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-72 space-y-4 rounded-2xl border-border/60 bg-background shadow-2xl"
        >
          <div className="space-y-1">
            <p className="font-heading text-sm font-semibold">{t("title")}</p>
          </div>

          {onBreak ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 py-4 transition-colors duration-300">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide transition-colors duration-300",
                    isOvertime ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {t("onBreak")}
                </span>
                <span className="text-2xl font-bold tabular-nums">{formatClock(liveMs)}</span>
              </div>
              <Button
                variant="outline"
                className="w-full border-amber-500/40 text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                onClick={endBreak}
              >
                {t("end")}
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={startBreak}>
              {t("start")}
            </Button>
          )}

          <div className="border-t pt-3 text-sm text-muted-foreground">
            {completedSessions.length === 0 && !onBreak ? (
              t("todaySummaryZero")
            ) : (
              t("todaySummary", {
                breaks: t(
                  completedSessions.length === 1 ? "breaksCount" : "breaksCountPlural",
                  { count: completedSessions.length }
                ),
                duration: formatDuration(completedMs),
              })
            )}
          </div>

          {completedSessions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("sessionsHeading")}
                </p>
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  className="text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
                >
                  {t("resetHistory")}
                </button>
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {completedSessions
                  .slice()
                  .reverse()
                  .map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>
                        {t("sessionRange", {
                          start: formatClockTime(s.start),
                          end: formatClockTime(s.end),
                        })}
                      </span>
                      <span className="tabular-nums">{formatDuration(s.end - s.start)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <label htmlFor="break-overtime-minutes" className="text-xs text-muted-foreground">
              {t("overtimeThresholdLabel")}
            </label>
            <Input
              id="break-overtime-minutes"
              type="number"
              min={1}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onBlur={commitThreshold}
              className="h-7 w-16 text-xs"
            />
          </div>
        </PopoverContent>

        <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("resetHistoryConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("resetHistoryConfirmDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("resetHistoryConfirmCancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  reset();
                  setResetConfirmOpen(false);
                }}
              >
                {t("resetHistoryConfirmAction")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Popover>
    </div>
  );
}
