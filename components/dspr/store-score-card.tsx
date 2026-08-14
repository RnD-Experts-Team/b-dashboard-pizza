"use client";

import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, Star, DollarSign, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt$ } from "@/components/dspr/wbr-format";
import type { DsprGoalMetric, StoreScoreData, UpsellingScoreRecord } from "@/types/dspr.types";

// ── Radial geometry constants (upselling ring) ────────────────────────────────
const CIRCLE_SIZE = 120;
const STROKE = 8;
const RADIUS = (CIRCLE_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Tab = "score" | "upselling";
type Period = "day" | "week_to_date";

interface UpsellingScoreProp {
  total_upselling_score_day?: number;
  total_upselling_score_week_to_date?: number;
  day?: UpsellingScoreRecord;
  week_to_date?: UpsellingScoreRecord;
}

interface StoreScoreCardProps {
  upsellingScore?: UpsellingScoreProp;
  goalMetrics?: DsprGoalMetric[];
  date?: Date;
  storeScore?: StoreScoreData;
  loading?: boolean;
  className?: string;
}

// ── Upselling item helpers ────────────────────────────────────────────────────
function formatUpsellKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseUpsellItems(record?: UpsellingScoreRecord): { name: string; value: number }[] {
  return (Object.entries(record ?? {}) as [string, number | undefined][])
    .filter(([, val]) => val != null)
    .map(([key, val]) => ({ name: formatUpsellKey(key), value: val as number }))
    .sort((a, b) => b.value - a.value);
}

/** Trim to at most 2 decimals without a trailing ".00"/".0". */
function fmtPts(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

// ── Score colour helpers ──────────────────────────────────────────────────────
function scoreColor(score: number, max = 100) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return "emerald";
  if (pct >= 60) return "amber";
  if (pct >= 40) return "orange";
  return "red";
}

const SCORE_TEXT: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
};
const SCORE_BAR: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
};
const SCORE_BG: Record<string, string> = {
  emerald: "bg-emerald-500/10 dark:bg-emerald-500/15",
  amber: "bg-amber-500/10 dark:bg-amber-500/15",
  orange: "bg-orange-500/10 dark:bg-orange-500/15",
  red: "bg-red-500/10 dark:bg-red-500/15",
};

