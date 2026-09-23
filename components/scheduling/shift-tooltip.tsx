"use client";

import { cn } from "@/lib/utils";
import { SHIFT_ACCENT, type ShiftTone } from "@/lib/scheduling/accents";

/**
 * Shared layout for every shift hover card.
 *
 * All four card types grew their own tooltip independently and had drifted into
 * four different shapes — a stack of unlabelled sentences in one, a bold line
 * plus loose paragraphs in another. One structure means a manager learns where
 * to look once instead of re-reading each kind.
 *
 * The order is fixed and meaningful: what and when, then the verdict, then the
 * supporting facts, then what to do about it.
 */

/** Times and duration. Always first. */
export function ShiftTooltipHeader({
  time,
  hours,
}: {
  time: string;
  hours?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-semibold">{time}</span>
      {hours !== undefined && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {hours.toFixed(1)}h
        </span>
      )}
    </div>
  );
}

/**
 * The verdict, carrying the same swatch the card itself shows.
 *
 * Reusing `SHIFT_ACCENT[tone].rail` rather than approximating the colour is the
 * point — the mark in the tooltip and the rail on the card have to be visibly
 * the same thing, the way the cleaning grid's legend reuses its cell swatch.
 */
export function ShiftTooltipStatus({
  tone,
  children,
}: {
  tone: ShiftTone;
  children: React.ReactNode;
}) {
  const accent = SHIFT_ACCENT[tone];
  return (
    <p className="mt-1 flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "h-3 w-1 shrink-0 rounded-full",
          accent.rail || "bg-muted-foreground/40",
        )}
      />
      <span className={cn("font-medium", accent.text)}>{children}</span>
    </p>
  );
}

/** A supporting fact. Label column is fixed so values line up. */
export function ShiftTooltipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

/** Wraps the fact rows, separated from the verdict above. */
export function ShiftTooltipBody({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 space-y-0.5 border-t pt-1.5">{children}</div>;
}

/** What to do about it. Muted, and always last. */
export function ShiftTooltipHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">{children}</p>
  );
}
