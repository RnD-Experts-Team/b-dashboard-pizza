"use client";

import React, { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DsprGoalMetric } from "@/types/dspr.types";

// ── Radial geometry constants ─────────────────────────────────────────────────
const CIRCLE_SIZE = 120;
const STROKE = 8;
const RADIUS = (CIRCLE_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface StoreScoreCardProps {
  /** day.upselling.total_upselling_day */
  upsellingDay?: number;
  /** day.upselling.total_upselling_week_to_date */
  upsellingWeek?: number;
  goalMetrics?: DsprGoalMetric[];
  /** The selected date to display in the "Today" row label */
  date?: Date;
  loading?: boolean;
  className?: string;
}

export function StoreScoreCard({
  upsellingDay = 0,
  upsellingWeek = 0,
  goalMetrics,
  date,
  loading = false,
  className,
}: StoreScoreCardProps) {
  const dayLabel = date ? format(date, "MMM d") : "Today";
  // ── Derive upselling weekly goal from DSPR goal_metrics ───────────────────
  const upsMetric = goalMetrics?.find((m) =>
    m.metric_name.toLowerCase().includes("upselling"),
  );
  const weeklyGoal = upsMetric ? parseFloat(upsMetric.goals[0]?.goal ?? "0") : null;

  // ── Derived values ────────────────────────────────────────────────────────
  const goal   = weeklyGoal ?? 0;
  const noGoal = goal === 0;

  const weekPct = noGoal ? 0 : (upsellingWeek / goal) * 100;
  const dayPct  = noGoal ? 0 : (upsellingDay  / goal) * 100;

  // When no goal: scale bars relative to week total so day shows its share
  const dayBarPct  = noGoal
    ? (upsellingWeek > 0 ? (upsellingDay / upsellingWeek) * 100 : 0)
    : Math.min(dayPct, 100);
  const weekBarPct = noGoal
    ? (upsellingWeek > 0 ? 100 : 0)
    : Math.min(weekPct, 100);

  const circleColorClass =
    noGoal         ? "text-muted-foreground/30" :
    weekPct >= 90  ? "text-emerald-400" :
    weekPct >= 60  ? "text-amber-400"   :
    "text-violet-400";

  const centerColorClass =
    noGoal         ? "text-muted-foreground" :
    weekPct >= 90  ? "text-emerald-500" :
    weekPct >= 60  ? "text-amber-500"   :
    "text-violet-500";

  const weekBarColorClass =
    noGoal         ? "bg-violet-400/50" :
    weekPct >= 90  ? "bg-emerald-400" :
    weekPct >= 60  ? "bg-amber-400"   :
    "bg-violet-400";

  const statusLabel =
    noGoal         ? (upsellingWeek > 0 ? "No Goal Set" : "No Goal Set") :
    weekPct >= 100 ? "Goal Met!" :
    weekPct >= 80  ? "Almost There" :
    weekPct >= 50  ? "On Track"   :
    "Keep Going";

  // ── DOM refs (bypass React re-renders during animation) ───────────────────
  const centerCountRef = useRef<HTMLDivElement | null>(null);
  const circleRef      = useRef<SVGCircleElement | null>(null);
  const dayBarRef      = useRef<HTMLDivElement | null>(null);
  const dayTextRef     = useRef<HTMLDivElement | null>(null);
  const weekBarRef     = useRef<HTMLDivElement | null>(null);
  const weekTextRef    = useRef<HTMLDivElement | null>(null);
  const rafRefs        = useRef<Record<string, number>>({});

  // Generic RAF animator with ease-out-cubic easing
  function animateTo(
    key: string,
    from: number,
    to: number,
    duration: number,
    onUpdate: (val: number) => void,
  ) {
    if (rafRefs.current[key]) cancelAnimationFrame(rafRefs.current[key]);
    const start = performance.now();
    const diff = to - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      onUpdate(from + diff * eased);
      if (t < 1) {
        rafRefs.current[key] = requestAnimationFrame(tick);
      } else {
        delete rafRefs.current[key];
      }
    };
    rafRefs.current[key] = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!noGoal && centerCountRef.current) centerCountRef.current.textContent = loading ? "—" : "0%";
    if (circleRef.current)      circleRef.current.style.strokeDashoffset = `${CIRCUMFERENCE}`;
    if (dayBarRef.current)      dayBarRef.current.style.width   = "0%";
    if (dayTextRef.current)     dayTextRef.current.textContent  = "0";
    if (weekBarRef.current)     weekBarRef.current.style.width  = "0%";
    if (weekTextRef.current)    weekTextRef.current.textContent = "0";

    if (loading) return;

    const dur = 750;

    // Ring — show % of goal when goal exists, else stay empty
    animateTo("circle", 0, noGoal ? 0 : Math.min(weekPct, 100), dur, (val) => {
      if (circleRef.current)
        circleRef.current.style.strokeDashoffset = `${CIRCUMFERENCE - (val / 100) * CIRCUMFERENCE}`;
    });

    // Center — only animate when a goal exists
    if (!noGoal) {
      setTimeout(() => animateTo("count", 0, weekPct, dur, (val) => {
        if (centerCountRef.current)
          centerCountRef.current.textContent = Math.round(val) + "%";
      }), 50);
    }

    // Today bar + count
    setTimeout(() => {
      animateTo("dayBar", 0, dayBarPct, dur, (val) => {
        if (dayBarRef.current) dayBarRef.current.style.width = `${Math.min(100, val)}%`;
      });
      animateTo("dayText", 0, upsellingDay, dur, (val) => {
        if (dayTextRef.current) dayTextRef.current.textContent = Math.round(val).toLocaleString();
      });
    }, 100);

    // Week bar + count
    setTimeout(() => {
      animateTo("weekBar", 0, weekBarPct, dur, (val) => {
        if (weekBarRef.current) weekBarRef.current.style.width = `${Math.min(100, val)}%`;
      });
      animateTo("weekText", 0, upsellingWeek, dur, (val) => {
        if (weekTextRef.current) weekTextRef.current.textContent = Math.round(val).toLocaleString();
      });
    }, 150);

    return () => {
      Object.values(rafRefs.current).forEach((id) => id && cancelAnimationFrame(id));
      rafRefs.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPct, dayPct, dayBarPct, weekBarPct, upsellingDay, upsellingWeek, noGoal, loading]);

  return (
    <Card
      className={cn(
        "relative group transition-shadow py-2 px-3",
        "bg-linear-to-r from-violet-50 via-purple-50 to-violet-100",
        "dark:from-violet-950/30 dark:via-purple-950/30 dark:to-violet-900/40",
        className,
      )}
    >
      {/* Header */}
      <div className="absolute top-2 left-3 flex items-center gap-1.5 pointer-events-none">
        <TrendingUp className="h-4 w-4 text-violet-500" />
        <span className="text-[11px] font-semibold">Upselling</span>
        <span className="text-[9px] text-muted-foreground font-normal">
          {noGoal ? "no goal set" : `goal: ${goal.toLocaleString()}`}
        </span>
      </div>

      <CardContent className="flex flex-col gap-2 items-center justify-center text-center h-full">
        {/* Radial ring */}
        <div
          className="relative flex items-center justify-center mt-4"
          style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
        >
          <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="-rotate-90">
            {/* Track */}
            <circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              stroke="currentColor"
              style={{ color: "var(--muted)" }}
              fill="transparent"
              strokeOpacity={0.15}
            />
            {/* Progress arc */}
            <circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              strokeLinecap="round"
              stroke="currentColor"
              className={circleColorClass}
              fill="transparent"
              strokeDasharray={`${CIRCUMFERENCE}`}
              ref={circleRef}
              strokeDashoffset={`${CIRCUMFERENCE}`}
              style={{ transition: "stroke-dashoffset 120ms linear" }}
            />
          </svg>

          {/* Center text */}
          <div className="absolute flex flex-col items-center gap-1">
            {noGoal ? (
              <>
                <div className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  No Goal
                </div>
                <div className="text-[10px] text-muted-foreground/60 leading-none">
                  not configured
                </div>
              </>
            ) : (
              <>
                <div
                  ref={centerCountRef}
                  className={cn("text-2xl font-extrabold leading-none tabular-nums", centerColorClass)}
                >
                  {loading ? "—" : "0%"}
                </div>
                <div className="text-[10px] text-muted-foreground leading-none tabular-nums">
                  / {goal.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {statusLabel}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="w-full space-y-2">
          {/* Today */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 text-left text-muted-foreground shrink-0">
              {dayLabel}
            </span>
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  ref={dayBarRef}
                  className="h-full rounded-full bg-violet-400/70"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
            <div
              ref={dayTextRef}
              className="w-8 text-right text-[11px] font-semibold tabular-nums"
            >
              0
            </div>
          </div>

          {/* This Week */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 text-left text-muted-foreground shrink-0">
              This Week
            </span>
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  ref={weekBarRef}
                  className={cn("h-full rounded-full", weekBarColorClass)}
                  style={{ width: "0%" }}
                />
              </div>
            </div>
            <div
              ref={weekTextRef}
              className="w-8 text-right text-[11px] font-semibold tabular-nums"
            >
              0
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoreScoreCard;
