"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { liveCountedSeconds, useBreaksStore } from "@/lib/store/breaks.store";
import { elapsedSeconds, floorMinutes } from "@/lib/break-logger/work-date";
import { playSfx } from "@/lib/uisfx/play";
import { parseBreakError } from "@/lib/break-logger/errors";

/** One running break this long gets a "still on break?" nudge (guide §7: no server cap exists). */
export const LONG_BREAK_MINUTES = 30;

const STORAGE_PREFIX = "breaks.alerts.";

function loadSeen(workDate: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + workDate);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(workDate: string, seen: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + workDate, JSON.stringify([...seen]));
  } catch {
    // Private mode / blocked storage — alerts may repeat after a reload; harmless.
  }
}

/**
 * Toast + sound at the moment a break crosses something worth knowing:
 *   - a milestone the user set (counted minutes reach a threshold),
 *   - the daily allowance (soft — nothing is blocked, so one warning),
 *   - one running break reaching LONG_BREAK_MINUTES ("still on break?").
 *
 * Evaluated on the local 1-second tick from the live counted total, so it
 * fires when the line is actually crossed rather than on the next 30s poll.
 * Each alert fires at most once per work day (remembered in sessionStorage);
 * anything already crossed when first seen — page load, a manual entry, a
 * second tab — is marked silently, never announced late.
 *
 * Complements, not replaces, the server's own `break_milestone_reached` /
 * `break_allowance_exceeded` bell notifications (off by default upstream).
 */
export function useBreakAlerts(now: number | null): void {
  const t = useTranslations("breaks.alerts");
  const tErrors = useTranslations("breaks.errors");
  const active = useBreaksStore((s) => s.active);
  const today = useBreaksStore((s) => s.today);
  const settings = useBreaksStore((s) => s.settings);
  const stop = useBreaksStore((s) => s.stop);

  const seenRef = useRef<{ date: string; seen: Set<string> } | null>(null);
  const primedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!today || !settings || now == null) return;
    // Per user AND work day: a second account in the same tab has its own alerts.
    const date = `${today.user.id}.${today.work_date}`;
    if (seenRef.current?.date !== date) seenRef.current = { date, seen: loadSeen(date) };
    const { seen } = seenRef.current;

    // The running break only moves today's totals when it belongs to today.
    const runningToday = !!active && !active.belongs_to_previous_work_day;
    const counted = floorMinutes(liveCountedSeconds(today, active, now));
    const allowance = settings.daily_allowance_minutes;
    const thresholds = today.milestones.thresholds;
    const runningMinutes = active ? floorMinutes(elapsedSeconds(active.started_at, now)) : 0;

    const due: { key: string; fire: () => void }[] = [];
    for (const m of thresholds) {
      if (counted < m) continue;
      due.push({
        key: `m${m}`,
        fire: () => {
          playSfx("notification");
          toast.info(t("milestoneTitle", { minutes: m }), {
            description:
              counted > allowance
                ? t("milestoneBodyOver", { used: counted, allowance, over: counted - allowance })
                : t("milestoneBody", { used: counted, allowance, left: allowance - counted }),
          });
        },
      });
    }
    if (counted > allowance) {
      due.push({
        key: "allowance",
        fire: () => {
          playSfx("warning", { volume: 1 });
          toast.warning(t("allowanceTitle"), {
            description: t("allowanceBody", { used: counted, allowance, over: counted - allowance }),
            duration: 10_000,
          });
        },
      });
    }
    if (active && runningMinutes >= LONG_BREAK_MINUTES) {
      due.push({
        key: `long${active.id}`,
        fire: () => {
          playSfx("warning");
          toast.warning(t("longTitle"), {
            description: t("longBody", { label: active.label, minutes: runningMinutes }),
            duration: 15_000,
            action: {
              label: t("endBreak"),
              // Stopped elsewhere is already a success inside `stop()`; anything
              // else must be said, or the user thinks the break ended.
              onClick: () =>
                stop().catch((err) => {
                  const e = parseBreakError(err);
                  if (e.code !== "CANCELLED") toast.error(tErrors(e.code));
                }),
            },
          });
        },
      });
    }

    // First look at this work day in this tab: whatever is already crossed is old news.
    const priming = primedRef.current !== date;
    primedRef.current = date;

    let changed = false;
    for (const d of due) {
      if (seen.has(d.key)) continue;
      seen.add(d.key);
      changed = true;
      // Only a live break crossing a line right now is worth an interruption.
      const isLongAlert = d.key.startsWith("long");
      if (!priming && (runningToday || (isLongAlert && active))) d.fire();
    }
    if (changed) saveSeen(date, seen);
  }, [now, active, today, settings, stop, t, tErrors]);
}
