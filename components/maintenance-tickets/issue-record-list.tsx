"use client";

import { Clock, Package, Plus, Stethoscope, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtFixed } from "@/lib/utils/number-display";
import { formatDateOrTimestamp, formatTimestamp } from "@/lib/utils/date-display";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { AttendanceDurationsStrip } from "./attendance-durations-strip";
import { AttendanceStream } from "./attendance-stream";
import { isOnTheClock } from "@/lib/maintenance-tickets/attendance-events";
import { PaymentStatusBadge } from "./payment-status-badge";
import { RecordCorrectionMenu } from "./record-correction-menu";
import {
  seedFromAttendance,
  seedFromDiagnosis,
  seedFromPartUsage,
  seedFromPayEntry,
  seedFromWarranty,
  type CorrectionSeed,
} from "@/lib/maintenance-tickets/corrections";
import type {
  TicketIssue,
  TicketIssueAttendance,
} from "@/types/maintenance-tickets.types";

/**
 * What has already been written down on an issue.
 *
 * Every row carries the same correction control, so "I typed that wrong" has
 * one answer everywhere instead of five. A flagged record is struck through and
 * stays in place: it is part of the record, and hiding it would defeat the
 * reason the flag exists.
 */

interface IssueRecordListProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  onCorrect: (seed: CorrectionSeed) => void;
  /** Opens the recording panel on one existing session. Absent means the
   *  stream is shown but nothing here can write to it. */
  onRecordAttendance?: (entry: TicketIssueAttendance) => void;
  onChanged: () => void;
  className?: string;
}

