"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useBreakTimerStore,
  isOnBreak,
  totalBreakMs,
  type BreakSession,
} from "@/lib/store/break-timer.store";
import { useFabPositionStore } from "@/lib/store/fab-position.store";
import { playSfx } from "@/lib/uisfx/play";

/** Gap between this bubble and the Debrief FAB it's anchored beside. */
const GAP = 8;
/** Generous estimate of our own widest rendered width (the "on break" pill),
 * used only to keep us from sliding off the left edge of the screen when
 * Debrief is dragged close to it. */
const BUBBLE_MAX_W = 96;
/** Beyond this, a break is "running long" — one alert sound, then a visual cue. */
const OVERTIME_MS = 20 * 60 * 1000;

/** Live counter format for the running session — "m:ss". */
function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Summary format for totals — "1h 12m" or "42m". */
function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Purely client-side break timer — no backend endpoint, state lives in
 * localStorage via useBreakTimerStore and resets automatically each day.
 * Sits beside the floating Debrief button (same mount convention).
 */
export function FloatingBreakTimerButton() {
  const t = useTranslations("breakTimer");
  const { sessions, ensureToday, startBreak, endBreak } = useBreakTimerStore();
  const debriefPos = useFabPositionStore((s) => s.debriefPos);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);

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

  const current = sessions.find((s) => s.end === null) ?? null;
  const liveMs = current && now != null ? now - current.start : 0;
  const totalMs = now != null ? totalBreakMs(sessions, now) : 0;
  const completedSessions = useMemo(
    () => sessions.filter((s): s is BreakSession & { end: number } => s.end !== null),
    [sessions]
  );
  const isOvertime = onBreak && liveMs >= OVERTIME_MS;

  // Fire the attention sound once per session, right as it crosses 20 minutes
  // — tracked by that session's own start time so a new break gets its own alert.
  // Played at max volume + a quick second chime — the cue's own default (0.22)
  // was too soft to actually get anyone's attention.
  const alertedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOvertime || !current) return;
    if (alertedForRef.current === current.start) return;
    alertedForRef.current = current.start;
    playSfx("warning", { volume: 1 });
    const id = setTimeout(() => playSfx("warning", { volume: 1 }), 400);
    return () => clearTimeout(id);
  }, [isOvertime, current]);

  // Avoid rendering a mismatched elapsed time before the first client tick.
  if (now == null) return null;

  // Anchored to the Debrief FAB's live (draggable) position — this bubble
  // follows it around instead of sitting at a static corner. `left`/`top`
  // are physical pixel coordinates (matching how Debrief itself positions
  // itself), and `translateX(-100%)` places our right edge just before
  // Debrief's left edge regardless of our own rendered width. `left` is
  // clamped so we can't slide off the left edge of the screen when Debrief
  // is dragged close to it.
  const style: React.CSSProperties = debriefPos
    ? { left: Math.max(BUBBLE_MAX_W, debriefPos.x - GAP), top: debriefPos.y, transform: "translateX(-100%)" }
    : {};

  return (
    <div className={cn("fixed z-50", !debriefPos && "bottom-2 end-32")} style={style}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            aria-label={t("trigger")}
            className={cn(
              "gap-2 rounded-full h-11 px-4 shadow-lg transition-colors",
              isOvertime
                ? "bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-500 dark:hover:bg-red-500/90"
                : onBreak
                  ? "bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-500 dark:hover:bg-amber-500/90"
                  : "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            )}
          >
            <Coffee className="h-4 w-4" />
            {onBreak && <span className="text-sm font-medium tabular-nums">{formatClock(liveMs)}</span>}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="left"
          align="end"
          sideOffset={8}
          className="w-72 space-y-4 rounded-2xl border-gray-200/60 bg-background shadow-2xl dark:border-gray-700/60"
        >
          <div className="space-y-1">
            <p className="font-heading text-sm font-semibold">{t("title")}</p>
          </div>

          {onBreak ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 py-4">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    isOvertime ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {t("onBreak")}
                </span>
                <span className="text-2xl font-bold tabular-nums">{formatClock(liveMs)}</span>
              </div>
              <Button
                variant="outline"
                className="w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
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
                duration: formatDuration(totalMs),
              })
            )}
          </div>

          {completedSessions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("sessionsHeading")}
              </p>
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
