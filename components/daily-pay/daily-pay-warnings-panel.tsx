"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { warningCopy } from "@/lib/daily-pay/warnings";
import type { DailyPayAggregationWarning } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Aggregation warnings — ADVISORY ONLY                                     */
/*                                                                            */
/*  None of these block anything: a person decides. So the panel is amber     */
/*  rather than destructive, and deliberately offers no fix button — the       */
/*  absence of an action is what tells the reader nothing is broken.          */
/* ────────────────────────────────────────────────────────────────────────── */

const COLLAPSE_THRESHOLD = 3;

function WarningRow({ warning }: { warning: DailyPayAggregationWarning }) {
  const copy = warningCopy(warning);
  return (
    <li className="flex gap-2">
      <span
        aria-hidden
        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-600 dark:bg-amber-400"
      />
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{copy.title}</p>
        {copy.detail && (
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70">{copy.detail}</p>
        )}
      </div>
    </li>
  );
}

interface DailyPayWarningsPanelProps {
  /**
   * Null means the relation was not loaded (the list endpoint) — render
   * nothing. An empty array means there is genuinely nothing to check, which
   * also renders nothing: "0 warnings" is noise that happens to be a lie.
   */
  warnings: DailyPayAggregationWarning[] | null;
  className?: string;
}

export function DailyPayWarningsPanel({ warnings, className }: DailyPayWarningsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!warnings || warnings.length === 0) return null;

  const shell =
    "rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 dark:bg-amber-500/15";
  const heading = (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
      <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      {warnings.length === 1 ? "1 thing to check" : `${warnings.length} things to check`}
    </span>
  );

  if (warnings.length <= COLLAPSE_THRESHOLD) {
    return (
      <div className={cn(shell, className)}>
        {heading}
        <ul className="mt-2 space-y-1.5">
          {warnings.map((warning, i) => (
            <WarningRow key={`${warning.code}-${i}`} warning={warning} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(shell, className)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2">
        {heading}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-amber-600 transition-transform dark:text-amber-400",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 space-y-1.5">
          {warnings.map((warning, i) => (
            <WarningRow key={`${warning.code}-${i}`} warning={warning} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