export function IssueRecordList({
  issue,
  storeId,
  ticketId,
  onCorrect,
  onRecordAttendance,
  onChanged,
  className,
}: IssueRecordListProps) {
  const hasAny =
    issue.attendanceEntries.length > 0 ||
    issue.partUsages.length > 0 ||
    issue.diagnoses.length > 0 ||
    issue.warranties.length > 0 ||
    issue.payEntries.length > 0;

  if (!hasAny) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Nothing recorded yet.
      </p>
    );
  }

  async function markAndRefresh(fn: () => Promise<void>) {
    await fn();
    onChanged();
  }

  return (
    <div className={cn("space-y-4", className)}>
      {issue.attendanceEntries.length > 0 && (
        <Section icon={Clock} title="Hours">
          {issue.attendanceEntries.map((entry) => (
            <Row key={entry.id} isMistaken={entry.mistaken}>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {entry.technician?.name ?? `Technician #${entry.technicianId}`}
                  </span>
                  {entry.payment && <PaymentStatusBadge status={entry.payment.status} />}
                  {/* An open session is somebody working right now, not a
                      missing value. Worth saying on the page rather than only
                      inside the panel. */}
                  {isOnTheClock(entry.events) && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground no-underline!">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      on the clock
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {entry.startClock ? formatTimestamp(entry.startClock) : "no clock-in"}
                  {" → "}
                  {entry.endClock ? formatTimestamp(entry.endClock) : "still on the clock"}
                </p>

                {/*
                  The same stream the panel uses, handed no callbacks, which is
                  what makes it read-only -- there is no second copy of this
                  markup to drift out of step with the one you record into.
                */}
                {entry.events.length > 0 && (
                  <AttendanceStream events={entry.events} className="pt-0.5" />
                )}

                <AttendanceDurationsStrip durations={entry.durations} />

                {onRecordAttendance && !entry.mistaken && (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(entry)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground no-underline!"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Record what happened next
                  </button>
                )}
              </div>
              <RecordCorrectionMenu
                kind="attendance"
                isMistaken={entry.mistaken}
                seed={seedFromAttendance(entry)}
                onCorrect={onCorrect}
                onMarkMistaken={() =>
                  markAndRefresh(() =>
                    maintenanceTicketsService.markAttendanceMistaken(storeId, ticketId, entry.id)
                  )
                }
              />
            </Row>
          ))}
        </Section>
      )}

      {issue.partUsages.length > 0 && (
        <Section icon={Package} title="Parts">
          {issue.partUsages.map((usage) => (
            <Row key={usage.id} isMistaken={usage.mistaken}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {usage.part?.name ?? `Part #${usage.partId}`}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fmtFixed(usage.quantity, 2)} × {fmtFixed(usage.unitCost, 2)}
                  </span>
                  {usage.payment && <PaymentStatusBadge status={usage.payment.status} />}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {/* Net, not gross: after returns is what anybody is actually
                      out of pocket, and it is what the pay sheet reimburses. */}
                  {fmtFixed(usage.netCost, 2)}
                  {usage.paidBy ? ` · ${usage.paidBy.label}` : ""}
                  {usage.storageLocation ? ` · from ${usage.storageLocation.name}` : ""}
                </p>
              </div>
              <RecordCorrectionMenu
                kind="part"
                isMistaken={usage.mistaken}
                seed={seedFromPartUsage(usage)}
                onCorrect={onCorrect}
                onMarkMistaken={() =>
                  markAndRefresh(() =>
                    maintenanceTicketsService.markPartUsageMistaken(storeId, ticketId, usage.id)
                  )
                }
              />
            </Row>
          ))}
        </Section>
      )}

      {issue.diagnoses.length > 0 && (
        <Section icon={Stethoscope} title="What was found">
          {issue.diagnoses.map((diagnosis) => (
            <Row key={diagnosis.id} isMistaken={diagnosis.mistaken}>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="whitespace-pre-wrap text-sm">{diagnosis.body || "—"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatTimestamp(diagnosis.createdAt)}
                </p>
              </div>
              <RecordCorrectionMenu
                kind="diagnosis"
                isMistaken={diagnosis.mistaken}
                seed={seedFromDiagnosis(diagnosis)}
                onCorrect={onCorrect}
                onMarkMistaken={() =>
                  markAndRefresh(() =>
                    maintenanceTicketsService.markDiagnosisMistaken(storeId, ticketId, diagnosis.id)
                  )
                }
              />
            </Row>
          ))}
        </Section>
      )}

      {issue.warranties.length > 0 && (
        <Section icon={ShieldCheck} title="Warranty">
          {issue.warranties.map((warranty) => (
            <Row key={warranty.id} isMistaken={warranty.mistaken}>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="whitespace-pre-wrap text-sm">{warranty.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {warranty.expiryDate
                    ? `covered until ${formatDateOrTimestamp(warranty.expiryDate)}`
                    : "no end date recorded"}
                </p>
              </div>
              <RecordCorrectionMenu
                kind="warranty"
                isMistaken={warranty.mistaken}
                seed={seedFromWarranty(warranty)}
                onCorrect={onCorrect}
                onMarkMistaken={() =>
                  markAndRefresh(() =>
                    maintenanceTicketsService.markWarrantyMistaken(storeId, ticketId, warranty.id)
                  )
                }
              />
            </Row>
          ))}
        </Section>
      )}

      {issue.payEntries.length > 0 && (
        <Section icon={Wallet} title="One-off payments">
          {issue.payEntries.map((entry) => (
            <Row key={entry.id} isMistaken={entry.mistaken}>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {entry.technician?.name ?? `Technician #${entry.technicianId}`}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  base {fmtFixed(entry.basePay, 2)} · performance {fmtFixed(entry.performancePay, 2)}
                </p>
              </div>
              <RecordCorrectionMenu
                kind="pay"
                isMistaken={entry.mistaken}
                seed={seedFromPayEntry(entry)}
                onCorrect={onCorrect}
                onMarkMistaken={() =>
                  markAndRefresh(() =>
                    maintenanceTicketsService.markPayEntryMistaken(storeId, ticketId, entry.id)
                  )
                }
              />
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  isMistaken,
  children,
}: {
  isMistaken: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card p-2.5",
        // Struck through and dimmed, but still here. A flagged record is part
        // of the audit trail; removing it from view would defeat the point.
        isMistaken && "border-dashed opacity-60 [&_p]:line-through [&_span]:line-through"
      )}
    >
      {children}
      {isMistaken && (
        <span className="shrink-0 self-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground no-underline!">
          mistake
        </span>
      )}
    </div>
  );
}
