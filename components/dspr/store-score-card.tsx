"use client";

import React from "react";
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

  const status = d >= 90 ? "Outstanding" : d >= 75 ? "Excellent" : d >= 60 ? "On Track" : "Needs Improvement";

  // radial circle geometry
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.round((d / 100) * circumference);

  return (
    <Card className={cn("relative group transition-shadow py-2 px-3 bg-gradient-to-r from-yellow-50/50 via-yellow-100/40 to-yellow-200/30 dark:from-yellow-950/30 dark:via-yellow-900/40 dark:to-yellow-800/50", className)}>
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
                strokeDashoffset={`${circumference - dash}`}
                style={{ transition: 'stroke-dashoffset 600ms ease', transformOrigin: '50% 50%' }}
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
              >
                {loading ? '—' : `${d}%`}
              </div>
              <div className="text-[11px] text-muted-foreground">{status}</div>
            </div>
          </div>
        </div>

        <div className="w-full pt-2 space-y-2">
          <ScoreRow label="Weekly" value={w} color="amber" />
          <ScoreRow label="Monthly" value={m} color="indigo" />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({
  label,
  value,
  color = "indigo",
}: {
  label: string;
  value: number;
  color?: "indigo" | "amber" | "emerald" | "red";
}) {
  const pct = clamp(value);
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
          <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-10 text-right text-[12px] font-semibold">{pct}%</div>
    </div>
  );
}

export default StoreScoreCard;
