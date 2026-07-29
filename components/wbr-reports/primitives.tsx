"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { CategoryToken } from "@/components/dashboard-v1/category";

/* ──────────────────────────────────────────────────────────────────────
 *  Shared presentational primitives for the WBR Reports page.
 *  Purely visual — no data fetching. Theme-aware via Tailwind tokens.
 * ────────────────────────────────────────────────────────────────────── */

/* ── ReportCard — titled container used for every report block ───────── */
export function ReportCard({
  title,
  hint,
  children,
  className,
  bodyClassName,
  accent,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Optional category color token (see components/dashboard-v1/category.ts) — a subtle left border + tinted icon/title. Body stays plain. Omit for the neutral card. */
  accent?: CategoryToken;
}) {
  const Icon = accent?.icon;
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0",
        accent && "border-l-2",
        accent?.border,
        className,
      )}
    >
      <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0 border-b px-4 py-3">
        <CardTitle className={cn("flex items-center gap-1.5 text-sm", accent?.headerText)}>
          {Icon && (
            <span className={cn("inline-flex shrink-0 rounded p-0.5", accent.iconBg)}>
              <Icon className={cn("h-3 w-3", accent.text)} />
            </span>
          )}
          {title}
        </CardTitle>
        {hint && (
          <CardDescription className="whitespace-nowrap text-[11px]">
            {hint}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn("p-0", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

/* ── DeltaBadge — WoW / PoP style up-down change pill ────────────────── */
export function DeltaBadge({
  value,
  suffix = "%",
}: {
  value: number;
  suffix?: string;
}) {
  const up = value > 0.05;
  const down = value < -0.05;
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        up && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        down && "bg-red-500/15 text-red-600 dark:text-red-400",
        !up && !down && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

/* ── Chip — semantic status pill ─────────────────────────────────────── */
type Tone = "ok" | "warn" | "bad" | "muted" | "info";
const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  bad: "bg-red-500/15 text-red-600 dark:text-red-400",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  muted: "bg-muted text-muted-foreground",
};
export function Chip({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TONE[tone]
      )}
    >
      {children}
    </span>
  );
}

/* ── KPI tile ────────────────────────────────────────────────────────── */
export function Kpi({
  label,
  value,
  delta,
  accent,
  size = "default",
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
  /** Optional category color token — tints the label and left border. Omit for the neutral tile. */
  accent?: CategoryToken;
  /** "sm" renders a more compact tile (smaller font, less padding) for dense KPI strips. */
  size?: "sm" | "default";
}) {
  return (
    <Card
      className={cn(
        "gap-1",
        size === "sm" ? "py-2" : "py-3",
        accent && "border-l-2",
        accent?.border,
      )}
    >
      <CardContent className={size === "sm" ? "px-3" : "px-3.5"}>
        <p
          className={cn(
            size === "sm" ? "text-[10px]" : "text-[11px]",
            "font-semibold uppercase tracking-wide",
            accent?.headerText ?? "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <div className={cn("flex flex-wrap items-center gap-2", size === "sm" ? "mt-0.5" : "mt-1")}>
          <span
            className={cn(
              "font-heading font-semibold leading-tight tabular-nums",
              size === "sm" ? "text-lg" : "text-2xl",
            )}
          >
            {value}
          </span>
          {delta !== undefined && <DeltaBadge value={delta} />}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── StoreCell — store name + market/code subtitle ──────────────────── */
export function StoreCell({
  name,
  market,
  num,
}: {
  name: string;
  market: string;
  num: number;
}) {
  return (
    <span className="flex flex-col">
      <span className="font-semibold">{name}</span>
      <span className="text-[10px] text-muted-foreground">
        {market} · {String(num).padStart(2, "0")}
      </span>
    </span>
  );
}

/* ── DataBar — simple horizontal fill ────────────────────────────────── */
export function DataBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <span className="inline-flex h-1.5 w-[120px] overflow-hidden rounded-full bg-muted align-middle">
      <span
        className="h-full rounded-full bg-primary/70"
        style={{ width: `${w}%` }}
      />
    </span>
  );
}

/* ── DivBar — diverging bar centred at zero (portioning variance) ────── */
export function DivBar({ value, scale = 10 }: { value: number; scale?: number }) {
  const w = Math.min(50, (Math.abs(value) / scale) * 50);
  const pos = value >= 0;
  return (
    <span className="relative block h-1.5 w-[120px] rounded-full bg-muted">
      <span className="absolute inset-y-[-2px] left-1/2 w-px bg-border" />
      <span
        className={cn(
          "absolute top-0 h-full rounded-full",
          pos ? "left-1/2 bg-red-500" : "right-1/2 bg-emerald-500"
        )}
        style={{ width: `${w}%` }}
      />
    </span>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────── */
export function Spark({
  values,
  w = 72,
  h = 22,
}: {
  values: number[];
  w?: number;
  h?: number;
}) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${(2 + (i / (values.length - 1 || 1)) * (w - 4)).toFixed(1)},${(
          h -
          3 -
          ((v - min) / span) * (h - 6)
        ).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Stars ───────────────────────────────────────────────────────────── */
export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex gap-px align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i <= full
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-border"
          )}
        />
      ))}
    </span>
  );
}

/* ── heat-tint inline style helper (capped mix for AA contrast) ──────── */
export function heat(
  color: "green" | "red" | "amber" | "brand",
  pct: number
): React.CSSProperties {
  const c = {
    green: "16 185 129",
    red: "239 68 68",
    amber: "245 158 11",
    brand: "var(--primary)",
  }[color];
  const a = Math.min(0.25, Math.max(0, pct / 100));
  if (color === "brand")
    return { backgroundColor: `color-mix(in oklab, var(--primary) ${(a * 100).toFixed(0)}%, transparent)` };
  return { backgroundColor: `rgba(${c} / ${a.toFixed(3)})` };
}

/* ── dense table class constants (shared across tabs) ───────────────── */
export const TBL =
  "w-full caption-bottom border-collapse text-[12.5px] [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-muted/40";
export const TH =
  "h-9 px-2 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap sticky top-0 z-[1] bg-card";
export const TD = "px-2 py-1.5 align-middle whitespace-nowrap";
export const NUM = "text-end tabular-nums";

/* ── scrollable table shell ──────────────────────────────────────────── */
export function TblWrap({
  children,
  tall,
}: {
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", tall && "max-h-[480px] overflow-y-auto")}>
      {children}
    </div>
  );
}
