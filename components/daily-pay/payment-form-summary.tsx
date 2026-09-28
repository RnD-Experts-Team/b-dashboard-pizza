"use client";

import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/daily-pay/money";
import type { PaymentFormPreview, PreviewRow } from "@/lib/daily-pay/payment-form-preview";

/**
 * The payment's running total, updated as the form is filled.
 *
 * The form's fields each say what they do; this says what they ADD UP TO, and
 * why -- one row per thing that counts, and the things that do not count
 * (stores covered by the day's price, break time) listed struck through with
 * the reason. Figures the server only works out on save are said to be pending
 * rather than shown as $0.
 */
export function PaymentFormSummary({
  preview,
  payeeName,
  className,
}: {
  preview: PaymentFormPreview;
  payeeName: string | null;
  className?: string;
}) {
  return (
    <section
      aria-label="What this payment adds up to"
      className={cn("rounded-lg border bg-muted/30 p-3.5", className)}
    >
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
        What this payment adds up to
      </p>

      <dl className="space-y-1.5">
        {preview.rows.map((row, i) => (
          <Row key={`${row.label}-${i}`} row={row} />
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t pt-2.5">
        <span className="text-sm font-medium">
          {preview.hasPending ? "So far, we owe " : "We owe "}
          {payeeName ?? "this payee"}
        </span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(preview.known)}</span>
      </div>
      {preview.hasPending && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Not final yet — plus the rows still “not entered yet” or “counted on save”. The exact
          figure is worked out when you save.
        </p>
      )}
    </section>
  );
}

function Row({ row }: { row: PreviewRow }) {
  const excluded = row.kind === "excluded";
  const pending = row.kind === "pending";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="min-w-0">
        <span className={cn("text-sm", excluded && "text-muted-foreground line-through")}>
          {row.label}
        </span>
        {row.detail && (
          <span
            className={cn(
              "ms-2 text-[11px]",
              excluded ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {row.detail}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          "text-sm tabular-nums",
          excluded && "text-muted-foreground",
          pending && "text-[11px] text-muted-foreground italic"
        )}
      >
        {/* A dash or words, never $0: zero would read as "we worked it out and
            it is nothing" rather than "this does not count" / "not known yet". */}
        {pending
          ? row.waitingOn === "you"
            ? "not entered yet"
            : "counted on save"
          : row.amount != null
            ? formatMoney(row.amount)
            : "—"}
      </dd>
    </div>
  );
}
