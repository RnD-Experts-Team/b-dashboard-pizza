"use client";

import React, { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoreScoreCardProps {
  daily?: number;
  weekly?: number;
  monthly?: number;
  loading?: boolean;
  className?: string;
}

function clamp(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function StoreScoreCard({
  daily = 88,
  weekly = 70,
  monthly = 80,
  loading = false,
  className,
}: StoreScoreCardProps) {
  const d = clamp(daily);
  const w = clamp(weekly);
  const m = clamp(monthly);

  // DOM refs for direct updates (avoids React re-renders per frame)
  const dailyTextRef = useRef<HTMLDivElement | null>(null);
  const dailyCircleRef = useRef<SVGCircleElement | null>(null);
  const weeklyBarRef = useRef<HTMLDivElement | null>(null);
  const weeklyTextRef = useRef<HTMLDivElement | null>(null);
  const monthlyBarRef = useRef<HTMLDivElement | null>(null);
  const monthlyTextRef = useRef<HTMLDivElement | null>(null);

  const rafRefs = useRef<{ daily?: number; weekly?: number; monthly?: number }>({});

  // animate a single numeric value and update DOM elements directly
  function animateTo(
    key: 'daily' | 'weekly' | 'monthly',
    from: number,
    to: number,
    duration: number
  ) {
    const start = performance.now();
    const diff = to - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + diff * eased;

      if (key === 'daily') {
        if (dailyTextRef.current) dailyTextRef.current.textContent = `${Math.round(val)}%`;
        if (dailyCircleRef.current) {
          const offset = circumference - (val / 100) * circumference;
          dailyCircleRef.current.style.strokeDashoffset = `${offset}`;
        }
      } else if (key === 'weekly') {
        if (weeklyBarRef.current) weeklyBarRef.current.style.width = `${Math.max(0, Math.min(100, val))}%`;
        if (weeklyTextRef.current) weeklyTextRef.current.textContent = `${Math.round(val)}%`;
      } else if (key === 'monthly') {
        if (monthlyBarRef.current) monthlyBarRef.current.style.width = `${Math.max(0, Math.min(100, val))}%`;
        if (monthlyTextRef.current) monthlyTextRef.current.textContent = `${Math.round(val)}%`;
      }

      if (t < 1) {
        rafRefs.current[key] = requestAnimationFrame(tick);
      } else {
        delete rafRefs.current[key];
      }
    };

    // cancel existing
    if (rafRefs.current[key]) cancelAnimationFrame(rafRefs.current[key]!);
    rafRefs.current[key] = requestAnimationFrame(tick);
  }

  useEffect(() => {
    // initialize DOM to zero quickly
    if (dailyTextRef.current) dailyTextRef.current.textContent = loading ? '—' : '0%';
    if (weeklyBarRef.current) weeklyBarRef.current.style.width = `0%`;
    if (weeklyTextRef.current) weeklyTextRef.current.textContent = `0%`;
    if (monthlyBarRef.current) monthlyBarRef.current.style.width = `0%`;
    if (monthlyTextRef.current) monthlyTextRef.current.textContent = `0%`;

    if (!Number.isFinite(d)) return;
    const duration = 700;
    // stagger slightly for perceived smoothness
    animateTo('daily', 0, d, duration);
    setTimeout(() => animateTo('weekly', 0, w, duration), 60);
    setTimeout(() => animateTo('monthly', 0, m, duration), 120);

    return () => {
      Object.values(rafRefs.current).forEach((id) => id && cancelAnimationFrame(id));
      rafRefs.current = {};
    };
  }, [d, w, m, loading]);

  const status = d >= 90 ? "Outstanding" : d >= 75 ? "Excellent" : d >= 60 ? "On Track" : "Needs Improvement";

  // radial circle geometry
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (d / 100) * circumference;

  return (
    <Card className={cn("relative group transition-shadow py-2 px-3 bg-linear-to-r from-yellow-50 via-yellow-100 to-yellow-200 dark:from-yellow-950/30 dark:via-yellow-900/40 dark:to-yellow-800/50", className)}>
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <Star className="h-4 w-4 text-amber-400" />
        <div className="text-[11px] font-semibold">Store Score</div>
      </div>
      <CardContent className="flex flex-col gap-2 items-center justify-center text-center  h-full">

        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={stroke}
                className="text-muted"
                stroke="currentColor"
                style={{ color: 'var(--muted)' }}
                fill="transparent"
                strokeOpacity={0.12}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={stroke}
                strokeLinecap="round"
                stroke="currentColor"
                className={cn(
                  d >= 85 ? 'text-emerald-400' : d >= 70 ? 'text-amber-400' : 'text-red-400'
                )}
                fill="transparent"
                strokeDasharray={`${circumference}`}
                ref={dailyCircleRef}
                strokeDashoffset={`${circumference}`}
                style={{ transition: 'stroke-dashoffset 120ms linear', transformOrigin: '50% 50%' }}
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <div
                className={cn(
                  "text-2xl md:text-3xl font-extrabold leading-tight",
                  d >= 85 ? "text-emerald-500" : d >= 70 ? "text-amber-500" : "text-red-500",
                  "motion-reduce:animate-none"
                )}
                aria-label={`Daily score ${d} percent`}
                ref={dailyTextRef}
              >
                {loading ? '—' : '0%'}
              </div>
              <div className="text-[11px] text-muted-foreground">{status}</div>
            </div>
          </div>
        </div>

        <div className="w-full pt-2 space-y-2">
          <ScoreRow label="Weekly" color="amber" barRef={weeklyBarRef} textRef={weeklyTextRef} />
          <ScoreRow label="Monthly" color="indigo" barRef={monthlyBarRef} textRef={monthlyTextRef} />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({
  label,
  color = "indigo",
  barRef,
  textRef,
}: {
  label: string;
  color?: "indigo" | "amber" | "emerald" | "red";
  barRef?: React.RefObject<HTMLDivElement | null>;
  textRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const pct = 0;
  const colorClass =
    color === "amber"
      ? "bg-amber-400"
      : color === "emerald"
      ? "bg-emerald-400"
      : color === "red"
      ? "bg-red-400"
      : "bg-indigo-500";

  return (
    <div className="flex items-center gap-3">
      <div className="text-[12px] w-16 text-left text-muted-foreground">{label}</div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div ref={barRef} className={cn("h-full rounded-full", colorClass)} style={{ width: `0%` }} />
        </div>
      </div>
      <div ref={textRef} className="w-10 text-right text-[12px] font-semibold">0%</div>
    </div>
  );
}

export default StoreScoreCard;
