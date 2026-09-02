"use client";

import { AlertTriangle, Check, UserX } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import {
  SHIFT_ACCENT,
  SHIFT_CARD_SURFACE,
  SHIFT_RAIL_BASE,
  type ShiftTone,
} from "@/lib/scheduling/accents";
import type { Shift, ActualShift } from "@/types/scheduling.types";

/**
 * Plan against reality, in one cell.
 *
 * Always two rows in the same order — PLAN on top, ACT underneath — so the eye
 * can compare the same position across every cell in the week. The previous
 * version had five different layouts depending on outcome (matched shifts hid
 * the planned row, absences moved it, added coverage showed one row), which
 * meant the reader had to work out what each card was showing before they could
 * read it.
 *
 * A missing side is stated rather than omitted. "Not recorded" and "Not planned"
 * are meaningfully different from each other and from a blank cell, and the
 * whole point of this view is to find those gaps.
 *
 * Both sides missing renders nothing — the grid has nothing to compare, so an
 * empty cell is the honest output.
 */

interface ComparisonShiftCardProps {
  /** The planned shift. Undefined for ad-hoc coverage that was never planned. */
  plannedShift?: Shift;
  /** The linked (or standalone) actual entry, if one has been recorded. */
  actual?: ActualShift;
}

type Outcome = "match" | "differs" | "absent" | "unplanned" | "not-recorded";

/**
 * Outcomes mapped onto the three shared tones.
 *
 * `match` and `not-recorded` are deliberately `neutral` — one is the expected
 * result and the other is simply "nobody has looked yet". Neither is a problem,
 * so neither earns colour; that is what leaves the genuinely notable outcomes
 * visible at a glance instead of competing with four other hues.
 */
const OUTCOME: Record<
  Outcome,
  { tone: ShiftTone; dashed?: boolean; icon: typeof Check | null }
> = {
  match: { tone: "neutral", icon: Check },
  differs: { tone: "attention", icon: AlertTriangle },
  absent: { tone: "critical", icon: UserX },
  unplanned: { tone: "info", icon: AlertTriangle },
  "not-recorded": { tone: "neutral", dashed: true, icon: null },
};

/** "+20m" / "−1h 05m", or null when the durations match. */
function formatDelta(plannedMinutes: number, actualMinutes: number): string | null {
  const diff = actualMinutes - plannedMinutes;
  if (diff === 0) return null;
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h ${String(m).padStart(2, "0")}m` : `${sign}${m}m`;
}

/** One side of the comparison. Fixed label column so the times line up. */
function Row({
  label,
  children,
  muted,
  strike,
  className,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
  strike?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="w-6 shrink-0 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[10px] font-medium leading-tight",
          muted && "italic text-muted-foreground",
          strike && "line-through",
          className,
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function ComparisonShiftCard({
  plannedShift,
  actual,
}: ComparisonShiftCardProps) {
  // Nothing planned and nothing recorded — there is no comparison to draw.
  if (!plannedShift && !actual) return null;

  let outcome: Outcome;
  if (!plannedShift) outcome = "unplanned";
  else if (!actual) outcome = "not-recorded";
  else if (actual.status === "absent") outcome = "absent";
  else
    outcome =
      plannedShift.startTime === actual.startTime &&
      plannedShift.endTime === actual.endTime
        ? "match"
        : "differs";

  const spec = OUTCOME[outcome];
  const accent = SHIFT_ACCENT[spec.tone];
  const Icon = spec.icon;

  const delta =
    plannedShift && actual && outcome === "differs"
      ? formatDelta(plannedShift.durationMinutes, actual.durationMinutes)
      : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "relative overflow-hidden ps-2 pe-1.5 py-1",
            SHIFT_CARD_SURFACE,
            spec.dashed && "border-dashed",
          )}
        >
          {/* Rail only for outcomes worth noticing — see OUTCOME above. */}
          {spec.tone !== "neutral" && (
            <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />
          )}

          {Icon && (
            <Icon
              className={cn("absolute end-0.5 top-0.5 h-2.5 w-2.5", accent.text)}
            />
          )}

          {/*
            PLAN — always first, even when there is nothing planned.
            `pe-3` keeps a long time string clear of the absolutely-positioned
            status icon, which text would otherwise run underneath.
          */}
          <Row
            label="Plan"
            muted={!plannedShift}
            strike={outcome === "absent"}
            className={cn(
              Icon && "pe-3",
              outcome === "absent" && accent.text,
            )}
          >
            {plannedShift
              ? `${formatTime(plannedShift.startTime)}–${formatTime(plannedShift.endTime)}`
              : "Not planned"}
          </Row>

          <span className="my-0.5 block h-px bg-border/50" />

          {/* ACT — always second, even when nothing was recorded. */}
          <Row
            label="Act"
            muted={!actual || outcome === "not-recorded"}
            className={
              outcome === "absent" || outcome === "differs" || outcome === "unplanned"
                ? accent.text
                : undefined
            }
          >
            {!actual
              ? "Not recorded"
              : actual.status === "absent"
                ? "No show"
                : `${formatTime(actual.startTime)}–${formatTime(actual.endTime)}`}
          </Row>

          {delta && (
            <p
              className={cn(
                "mt-0.5 text-end text-[9px] font-semibold tabular-nums leading-none",
                accent.text,
              )}
            >
              {delta}
            </p>
          )}
        </div>
      </TooltipTrigger>

      <TooltipContent side="top" className="max-w-56 text-xs">
        <p className="font-semibold">
          {outcome === "match" && "Worked as planned"}
          {outcome === "differs" && "Worked different hours"}
          {outcome === "absent" && "Did not attend"}
          {outcome === "unplanned" && "Worked without a planned shift"}
          {outcome === "not-recorded" && "Not reviewed yet"}
        </p>

        <p className="mt-1">
          <span className="opacity-70">Planned: </span>
          {plannedShift
            ? `${formatTime(plannedShift.startTime)} – ${formatTime(plannedShift.endTime)}`
            : "nothing scheduled"}
        </p>
        <p>
          <span className="opacity-70">Actual: </span>
          {!actual
            ? "no attendance recorded"
            : actual.status === "absent"
              ? "did not work"
              : `${formatTime(actual.startTime)} – ${formatTime(actual.endTime)}`}
        </p>

        {delta && (
          <p className="mt-0.5 font-medium">
            {delta} against the plan
          </p>
        )}

        {outcome === "not-recorded" && (
          <p className="mt-0.5 opacity-80">
            Switch to the Actual view to record what happened.
          </p>
        )}

        {actual?.note && (
          <p className="mt-0.5 italic opacity-90">📝 {actual.note}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
