"use client";

import { Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoursSource } from "@/lib/daily-pay/explain";
import type { DailyPayLine } from "@/types/daily-pay.types";

/**
 * Whether a line's hours are live or frozen by hand.
 *
 * Hours normally arrive from the attendance recorded against the issues, and
 * stay up to date. The moment somebody types over them the line is marked
 * `hoursOverridden` and Recalculate skips it -- forever, and silently. The
 * tooltip on the Recalculate button said so; nothing on the line itself did, so
 * "I pressed recalculate and nothing happened" was indistinguishable from
 * "there was nothing to change".
 *
 * Note that a typed `0` counts as an override upstream. Zero is a legitimate
 * value, not "unset", so a line reading zero hours may well be deliberate.
 */
export function HoursSourceBadge({
  line,
  className,
}: {
  line: DailyPayLine;
  className?: string;
}) {
  const source = hoursSource(line);
  const Icon = source.isOverridden ? Lock : RefreshCw;

  return (
    <span
      title={source.detail}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        source.isOverridden
          ? "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {source.label}
    </span>
  );
}

/** The same fact as a full sentence, for where there is room to say it properly. */
export function HoursSourceNote({
  line,
  className,
}: {
  line: DailyPayLine;
  className?: string;
}) {
  const source = hoursSource(line);
  return (
    <p
      className={cn(
        "text-[11px]",
        source.isOverridden ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        className
      )}
    >
      {source.detail}
    </p>
  );
}
