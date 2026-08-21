"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Star, TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/uisfx/play";
import { fmt$ } from "@/components/dspr/wbr-format";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import type { DsprGoalMetric, StoreScoreData, UpsellingScoreRecord } from "@/types/dspr.types";
import { V1Card } from "../v1-card";
import { V1SubLabel, V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "../v1-ui";

/* ── Radial geometry (upselling ring) ────────────────────────────────────── */
const RING = 96;
const STROKE = 7;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Tab = "score" | "upselling";

/** +$10 per 25pts above 100%, capped at 300% (=$80). */
const BONUS_TIERS = [125, 150, 175, 200, 225, 250, 275, 300].map((pct) => ({
  pct,
  dollars: ((pct - 100) / 25) * 10,
}));

const RANK_BADGE = [
  "bg-amber-500 text-white", // #1 gold
  "bg-slate-400 text-white", // #2 silver
  "bg-amber-700 text-white", // #3 bronze
  "bg-muted text-muted-foreground", // #4
  "bg-muted text-muted-foreground", // #5+
];

interface UpsellingScoreProp {
  total_upselling_score_day?: number;
  total_upselling_score_week_to_date?: number;
  day?: UpsellingScoreRecord;
  week_to_date?: UpsellingScoreRecord;
}

/* ── Score colour helpers ─────────────────────────────────────────────────── */
function scoreColor(score: number, max = 100) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return "emerald";
  if (pct >= 60) return "amber";
  if (pct >= 40) return "orange";
  return "red";
}
const SCORE_TEXT: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber:   "text-amber-600 dark:text-amber-400",
  orange:  "text-orange-600 dark:text-orange-400",
  red:     "text-red-600 dark:text-red-400",
};
const SCORE_BAR: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  orange:  "bg-orange-500",
  red:     "bg-red-500",
};
const SCORE_BG: Record<string, string> = {
  emerald: "bg-emerald-500/10 dark:bg-emerald-500/15",
  amber:   "bg-amber-500/10 dark:bg-amber-500/15",
  orange:  "bg-orange-500/10 dark:bg-orange-500/15",
  red:     "bg-red-500/10 dark:bg-red-500/15",
};

/* ── Upselling item helpers ───────────────────────────────────────────────── */
function formatUpsellKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Trim to at most 2 decimals without a trailing ".00"/".0". */
function fmtPts(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/* ── RAF helper ──────────────────────────────────────────────────────────── */
function makeAnimator() {
  const rafs: Record<string, number> = {};
  function animateTo(
    key: string,
    from: number,
    to: number,
    duration: number,
    onUpdate: (val: number) => void,
  ) {
    if (rafs[key]) cancelAnimationFrame(rafs[key]);
    const start = performance.now();
    const diff = to - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      onUpdate(from + diff * eased);
      if (t < 1) { rafs[key] = requestAnimationFrame(tick); } else { delete rafs[key]; }
    };
    rafs[key] = requestAnimationFrame(tick);
  }
  function cancelAll() {
    Object.values(rafs).forEach((id) => id && cancelAnimationFrame(id));
    Object.keys(rafs).forEach((k) => delete rafs[k]);
  }
  return { animateTo, cancelAll };
}

