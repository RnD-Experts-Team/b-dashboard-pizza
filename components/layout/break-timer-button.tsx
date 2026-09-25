"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { liveCountedSeconds, useBreaksStore } from "@/lib/store/breaks.store";
import { useBreaksSync, useNow } from "@/lib/hooks/use-breaks";
import { useBreakAlerts } from "@/lib/hooks/use-break-alerts";
import { elapsedSeconds, floorMinutes, formatClock } from "@/lib/break-logger/work-date";
import { BreakPopoverBody } from "@/components/break-logger/break-popover";

/**
 * Topbar break-timer trigger — compact on purpose: a coffee icon, plus a live
 * clock while a break runs. Everything else lives one click away in the
 * popover (start / stop / note) or on the Breaks page.
 *
 * Backed by ToolboxPizza's Breaks API through `useBreaksStore`; this component
 * also owns the app-wide sync (`useBreaksSync`) since AppShell keeps it
 * mounted on every dashboard page. The clock ticks locally from `started_at`
 * — the server never sends ticks, only changes.
 */
export function BreakTimerButton() {
  const t = useTranslations("breaks");
  useBreaksSync();

  const active = useBreaksStore((s) => s.active);
  const today = useBreaksStore((s) => s.today);
  const settings = useBreaksStore((s) => s.settings);
  const onBreak = active != null;

  const now = useNow(onBreak);
  const [open, setOpen] = useState(false);

  const runningSeconds = active && now != null ? elapsedSeconds(active.started_at, now) : 0;
  const countedMinutes = floorMinutes(liveCountedSeconds(today, active, now ?? Date.now()));
  const allowance = settings?.daily_allowance_minutes ?? null;
  const isOver = allowance != null && onBreak && countedMinutes > allowance;

  // Toast + sound on milestones, the allowance and a long-running break.
  useBreakAlerts(now);

  // Keep the last clock face while the clock collapses, so it doesn't snap to 0:00.
  const lastFace = useRef("0:00");
  if (onBreak) lastFace.current = formatClock(runningSeconds);
  const clockFace = lastFace.current;

  // Avoid rendering a mismatched clock before the first client tick.
  if (now == null) return null;

  const tooltip = active
    ? t("timer.hintOnBreak", { label: active.label, clock: clockFace })
    : allowance != null && today
      ? t("timer.idleSummary", { used: countedMinutes, allowance })
      : t("timer.hintIdle");

  return (
    // data-guide-id: PageGuide spotlight target, used by the Dashboard V1 tour.
    <div data-guide-id="topbar-break-timer" className="relative flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        {/* Tooltip must sit OUTSIDE PopoverAnchor: the anchor needs a real DOM
            child to measure, and Tooltip's root renders none. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverAnchor asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("trigger")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  "relative gap-0 px-2 transition-colors duration-300 ease-out",
                  isOver
                    ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    : onBreak
                      ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Coffee className="h-4 w-4 shrink-0" />
                {/* Collapses (grid 1fr→0fr) instead of unmounting, so the
                    button shrinks smoothly when the break ends. */}
                <span
                  aria-hidden={!onBreak}
                  className={cn(
                    "grid transition-[grid-template-columns,margin,opacity] duration-300 ease-out motion-reduce:transition-none",
                    onBreak ? "ms-1.5 grid-cols-[1fr] opacity-100" : "ms-0 grid-cols-[0fr] opacity-0"
                  )}
                >
                  <span className="overflow-hidden whitespace-nowrap text-xs font-semibold tabular-nums">
                    {clockFace}
                  </span>
                </span>
                {isOver && (
                  <span className="absolute -top-0.5 -end-0.5 flex h-2.5 w-2.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  </span>
                )}
              </Button>
            </PopoverAnchor>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="bottom" className="tabular-nums">
              {isOver ? t("allowance.overAlert") : tooltip}
            </TooltipContent>
          )}
        </Tooltip>

        <PopoverContent align="end" className="w-80 p-3">
          <BreakPopoverBody
            liveCountedMinutes={countedMinutes}
            runningSeconds={runningSeconds}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
