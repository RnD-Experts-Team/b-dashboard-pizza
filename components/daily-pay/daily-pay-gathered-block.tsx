"use client";

import { Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date-display";
import { formatHours, formatMoney, payableHours } from "@/lib/daily-pay/money";
import type { DailyPayGathered } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  What the attendance records say                                          */
/*                                                                            */
/*  These figures are FROZEN when the sheet is saved, so a signed-off sheet   */
/*  does not change because somebody corrected a ticket next month. The `at`  */
/*  and `by` provenance is shown for exactly that reason — it tells the       */
/*  reader how old the numbers are.                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function Figure({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-[11px] font-medium tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface DailyPayGatheredBlockProps {
  gathered: DailyPayGathered | null;
  /**
   * Line level shows reimbursable parts as an ATTRIBUTION of money already
   * counted once at payment level, so it must not read as a payable.
   */
  level: "payment" | "line";
  className?: string;
}

export function DailyPayGatheredBlock({
  gathered,
  level,
  className,
}: DailyPayGatheredBlockProps) {
  if (!gathered) return null;

  const payable = payableHours(gathered);

  return (
    <div className={cn("rounded-md border border-dashed bg-muted/40 p-2.5", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" />
          What the records say
        </p>
        {gathered.at && (
          <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <User className="h-2.5 w-2.5" />
            {gathered.by?.name ?? "System"}
            <span>· {formatTimestamp(gathered.at, "MMM d, h:mm a")}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5">
        <Figure label="Work" value={formatHours(gathered.workHours)} />
        <Figure label="Travel" value={formatHours(gathered.travelHours)} />
        <Figure label="Parts run" value={formatHours(gathered.partsRunHours)} />
        {/* Break is tracked but NOT paid — say so, every time it is shown. */}
        <Figure
          label="Break"
          value={formatHours(gathered.breakHours)}
          muted
          hint="not paid"
        />
        <Figure label="Payable" value={formatHours(payable)} hint="work + travel + parts" />
      </div>

      {gathered.reimbursableParts != null && (
        <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
          {level === "payment" ? (
            <>
              Reimbursable parts{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(gathered.reimbursableParts)}
              </span>
            </>
          ) : (
            <>
              Reimbursable parts (attributed){" "}
              <span className="tabular-nums">
                {formatMoney(gathered.reimbursableParts)}
              </span>
              {" — already counted once on the payment"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