// ── Store Score tab — animated ────────────────────────────────────────────────
function ScoreView({ storeScore }: { storeScore?: StoreScoreData }) {
  const totalBarRef   = useRef<HTMLDivElement | null>(null);
  const scoreNumRef   = useRef<HTMLSpanElement | null>(null);
  const detailBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRefs       = useRef<Record<string, number>>({});

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
    if (!storeScore) return;

    const { score, details } = storeScore;
    const totalMax = details.reduce((s, d) => s + d.max, 0) || 100;
    const totalPct = Math.min(100, (score / totalMax) * 100);

    // Reset all animated elements to zero
    if (scoreNumRef.current) scoreNumRef.current.textContent = "0";
    if (totalBarRef.current) totalBarRef.current.style.width = "0%";
    detailBarRefs.current.forEach((ref) => { if (ref) ref.style.width = "0%"; });

    const dur = 750;

    // Animate total score number
    animateTo("scoreNum", 0, score, dur, (val) => {
      if (!scoreNumRef.current) return;
      const r = Math.round(val * 10) / 10;
      scoreNumRef.current.textContent = Number.isInteger(r) ? String(r) : r.toFixed(1);
    });

    // Animate total bar
    animateTo("totalBar", 0, totalPct, dur, (val) => {
      if (totalBarRef.current) totalBarRef.current.style.width = `${val}%`;
    });

    // Stagger detail bars — each starts 60 ms after the previous
    details.forEach((d, i) => {
      const pct = d.max > 0 ? Math.min(100, (d.score / d.max) * 100) : 0;
      setTimeout(() => {
        animateTo(`bar_${i}`, 0, pct, dur, (val) => {
          const ref = detailBarRefs.current[i];
          if (ref) ref.style.width = `${Math.min(100, val)}%`;
        });
      }, i * 60);
    });

    return () => {
      Object.values(rafRefs.current).forEach((id) => id && cancelAnimationFrame(id));
      rafRefs.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeScore]);

  if (!storeScore) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
        No score data available
      </div>
    );
  }

  const { label, details, non_negotiable } = storeScore;
  const totalMax = details.reduce((s, d) => s + d.max, 0) || 100;
  const color = scoreColor(storeScore.score, totalMax);
  const hasPenalty = non_negotiable.penalty !== 0;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Total score row */}
      <div className={cn("rounded-md px-2 py-1.5 flex items-center justify-between gap-2", SCORE_BG[color])}>
        <div className="flex items-baseline gap-1">
          <span
            ref={scoreNumRef}
            className={cn("text-2xl font-extrabold tabular-nums leading-none", SCORE_TEXT[color])}
          >
            0
          </span>
          <span className="text-[10px] text-muted-foreground">/ {totalMax} pts</span>
        </div>
        <span className={cn("text-[11px] font-semibold", SCORE_TEXT[color])}>
          {label}
        </span>
      </div>

      {/* Total progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          ref={totalBarRef}
          className={cn("h-full rounded-full", SCORE_BAR[color])}
          style={{ width: "0%" }}
        />
      </div>

      {/* Detail rows */}
      <div className="mt-0.5 space-y-[3px]">
        {details.map((d, i) => {
          const c = scoreColor(d.score, d.max);
          const isPerfect = d.score >= d.max;
          return (
            <div key={d.key} className="flex items-center gap-1.5">
              <span className="w-[108px] shrink-0 text-[9.5px] text-muted-foreground leading-tight truncate">
                {d.label}
                {d.actual_percent != null && (
                  <span className="ml-0.5 text-[8.5px] text-muted-foreground/60">
                    ({d.actual_percent.toFixed(1)}%)
                  </span>
                )}
              </span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  ref={(el) => { detailBarRefs.current[i] = el; }}
                  className={cn("h-full rounded-full", isPerfect ? "bg-emerald-500" : SCORE_BAR[c])}
                  style={{ width: "0%" }}
                />
              </div>
              <span className={cn("w-12 text-right text-[9px] tabular-nums font-semibold shrink-0", isPerfect ? "text-emerald-600 dark:text-emerald-400" : SCORE_TEXT[c])}>
                {d.score % 1 === 0 ? d.score : d.score.toFixed(1)} / {d.max % 1 === 0 ? d.max : d.max.toFixed(1)}
              </span>
            </div>
          );
        })}

        {/* Non-negotiable penalty row */}
        {hasPenalty && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40 mt-0.5">
            <span className="w-[108px] shrink-0 text-[9.5px] text-red-600 dark:text-red-400 leading-tight">
              Non-Negotiable Penalty
            </span>
            <div className="flex-1" />
            <span className="w-12 text-right text-[9px] tabular-nums font-semibold text-red-600 dark:text-red-400">
              -{Math.abs(non_negotiable.penalty)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function StoreScoreCard({
  upsellingScore,
  goalMetrics,
  date,
  storeScore,
  loading = false,
  className,
}: StoreScoreCardProps) {
  const [tab, setTab] = useState<Tab>("score");
  const [period, setPeriod] = useState<Period>("day");
  const dayLabel = date ? format(date, "MMM d") : "Today";

  // ── Upselling derived values ──────────────────────────────────────────────
  const upsMetric = goalMetrics?.find((m) =>
    m.metric_name.toLowerCase().includes("upselling"),
  );
  const weeklyGoal = upsMetric ? parseFloat(upsMetric.goals[0]?.goal ?? "0") : null;
  const goal   = weeklyGoal ?? 0;
  const noGoal = goal === 0;

  const dayTotal  = upsellingScore?.total_upselling_score_day ?? 0;
  const weekTotal = upsellingScore?.total_upselling_score_week_to_date ?? 0;
  const weekPct = noGoal ? 0 : (weekTotal / goal) * 100;
  const dayPct  = noGoal ? 0 : (dayTotal  / goal) * 100;
  const dayBarPct  = noGoal ? (weekTotal > 0 ? (dayTotal / weekTotal) * 100 : 0) : Math.min(dayPct, 100);
  const weekBarPct = noGoal ? (weekTotal > 0 ? 100 : 0) : Math.min(weekPct, 100);

  // Whichever period is toggled inside the Upselling tab
  const activeTotal = period === "day" ? dayTotal : weekTotal;
  const activePct   = period === "day" ? dayPct   : weekPct;
  const activeItems = parseUpsellItems(period === "day" ? upsellingScore?.day : upsellingScore?.week_to_date);
  const maxItemValue = Math.max(...activeItems.map((i) => i.value), 1);

  // Manager cash bonus — always week-to-date based, +$10 per 25pts above 100%, capped at 300% (=$80)
  const bonusSteps = noGoal ? 0 : Math.min(8, Math.max(0, Math.floor((weekPct - 100) / 25)));
  const bonusDollars = bonusSteps * 10;

  const circleColorClass =
    noGoal ? "text-muted-foreground/30" : activePct >= 90 ? "text-emerald-400" : activePct >= 60 ? "text-amber-400" : "text-violet-400";
  const centerColorClass =
    noGoal ? "text-muted-foreground" : activePct >= 90 ? "text-emerald-500" : activePct >= 60 ? "text-amber-500" : "text-violet-500";
  const weekBarColorClass =
    noGoal ? "bg-violet-400/50" : weekPct >= 90 ? "bg-emerald-400" : weekPct >= 60 ? "bg-amber-400" : "bg-violet-400";
  const statusLabel =
    noGoal ? "No Goal Set" : activePct >= 100 ? "Goal Met!" : activePct >= 80 ? "Almost There" : activePct >= 50 ? "On Track" : "Keep Going";

  // ── DOM refs for upselling animation ─────────────────────────────────────
  const centerCountRef = useRef<HTMLDivElement | null>(null);
  const circleRef      = useRef<SVGCircleElement | null>(null);
  const dayBarRef      = useRef<HTMLDivElement | null>(null);
  const dayTextRef     = useRef<HTMLDivElement | null>(null);
  const weekBarRef     = useRef<HTMLDivElement | null>(null);
  const weekTextRef    = useRef<HTMLDivElement | null>(null);
  const rafRefs        = useRef<Record<string, number>>({});

  function animateTo(key: string, from: number, to: number, duration: number, onUpdate: (val: number) => void) {
    if (rafRefs.current[key]) cancelAnimationFrame(rafRefs.current[key]);
    const start = performance.now();
    const diff = to - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      onUpdate(from + diff * eased);
      if (t < 1) { rafRefs.current[key] = requestAnimationFrame(tick); } else { delete rafRefs.current[key]; }
    };
    rafRefs.current[key] = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (tab !== "upselling") return;
    if (!noGoal && centerCountRef.current) centerCountRef.current.textContent = loading ? "—" : "0%";
    if (circleRef.current)  circleRef.current.style.strokeDashoffset = `${CIRCUMFERENCE}`;
    if (dayBarRef.current)  dayBarRef.current.style.width  = "0%";
    if (dayTextRef.current) dayTextRef.current.textContent = "0";
    if (weekBarRef.current) weekBarRef.current.style.width = "0%";
    if (weekTextRef.current) weekTextRef.current.textContent = "0";
    if (loading) return;
    const dur = 750;
    animateTo("circle", 0, noGoal ? 0 : Math.min(activePct, 100), dur, (val) => {
      if (circleRef.current) circleRef.current.style.strokeDashoffset = `${CIRCUMFERENCE - (val / 100) * CIRCUMFERENCE}`;
    });
    if (!noGoal) {
      setTimeout(() => animateTo("count", 0, activePct, dur, (val) => {
        if (centerCountRef.current) centerCountRef.current.textContent = Math.round(val) + "%";
      }), 50);
    }
    setTimeout(() => {
      animateTo("dayBar", 0, dayBarPct, dur, (val) => { if (dayBarRef.current) dayBarRef.current.style.width = `${Math.min(100, val)}%`; });
      animateTo("dayText", 0, dayTotal, dur, (val) => { if (dayTextRef.current) dayTextRef.current.textContent = fmtPts(val); });
    }, 100);
    setTimeout(() => {
      animateTo("weekBar", 0, weekBarPct, dur, (val) => { if (weekBarRef.current) weekBarRef.current.style.width = `${Math.min(100, val)}%`; });
      animateTo("weekText", 0, weekTotal, dur, (val) => { if (weekTextRef.current) weekTextRef.current.textContent = fmtPts(val); });
    }, 150);
    return () => { Object.values(rafRefs.current).forEach((id) => id && cancelAnimationFrame(id)); rafRefs.current = {}; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, period, activePct, dayBarPct, weekBarPct, dayTotal, weekTotal, noGoal, loading]);

  return (
    <Card
      className={cn(
        "relative flex flex-col h-[280px] overflow-hidden transition-shadow py-2 px-3",
        tab === "score"
          ? "bg-linear-to-r from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950/30 dark:via-slate-900/30 dark:to-slate-800/40"
          : "bg-linear-to-r from-violet-50 via-purple-50 to-violet-100 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-violet-900/40",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        {tab === "score"
          ? <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          : <TrendingUp className="h-3.5 w-3.5 text-violet-500 shrink-0" />
        }
        <span className="text-[11px] font-semibold">
          {tab === "score" ? "Store Score" : "Upselling"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {/* Score / Upselling tab toggle */}
          <div className="inline-flex overflow-hidden rounded-md border border-border/60 bg-background/40 text-[9px] font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setTab("score")}
              className={cn(
                "px-1.5 py-0.5 transition-colors",
                tab === "score" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Score
            </button>
            <button
              type="button"
              onClick={() => setTab("upselling")}
              className={cn(
                "px-1.5 py-0.5 transition-colors",
                tab === "upselling" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Upselling
            </button>
          </div>
          {/* Day / Week-to-Date period switch — calendar icon button, same pattern as top-lists.tsx / portal-ontime-dual-gauge.tsx */}
          {tab === "upselling" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 rounded shrink-0",
                    period === "week_to_date" ? "bg-primary/15 text-primary" : "text-muted-foreground/40",
                  )}
                  onClick={() => setPeriod((p) => (p === "day" ? "week_to_date" : "day"))}
                >
                  <CalendarDays className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{period === "week_to_date" ? "Switch to Daily" : "Switch to Week-to-Date"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <CardContent className="flex-1 min-h-0 overflow-y-auto p-0">
        {tab === "score" ? (
          <ScoreView storeScore={storeScore} />
        ) : (
          /* ── Upselling view ── */
          <div className="flex flex-col gap-2">
            {/* Manager cash bonus banner — always week-to-date based */}
            {bonusDollars > 0 && (
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 dark:bg-emerald-500/15">
                <DollarSign className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Bonus unlocked: {fmt$(bonusDollars)}{" "}
                  <span className="font-normal text-emerald-600/80 dark:text-emerald-400/70">
                    ({Math.round(weekPct)}% of weekly goal)
                  </span>
                </span>
              </div>
            )}

            {/* Ring + at-a-glance day/week bars */}
            <div className="flex flex-col gap-2 items-center justify-center text-center">
              <div
                className="relative flex items-center justify-center"
                style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
              >
                <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="-rotate-90">
                  <circle cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RADIUS} strokeWidth={STROKE} stroke="currentColor" style={{ color: "var(--muted)" }} fill="transparent" strokeOpacity={0.15} />
                  <circle cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RADIUS} strokeWidth={STROKE} strokeLinecap="round" stroke="currentColor" className={circleColorClass} fill="transparent" strokeDasharray={`${CIRCUMFERENCE}`} ref={circleRef} strokeDashoffset={`${CIRCUMFERENCE}`} style={{ transition: "stroke-dashoffset 120ms linear" }} />
                </svg>
                <div className="absolute flex flex-col items-center gap-1">
                  {noGoal ? (
                    <>
                      <div className="text-[13px] font-semibold text-muted-foreground leading-tight">No Goal</div>
                      <div className="text-[10px] text-muted-foreground/60 leading-none">not configured</div>
                    </>
                  ) : (
                    <>
                      <div ref={centerCountRef} className={cn("text-2xl font-extrabold leading-none tabular-nums", centerColorClass)}>{loading ? "—" : "0%"}</div>
                      <div className="text-[10px] text-muted-foreground leading-none tabular-nums">/ {goal.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{statusLabel}</div>
                    </>
                  )}
                </div>
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] w-16 text-left text-muted-foreground shrink-0">{dayLabel}</span>
                  <div className="flex-1"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div ref={dayBarRef} className="h-full rounded-full bg-violet-400/70" style={{ width: "0%" }} /></div></div>
                  <div ref={dayTextRef} className="w-10 text-right text-[11px] font-semibold tabular-nums">0</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] w-16 text-left text-muted-foreground shrink-0">This Week</span>
                  <div className="flex-1"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div ref={weekBarRef} className={cn("h-full rounded-full", weekBarColorClass)} style={{ width: "0%" }} /></div></div>
                  <div ref={weekTextRef} className="w-10 text-right text-[11px] font-semibold tabular-nums">0</div>
                </div>
              </div>
            </div>

            {/* Per-item breakdown for the toggled period */}
            <div className="w-full space-y-1">
              <div className="px-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {period === "day" ? `${dayLabel} items` : "Week to date items"}
              </div>
              {activeItems.length === 0 ? (
                <div className="py-2 text-center text-[10px] text-muted-foreground">No item data</div>
              ) : (
                activeItems.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="w-[92px] shrink-0 truncate text-[9.5px] text-muted-foreground">{item.name}</span>
                    <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-400/70 transition-all duration-300"
                        style={{ width: `${(item.value / maxItemValue) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[9px] font-semibold tabular-nums">{fmtPts(item.value)}</span>
                  </div>
                ))
              )}
              <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1">
                <span className="text-[9.5px] font-semibold">Total</span>
                <span className="text-[11px] font-bold tabular-nums">{fmtPts(activeTotal)} pts</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StoreScoreCard;
