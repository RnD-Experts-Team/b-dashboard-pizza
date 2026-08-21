"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/uisfx/play";
import { CATEGORIES, type CategoryKey } from "./category";

/* ──────────────────────────────────────────────────────────────────────────
 *  v1-ui — the shared content kit for Dashboard V1 cards.
 *
 *  Every V1 card body is built from these few primitives so the whole
 *  dashboard reads as one unified system: metric tiles, labelled rows, a
 *  sub-label, a category-tinted progress bar, a proportion bar, and a
 *  consistent compact table style. Colors flow from the card's category.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── Sub-label — a tiny uppercase divider inside a card body ─────────────── */
export function V1SubLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[9px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ── Metric tile — big value + label, optional sub/delta ─────────────────── */
export function V1Metric({
  label,
  value,
  sub,
  accent,
  size = "md",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Tailwind text-color class for the value (defaults to foreground). */
  accent?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize =
    size === "lg" ? "text-xl" : size === "sm" ? "text-[13px]" : "text-base";
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-lg border border-border/50 bg-background/55 px-2.5 py-1.5 backdrop-blur-sm",
        className,
      )}
    >
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("font-bold leading-tight tabular-nums", valueSize, accent)}>
        {value}
      </p>
      {sub && (
        <p className="truncate text-[9.5px] font-medium leading-tight text-muted-foreground/80">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Metric grid — evenly sized tiles ────────────────────────────────────── */
export function V1MetricGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const colClass =
    cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={cn("grid gap-1", colClass, className)}>{children}</div>
  );
}

/* ── Data row — label on the left, value(s) on the right ─────────────────── */
export function V1DataRow({
  label,
  value,
  trailing,
  muted,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Optional secondary value (e.g. a delta or previous value). */
  trailing?: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-[11px]",
          muted ? "text-muted-foreground" : "font-medium",
        )}
      >
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
        {value}
        {trailing}
      </span>
    </div>
  );
}

/* ── Progress bar — category-tinted, value vs max ────────────────────────── */
export function V1Progress({
  value,
  max = 100,
  category,
  className,
}: {
  value: number;
  max?: number;
  category: CategoryKey;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = CATEGORIES[category].chartColors[0];
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ── Stacked proportion bar — segments sized by share of total ───────────── */
export interface V1Segment {
  label: string;
  value: number;
  color: string;
}

export function V1StackedBar({
  segments,
  className,
}: {
  segments: V1Segment[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) =>
          s.value > 0 ? (
            <div
              key={`${s.label}-${i}`}
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: s.color,
              }}
              title={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <span
              key={`${s.label}-leg-${i}`}
              className="flex items-center gap-1 text-[9px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
      </div>
    </div>
  );
}

/* ── Compact table style — shared class strings for the unified look ─────── */
export const V1_TBL = "w-full border-collapse text-[11px]";
export const V1_TH =
  "sticky top-0 z-[1] bg-background/80 px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm";
export const V1_TD = "px-2 py-1 border-b border-border/40";
export const V1_NUM = "text-right tabular-nums";

/* ── Segmented toggle — for Day/WTD or Prev/YoY switches inside a card ───── */
export function V1Toggle<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-border/60 bg-background/50 text-[9px] font-semibold",
        className,
      )}
      // Keep clicks from bubbling to a clickable (expandable) card.
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            if (o.value !== value) playSfx("toggle-on");
            onChange(o.value);
          }}
          className={cn(
            "px-1.5 py-0.5 transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Empty state inside a card body ──────────────────────────────────────── */
export function V1Empty({
  icon: Icon,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
      {Icon && <Icon className="h-5 w-5 opacity-50" />}
      <p className="text-[11px]">{children}</p>
    </div>
  );
}
