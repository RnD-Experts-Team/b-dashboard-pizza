"use client";

import { format } from "date-fns";
import type { DsprGoalMetric } from "@/types/dspr.types";
import { cn } from "@/lib/utils";
import { V1Card } from "../v1-card";
import { fmtNum } from "@/components/dspr/wbr-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1StoreScoreCard — Upselling progress.
 *  The upselling LOGIC is preserved verbatim from the original StoreScoreCard
 *  (goal derived from goal_metrics, day/week percent of goal, no-goal fallback
 *  scaling). Only the presentation is refreshed into the V1 shell.
 * ────────────────────────────────────────────────────────────────────────── */

const SIZE = 104;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function V1StoreScoreCard({
  upsellingDay = 0,
  upsellingWeek = 0,
  goalMetrics,
  date,
  span,
  className,
}: {
  upsellingDay?: number;
  upsellingWeek?: number;
  goalMetrics?: DsprGoalMetric[];
  date?: Date;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const dayLabel = date ? format(date, "MMM d") : "Today";

  // ── Upselling logic (unchanged from StoreScoreCard) ─────────────────────
  const upsMetric = goalMetrics?.find((m) =>
    m.metric_name.toLowerCase().includes("upselling"),
  );
  const weeklyGoal = upsMetric ? parseFloat(upsMetric.goals[0]?.goal ?? "0") : null;
  const goal = weeklyGoal ?? 0;
  const noGoal = goal === 0;

  const weekPct = noGoal ? 0 : (upsellingWeek / goal) * 100;
  const dayPct = noGoal ? 0 : (upsellingDay / goal) * 100;
  const dayBarPct = noGoal
    ? upsellingWeek > 0
      ? (upsellingDay / upsellingWeek) * 100
      : 0
    : Math.min(dayPct, 100);
  const weekBarPct = noGoal ? (upsellingWeek > 0 ? 100 : 0) : Math.min(weekPct, 100);

  const ringColor = noGoal
    ? "#a1a1aa"
    : weekPct >= 90
      ? "#34d399"
      : weekPct >= 60
        ? "#fbbf24"
        : "#a78bfa";

  const statusLabel = noGoal
    ? "No Goal Set"
    : weekPct >= 100
      ? "Goal Met!"
      : weekPct >= 80
        ? "Almost There"
        : weekPct >= 50
          ? "On Track"
          : "Keep Going";

  const offset = CIRC - (Math.min(weekBarPct, 100) / 100) * CIRC;

  return (
    <V1Card
      title="Upselling"
      category="sales"
      period="D·WTD"
      span={span}
      className={className}
      headerNote={noGoal ? "no goal" : `goal ${fmtNum(goal)}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} stroke="currentColor" className="text-muted" strokeOpacity={0.2} fill="transparent" />
            {!noGoal && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                strokeWidth={STROKE}
                strokeLinecap="round"
                stroke={ringColor}
                fill="transparent"
                strokeDasharray={`${CIRC}`}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 600ms ease" }}
              />
            )}
          </svg>
          <div className="absolute flex flex-col items-center">
            {noGoal ? (
              <span className="text-[13px] font-semibold text-muted-foreground">No Goal</span>
            ) : (
              <>
                <span className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: ringColor }}>
                  {Math.round(weekPct)}%
                </span>
                <span className="text-[9px] leading-none text-muted-foreground">{statusLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full space-y-1.5">
          <ScoreRow label={dayLabel} barPct={dayBarPct} value={upsellingDay} color="#a78bfa" />
          <ScoreRow label="This Week" barPct={weekBarPct} value={upsellingWeek} color={ringColor} />
        </div>
      </div>
    </V1Card>
  );
}

function ScoreRow({
  label,
  barPct,
  value,
  color,
}: {
  label: string;
  barPct: number;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 truncate text-left text-[10px] text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all")}
          style={{ width: `${Math.min(100, barPct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-[11px] font-semibold tabular-nums">{fmtNum(value)}</span>
    </div>
  );
}
