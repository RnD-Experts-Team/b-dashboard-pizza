"use client";

import { Paperclip, Receipt, StickyNote, Store, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoursSourceBadge } from "./hours-source-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DailyPayGatheredBlock } from "./daily-pay-gathered-block";
import {
  effectiveHours,
  formatHours,
  formatLabourBasis,
  formatMoney,
  payableHours,
  resolveRate,
} from "@/lib/daily-pay/money";
import type { DailyPayLine, DailyPayPayment } from "@/types/daily-pay.types";
import type { TicketNote } from "@/types/maintenance-tickets.types";

/** Notes carrying migrated `invoices` values from before the field was dropped. */
const LEGACY_INVOICES_TYPE = "legacy_invoices";

function Field({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tooltip?: string;
}) {
  const body = (
    <div className="space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-[11px] font-medium tabular-nums">{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  );
  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{body}</div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** legacy_invoices first — it is the migrated figure someone is looking for. */
function sortNotes(notes: TicketNote[]): TicketNote[] {
  return [...notes].sort((a, b) => {
    const aLegacy = a.type === LEGACY_INVOICES_TYPE ? 0 : 1;
    const bLegacy = b.type === LEGACY_INVOICES_TYPE ? 0 : 1;
    return aLegacy - bLegacy;
  });
}

function NoteCard({ note }: { note: TicketNote }) {
  const isLegacy = note.type === LEGACY_INVOICES_TYPE;
  return (
    <div
      className={
        isLegacy
          ? "rounded-md border border-dashed bg-muted/50 p-2.5 text-sm"
          : "rounded-md border bg-muted/30 p-2.5 text-sm"
      }
    >
      {isLegacy ? (
        <Badge variant="outline" className="mb-1 gap-1 font-normal">
          <Receipt className="h-3 w-3" />
          {note.typeLabel ?? "Legacy invoices"} (migrated)
        </Badge>
      ) : (
        note.typeLabel && (
          <Badge variant="secondary" className="mb-1 font-normal">
            {note.typeLabel}
          </Badge>
        )
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
  );
}

interface DailyPayLineDetailCardProps {
  line: DailyPayLine;
  payment: DailyPayPayment;
  index: number;
}

export function DailyPayLineDetailCard({
  line,
  payment,
  index,
}: DailyPayLineDetailCardProps) {
  const gatheredPayable = payableHours(line.gathered);
  const hours = effectiveHours(line);
  const isLumpSum = line.lumpSum != null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
      {/* Store or free-text location */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Store className="h-3.5 w-3.5 text-muted-foreground" />
          {line.store?.storeNumber ?? line.otherStore ?? `Store #${line.storeId ?? "—"}`}
          {line.otherStore && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
              Other
            </Badge>
          )}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Line {index + 1}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {/* Hours: an overridden figure is shown BESIDE the gathered one, which
            is how a user sees "you typed 2 hours, the clocks say 8". */}
        {isLumpSum ? (
          <Field
            label="Labour"
            value={`${formatMoney(line.lumpSum)} lump sum`}
            hint="replaces hourly labour"
          />
        ) : (
          <Field
            label="Hours"
            value={
              <span className="flex items-center gap-1.5">
                {formatHours(hours)}
                {/* Says which it is either way, not just when overridden.
                    "Overridden" alone left the normal case unlabelled, so
                    there was no way to tell "these track the attendance" from
                    "nobody has looked at this". */}
                <HoursSourceBadge line={line} />
              </span>
            }
            hint={
              line.hoursOverridden
                ? gatheredPayable != null
                  ? `gathered ${formatHours(gatheredPayable)}`
                  : undefined
                : "gathered from attendance"
            }
          />
        )}

        {!isLumpSum && (
          <Field label="Rate" value={formatMoney(resolveRate(line, payment))} hint="per hour" />
        )}
        <Field label="Gas" value={formatMoney(line.gas)} />
        <Field
          label="Additional owed"
          value={formatMoney(line.moneyOwed)}
          tooltip="An extra amount owed on top; not the total."
        />
        <Field
          label="Line total"
          value={formatMoney(line.lineTotal)}
          hint={!isLumpSum ? formatLabourBasis(line, payment) : undefined}
        />
      </div>

      <DailyPayGatheredBlock gathered={line.gathered} level="line" />

      {/* Linked ticket issues — null means not loaded, [] means none. */}
      {line.ticketIssues != null && line.ticketIssues.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Ticket className="h-3 w-3" />
            Linked ticket issues
          </p>
          <div className="space-y-1">
            {line.ticketIssues.map((ti) => (
              <div
                key={ti.id}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  Ticket #{ti.ticketId}
                </span>
                <span className="font-medium">
                  {ti.issueTitle || ti.otherTitle || `Issue #${ti.id}`}
                </span>
                {ti.status && (
                  <Badge variant="secondary" className="font-normal capitalize">
                    {ti.status}
                  </Badge>
                )}
                {ti.priority && (
                  <Badge variant="outline" className="font-normal capitalize">
                    {ti.priority}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {line.notes != null && line.notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Notes
          </p>
          <div className="space-y-1.5">
            {sortNotes(line.notes).map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {line.attachments != null && line.attachments.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            Attachments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {line.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border bg-card px-2 py-1 text-xs text-primary hover:underline"
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