/* ── Score view (animated detail bars) ──────────────────────────────────── */
function ScoreView({ storeScore }: { storeScore?: StoreScoreData }) {
  const totalBarRef   = useRef<HTMLDivElement | null>(null);
  const scoreNumRef   = useRef<HTMLSpanElement | null>(null);
  const detailBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animator      = useRef(makeAnimator());

  useEffect(() => {
    const { animateTo, cancelAll } = animator.current;
    if (!storeScore) return;

    const { score, details } = storeScore;
    const totalMax = details.reduce((s, d) => s + d.max, 0) || 100;
    const totalPct = Math.min(100, (score / totalMax) * 100);

    // Reset to zero
    if (scoreNumRef.current) scoreNumRef.current.textContent = "0";
    if (totalBarRef.current) totalBarRef.current.style.width = "0%";
    detailBarRefs.current.forEach((ref) => { if (ref) ref.style.width = "0%"; });

    const dur = 750;

    animateTo("scoreNum", 0, score, dur, (val) => {
      if (!scoreNumRef.current) return;
      const r = Math.round(val * 10) / 10;
      scoreNumRef.current.textContent = Number.isInteger(r) ? String(r) : r.toFixed(1);
    });
    animateTo("totalBar", 0, totalPct, dur, (val) => {
      if (totalBarRef.current) totalBarRef.current.style.width = `${val}%`;
    });
    details.forEach((d, i) => {
      const pct = d.max > 0 ? Math.min(100, (d.score / d.max) * 100) : 0;
      setTimeout(() => {
        animateTo(`bar_${i}`, 0, pct, dur, (val) => {
          const ref = detailBarRefs.current[i];
          if (ref) ref.style.width = `${Math.min(100, val)}%`;
        });
      }, i * 60);
    });

    return () => cancelAll();
  }, [storeScore]);

  if (!storeScore) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
        No score data
      </div>
    );
  }

  const { label, details, non_negotiable } = storeScore;
  const totalMax   = details.reduce((s, d) => s + d.max, 0) || 100;
  const color      = scoreColor(storeScore.score, totalMax);
  const hasPenalty = non_negotiable.penalty !== 0;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Total row */}
      <div className={cn("rounded-md px-2 py-1.5 flex items-center justify-between gap-2", SCORE_BG[color])}>
        <div className="flex items-baseline gap-1">
          <span ref={scoreNumRef} className={cn("text-2xl font-extrabold tabular-nums leading-none", SCORE_TEXT[color])}>
            0
          </span>
          <span className="text-[9px] text-muted-foreground">/ {totalMax} pts</span>
        </div>
        <span className={cn("text-[11px] font-semibold", SCORE_TEXT[color])}>{label}</span>
      </div>

      {/* Total bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div ref={totalBarRef} className={cn("h-full rounded-full", SCORE_BAR[color])} style={{ width: "0%" }} />
      </div>

      {/* Detail rows */}
      <div className="mt-0.5 space-y-[3px]">
        {details.map((d, i) => {
          const c = scoreColor(d.score, d.max);
          const isPerfect = d.score >= d.max;
          return (
            <div key={d.key} className="flex items-center gap-1.5">
              <span className="w-[100px] shrink-0 text-[9px] text-muted-foreground leading-tight truncate">
                {d.label}
                {d.actual_percent != null && (
                  <span className="ml-0.5 text-[8px] text-muted-foreground/60">
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
              <span className={cn("w-11 text-right text-[9px] tabular-nums font-semibold shrink-0", isPerfect ? "text-emerald-600 dark:text-emerald-400" : SCORE_TEXT[c])}>
                {d.score % 1 === 0 ? d.score : d.score.toFixed(1)}/{d.max % 1 === 0 ? d.max : d.max.toFixed(1)}
              </span>
            </div>
          );
        })}

        {hasPenalty && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40 mt-0.5">
            <span className="w-[100px] shrink-0 text-[9px] text-red-600 dark:text-red-400 leading-tight">
              Non-Negotiable Penalty
            </span>
            <div className="flex-1" />
            <span className="w-11 text-right text-[9px] tabular-nums font-semibold text-red-600 dark:text-red-400">
              -{Math.abs(non_negotiable.penalty)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Upselling summary — ring, Total/Week Total bars, bonus banner (item detail lives in the dialog) ── */
function UpsellingSummary({
  goal,
  noGoal,
  dayTotal,
  weekTotal,
  dayPct,
  weekPct,
  bonusDollars,
}: {
  goal: number;
  noGoal: boolean;
  dayTotal: number;
  weekTotal: number;
  dayPct: number;
  weekPct: number;
  bonusDollars: number;
}) {
  const ringColor   = noGoal ? "#a1a1aa" : weekPct >= 90 ? "#34d399" : weekPct >= 60 ? "#fbbf24" : "#a78bfa";
  const statusLabel = noGoal ? "No Goal Set" : weekPct >= 100 ? "Goal Met!" : weekPct >= 80 ? "Almost There" : weekPct >= 50 ? "On Track" : "Keep Going";
  const dayBarPct  = noGoal ? (weekTotal > 0 ? (dayTotal / weekTotal) * 100 : 0) : Math.min(dayPct, 100);
  const weekBarPct = noGoal ? (weekTotal > 0 ? 100 : 0) : Math.min(weekPct, 100);

  const circleRef   = useRef<SVGCircleElement | null>(null);
  const centerRef   = useRef<HTMLDivElement | null>(null);
  const dayBarRef   = useRef<HTMLDivElement | null>(null);
  const dayTextRef  = useRef<HTMLDivElement | null>(null);
  const weekBarRef  = useRef<HTMLDivElement | null>(null);
  const weekTextRef = useRef<HTMLDivElement | null>(null);
  const animator    = useRef(makeAnimator());

  useEffect(() => {
    const { animateTo, cancelAll } = animator.current;

    if (circleRef.current) circleRef.current.style.strokeDashoffset = `${CIRC}`;
    if (centerRef.current && !noGoal) centerRef.current.textContent = "0%";
    if (dayBarRef.current)   dayBarRef.current.style.width   = "0%";
    if (dayTextRef.current)  dayTextRef.current.textContent  = "0";
    if (weekBarRef.current)  weekBarRef.current.style.width  = "0%";
    if (weekTextRef.current) weekTextRef.current.textContent = "0";

    const dur = 750;
    animateTo("circle", 0, noGoal ? 0 : Math.min(weekPct, 100), dur, (val) => {
      if (circleRef.current) circleRef.current.style.strokeDashoffset = `${CIRC - (val / 100) * CIRC}`;
    });
    if (!noGoal) {
      setTimeout(() => animateTo("count", 0, weekPct, dur, (val) => {
        if (centerRef.current) centerRef.current.textContent = Math.round(val) + "%";
      }), 50);
    }
    setTimeout(() => {
      animateTo("dayBar",  0, dayBarPct, dur, (val) => { if (dayBarRef.current)  dayBarRef.current.style.width  = `${Math.min(100, val)}%`; });
      animateTo("dayText", 0, dayTotal,  dur, (val) => { if (dayTextRef.current) dayTextRef.current.textContent = fmtPts(val); });
    }, 100);
    setTimeout(() => {
      animateTo("weekBar",  0, weekBarPct, dur, (val) => { if (weekBarRef.current)  weekBarRef.current.style.width  = `${Math.min(100, val)}%`; });
      animateTo("weekText", 0, weekTotal,  dur, (val) => { if (weekTextRef.current) weekTextRef.current.textContent = fmtPts(val); });
    }, 150);

    return () => cancelAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPct, dayBarPct, weekBarPct, dayTotal, weekTotal, noGoal]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5">
      <div className="relative flex items-center justify-center" style={{ width: RING, height: RING }}>
        <svg width={RING} height={RING} className="-rotate-90">
          <circle cx={RING / 2} cy={RING / 2} r={R} strokeWidth={STROKE} stroke="currentColor"
            className="text-muted" strokeOpacity={0.2} fill="transparent" />
          <circle cx={RING / 2} cy={RING / 2} r={R} strokeWidth={STROKE} strokeLinecap="round"
            stroke={ringColor} fill="transparent"
            strokeDasharray={`${CIRC}`} ref={circleRef}
            strokeDashoffset={`${CIRC}`}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center gap-0.5">
          {noGoal ? (
            <span className="text-[12px] font-semibold text-muted-foreground">No Goal</span>
          ) : (
            <>
              <div ref={centerRef} className="text-xl font-extrabold leading-none tabular-nums" style={{ color: ringColor }}>
                0%
              </div>
              <div className="text-[9px] text-muted-foreground leading-none">/ {goal.toLocaleString()}</div>
              <div className="text-[9px] text-muted-foreground leading-none mt-0.5">{statusLabel}</div>
            </>
          )}
        </div>
      </div>

      <div className="w-full space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-left text-[10px] text-muted-foreground truncate">Total</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div ref={dayBarRef} className="h-full rounded-full" style={{ width: "0%", backgroundColor: "#a78bfa" }} />
          </div>
          <div ref={dayTextRef} className="w-9 text-right text-[11px] font-semibold tabular-nums">0</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-left text-[10px] text-muted-foreground truncate">Week Total</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div ref={weekBarRef} className="h-full rounded-full" style={{ width: "0%", backgroundColor: ringColor }} />
          </div>
          <div ref={weekTextRef} className="w-9 text-right text-[11px] font-semibold tabular-nums">0</div>
        </div>
      </div>

      {bonusDollars > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 dark:bg-emerald-500/15">
          <DollarSign className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-400">
            Bonus unlocked: {fmt$(bonusDollars)}{" "}
            <span className="font-normal text-emerald-600/80 dark:text-emerald-400/70">
              ({Math.round(weekPct)}% of weekly goal)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Item breakdown table — Day vs WTD side by side, ranked by WTD ───────── */
function UpsellScoreTable({
  day,
  wtd,
  dayLabel,
}: {
  day?: UpsellingScoreRecord;
  wtd?: UpsellingScoreRecord;
  dayLabel: string;
}) {
  const allKeys = Array.from(new Set([...Object.keys(day ?? {}), ...Object.keys(wtd ?? {})]))
    .sort((a, b) => ((wtd?.[b] ?? 0) as number) - ((wtd?.[a] ?? 0) as number));

  if (allKeys.length === 0) {
    return <V1Empty icon={TrendingUp}>No upselling item data</V1Empty>;
  }

  return (
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={cn(V1_TH, "w-8")}>#</th>
          <th className={V1_TH}>Item</th>
          <th className={cn(V1_TH, V1_NUM)}>{dayLabel}</th>
          <th className={cn(V1_TH, V1_NUM)}>WTD</th>
        </tr>
      </thead>
      <tbody>
        {allKeys.map((key, idx) => (
          <tr key={key}>
            <td className={V1_TD}>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold", RANK_BADGE[idx] ?? RANK_BADGE[3])}>
                {idx + 1}
              </span>
            </td>
            <td className={cn(V1_TD, "font-semibold")}>{formatUpsellKey(key)}</td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>
              {day?.[key] != null ? fmtPts(day[key] as number) : <span className="text-muted-foreground/40">—</span>}
            </td>
            <td className={cn(V1_TD, V1_NUM, "font-bold")}>
              {wtd?.[key] != null ? fmtPts(wtd[key] as number) : <span className="text-muted-foreground/40">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Upselling detail dialog — everything about upselling, Day + WTD ─────── */
function UpsellingDetailDialog({
  open,
  onOpenChange,
  upsellingScore,
  goal,
  noGoal,
  dayTotal,
  weekTotal,
  dayPct,
  weekPct,
  bonusDollars,
  dayLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upsellingScore?: UpsellingScoreProp;
  goal: number;
  noGoal: boolean;
  dayTotal: number;
  weekTotal: number;
  dayPct: number;
  weekPct: number;
  bonusDollars: number;
  dayLabel: string;
}) {
  return (
    <WbrDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upselling Detail"
      badgeText={noGoal ? "No goal set" : `Goal: ${goal.toLocaleString()} pts/wk`}
    >
      <div className="space-y-6">
        {/* Summary */}
        <div>
          <V1SubLabel className="mb-2 px-1">Summary</V1SubLabel>
          <V1MetricGrid cols={4}>
            <V1Metric
              label={dayLabel}
              value={`${fmtPts(dayTotal)} pts`}
              sub={noGoal ? undefined : `${Math.round(dayPct)}% of goal`}
            />
            <V1Metric
              label="Week to Date"
              value={`${fmtPts(weekTotal)} pts`}
              sub={noGoal ? undefined : `${Math.round(weekPct)}% of goal`}
              accent="text-violet-600 dark:text-violet-400"
            />
            <V1Metric
              label="Weekly Goal"
              value={noGoal ? "Not set" : goal.toLocaleString()}
            />
            <V1Metric
              label="Bonus Earned"
              value={fmt$(bonusDollars)}
              sub={bonusDollars > 0 ? `at ${Math.round(weekPct)}% of goal` : "reach 125% to start earning"}
              accent="text-emerald-600 dark:text-emerald-400"
            />
          </V1MetricGrid>
        </div>

        {/* Bonus tiers */}
        <div>
          <V1SubLabel className="mb-2 px-1">Bonus Tiers (Week-to-Date)</V1SubLabel>
          <div className="flex flex-wrap gap-1.5">
            {BONUS_TIERS.map((tier) => {
              const reached = !noGoal && weekPct >= tier.pct;
              return (
                <span
                  key={tier.pct}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px] font-semibold",
                    reached
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border/50 text-muted-foreground",
                  )}
                >
                  {tier.pct}% → {fmt$(tier.dollars)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Item breakdown */}
        <div>
          <V1SubLabel className="mb-2 px-1">Item Breakdown</V1SubLabel>
          <UpsellScoreTable day={upsellingScore?.day} wtd={upsellingScore?.week_to_date} dayLabel={dayLabel} />
        </div>
      </div>
    </WbrDetailDialog>
  );
}

/* ── Main card ────────────────────────────────────────────────────────────── */
export function V1StoreScoreCard({
  upsellingScore,
  goalMetrics,
  storeScore,
  date,
  span,
  className,
}: {
  upsellingScore?: UpsellingScoreProp;
  goalMetrics?: DsprGoalMetric[];
  storeScore?: StoreScoreData;
  date?: Date;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("score");
  const [dialogOpen, setDialogOpen] = useState(false);
  const dayLabel = date ? format(date, "MMM d") : "Today";

  const upsMetric  = goalMetrics?.find((m) => m.metric_name.toLowerCase().includes("upselling"));
  const weeklyGoal = upsMetric ? parseFloat(upsMetric.goals[0]?.goal ?? "0") : null;
  const goal   = weeklyGoal ?? 0;
  const noGoal = goal === 0;

  const dayTotal  = upsellingScore?.total_upselling_score_day ?? 0;
  const weekTotal = upsellingScore?.total_upselling_score_week_to_date ?? 0;
  const dayPct  = noGoal ? 0 : (dayTotal / goal) * 100;
  const weekPct = noGoal ? 0 : (weekTotal / goal) * 100;

  // Manager cash bonus — always week-to-date based, +$10 per 25pts above 100%, capped at 300% (=$80)
  const bonusSteps = noGoal ? 0 : Math.min(8, Math.max(0, Math.floor((weekPct - 100) / 25)));
  const bonusDollars = bonusSteps * 10;

  const toggle = (
    <div
      className="ms-auto inline-flex overflow-hidden rounded-md border border-border/60 bg-background/40 text-[9px] font-semibold shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          if (tab !== "score") playSfx("toggle-on");
          setTab("score");
        }}
        className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 transition-colors",
          tab === "score" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
        )}
      >
        <Star className="h-2.5 w-2.5" />
        Score
      </button>
      <button
        type="button"
        onClick={() => {
          if (tab !== "upselling") playSfx("toggle-on");
          setTab("upselling");
        }}
        className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 transition-colors",
          tab === "upselling" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
        )}
      >
        <TrendingUp className="h-2.5 w-2.5" />
        Upselling
      </button>
    </div>
  );

  return (
    <V1Card
      title={tab === "score" ? "Store Score" : "Upselling"}
      category="sales"
      period="D·WTD"
      span={span}
      className={className}
      headerControl={toggle}
      onExpand={tab === "upselling" ? () => setDialogOpen(true) : undefined}
    >
      {tab === "score" ? (
        <ScoreView storeScore={storeScore} />
      ) : (
        <UpsellingSummary
          goal={goal}
          noGoal={noGoal}
          dayTotal={dayTotal}
          weekTotal={weekTotal}
          dayPct={dayPct}
          weekPct={weekPct}
          bonusDollars={bonusDollars}
        />
      )}
      <UpsellingDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        upsellingScore={upsellingScore}
        goal={goal}
        noGoal={noGoal}
        dayTotal={dayTotal}
        weekTotal={weekTotal}
        dayPct={dayPct}
        weekPct={weekPct}
        bonusDollars={bonusDollars}
        dayLabel={dayLabel}
      />
    </V1Card>
  );
}
