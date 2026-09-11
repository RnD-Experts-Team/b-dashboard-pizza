"use client";

import { Paperclip, StickyNote, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DailyPayGatheredBlock } from "./daily-pay-gathered-block";
import { DailyPayWarningsPanel } from "./daily-pay-warnings-panel";
import { DailyPayLineDetailCard } from "./daily-pay-line-detail-card";
import { formatMoney, formatRate, paymentTotalPreview } from "@/lib/daily-pay/money";
import type { DailyPayPayment } from "@/types/daily-pay.types";

function MoneyRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  const body = (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium tabular-nums">{value}</span>
    </div>
  );
  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{body}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface DailyPayPaymentDetailCardProps {
  payment: DailyPayPayment;
  index: number;
}

export function DailyPayPaymentDetailCard({
  payment,
  index,
}: DailyPayPaymentDetailCardProps) {
  // The server's figure is authoritative; the preview only fills a gap.
  const total = payment.totalAmount ?? paymentTotalPreview(payment);

  return (
    <div className="space-y-3 rounded-lg border border-s-2 border-s-primary bg-card p-4">
      {/* Payee + THE payable figure */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {payment.technician?.name ?? `Payee #${payment.technicianId}`}
          </span>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Payment {index + 1}
          </p>
        </div>
        <div className="text-end">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total amount
          </p>
          <p className="text-xl font-semibold tabular-nums">{formatMoney(total)}</p>
          {/* lines_total is a BREAKDOWN, never the payable figure — it excludes
              payment-level gas, additional owed and lump sum. */}
          {payment.linesTotal != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="cursor-help text-[11px] tabular-nums text-muted-foreground">
                  Per-store subtotal {formatMoney(payment.linesTotal)}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Sum of the store lines; excludes payment-level gas, additional owed and lump
                sum. Not the payable figure.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Payment-level money — not attributable to any one store */}
      <div className="space-y-1 rounded-md bg-muted/40 p-2.5">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Payment level
        </p>
        {payment.lumpSum != null ? (
          <MoneyRow
            label="Lump sum"
            value={formatMoney(payment.lumpSum)}
            tooltip="Replaces the labour on all of this payment's store lines."
          />
        ) : (
          payment.hourlyPaymentRate != null && (
            <MoneyRow
              label="Default rate"
              value={`${formatRate(payment.hourlyPaymentRate)}/h`}
              tooltip="Used for any line that has no rate of its own."
            />
          )
        )}
        <MoneyRow label="Gas" value={formatMoney(payment.gas)} />
        <MoneyRow
          label="Additional owed"
          value={formatMoney(payment.moneyOwed)}
          tooltip="An extra amount owed on top; not the total."
        />
        {payment.gathered?.reimbursableParts != null && (
          <MoneyRow
            label="Reimbursable parts"
            value={formatMoney(payment.gathered.reimbursableParts)}
            tooltip="Counted once here. The per-line figures are an attributed subset of this same money."
          />
        )}
      </div>

      <DailyPayWarningsPanel warnings={payment.aggregationWarnings} />

      <DailyPayGatheredBlock gathered={payment.gathered} level="payment" />

      {/* Store lines — null means the list endpoint did not send them. */}
      {payment.lines == null ? (
        <p className="text-[11px] text-muted-foreground">
          Store lines are not included in this view.
        </p>
      ) : payment.lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No store lines.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stores ({payment.lines.length})
          </p>
          {payment.lines.map((line, i) => (
            <DailyPayLineDetailCard key={line.id} line={line} payment={payment} index={i} />
          ))}
        </div>
      )}

      {payment.notes != null && payment.notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Payment notes
          </p>
          <div className="space-y-1.5">
            {payment.notes.map((note) => (
              <div key={note.id} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                {note.typeLabel && (
                  <Badge variant="secondary" className="mb-1 font-normal">
                    {note.typeLabel}
                  </Badge>
                )}
                <p className="whitespace-pre-wrap">{note.body}</p>
                {note.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {note.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" />
                        {att.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {payment.attachments != null && payment.attachments.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            Payment attachments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {payment.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-primary hover:underline"
              >
                <Paperclip className="h-3 w-3" />
                {att.fileName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
