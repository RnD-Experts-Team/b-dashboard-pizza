"use client";

import { cn } from "@/lib/utils";
import { explainPayment, explainLine, type ExplainLine } from "@/lib/daily-pay/explain";
import type { DailyPayLine, DailyPayPayment } from "@/types/daily-pay.types";

/**
 * How the total was reached, line by line, in plain words.
 *
 * Every number on the payment appears here, and the ones that do NOT count --
 * break time, and hours a fixed amount has overridden -- appear struck through
 * with the reason beside them. That is the whole design: the four traps in this
 * screen are all cases of a number doing something other than what it looks
 * like it is doing, and the fix is to say what each one does, next to it.
 *
 * Only `totalAmount` is presented as the answer. `linesTotal` is a genuinely
 * different figure upstream and showing both invites the wrong one to be read.
 */

interface DailyPayBreakdownProps {
  payment: DailyPayPayment;
  /** Explain one store's line instead of the whole payment. */
  line?: DailyPayLine;
  className?: string;
}

export function DailyPayBreakdown({ payment, line, className }: DailyPayBreakdownProps) {
  const rows = line ? explainLine(line, payment) : explainPayment(payment);

  if (rows.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Nothing to pay yet.
      </p>
    );
  }

  return (
    <dl className={cn("space-y-1 rounded-lg border bg-muted/30 p-3", className)}>
      {rows.map((row, i) => (
        <Row key={`${row.label}-${i}`} row={row} />
      ))}
    </dl>
  );
}

function Row({ row }: { row: ExplainLine }) {
  const isTotal = row.kind === "total";
  const isExcluded = row.kind === "excluded";

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2",
        isTotal && "mt-1 border-t pt-2"
      )}
    >
      <dt className="min-w-0">
        <span
          className={cn(
            "text-sm",
            isTotal && "font-medium",
            // Struck AND dimmed. Either alone reads as a styling accident.
            isExcluded && "text-muted-foreground line-through"
          )}
        >
          {row.label}
        </span>
        {row.detail && (
          <span
            className={cn(
              "ms-2 text-[11px]",
              isExcluded ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {row.detail}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          isTotal ? "text-base font-medium" : "text-sm",
          isExcluded && "text-muted-foreground line-through"
        )}
      >
        {/* A row that contributes nothing shows a dash, not 0 -- 0 would read
            as "we calculated zero" rather than "this does not count". */}
        {row.amount ?? "—"}
      </dd>
    </div>
  );
}
