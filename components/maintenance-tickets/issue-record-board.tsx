"use client";

import { Clock, Package, Plus, Stethoscope, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtFixed } from "@/lib/utils/number-display";
import { formatDateOrTimestamp, formatTimestamp } from "@/lib/utils/date-display";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { AttendanceDurationsStrip } from "./attendance-durations-strip";
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
import {
  ISSUE_ACTIONS,
  availability,
  type IssueActionId,
} from "@/lib/maintenance-tickets/issue-actions";
import type { TicketIssue } from "@/types/maintenance-tickets.types";

/**
 * What has been written down on an issue -- laid out so it stops moving.
 *
 * THE PROBLEM THIS SOLVES. The previous list rendered only the kinds that had
 * something in them, so "Parts" was second on one issue, first on the next and
 * absent on a third. Every lookup started with a search. You cannot build a
 * habit against a layout that rearranges itself.
 *
 * So: five squares, ALWAYS all five, always in this order. Parts is in the same
 * place on an issue with no parts as on one with nine. Empty is a state a
 * square is in, not a reason to remove it.
 *
 * AND THE BUTTON LIVES IN THE SQUARE. Recording hours used to mean finding
 * "Log hours" in a grid of fourteen buttons somewhere further down, which put
 * the thing you read and the thing you press in two different places. Each of
 * the five `records` actions is the add-button of its own square now -- one
 * place per kind of record, for both reading it and adding to it.
 *
 * That is why the action grid below no longer carries the `records` group: it
 * would be the same five buttons twice, and two routes to one form is how you
 * end up unsure which one you used.
 */

type RecordKind = {
  /** The action that adds one. Also the square's identity. */
  action: Extract<IssueActionId, "attendance" | "part" | "diagnosis" | "warranty" | "pay">;
  title: string;
  icon: LucideIcon;
  /** 1-5, into the chart ramp. Theme-following, unlike a literal hue. */
  accent: 1 | 2 | 3 | 4 | 5;
  /** Said in the negative, so an empty square still tells you what it is for. */
  empty: string;
};

/**
 * THE ORDER IS THE CONTRACT. Changing it breaks every habit anybody has built,
 * so it changes only on purpose.
 *
 * Roughly by how often it is reached for: hours and parts are most of the
 * traffic and take the first, widest positions; warranty and one-off payments
 * are occasional and sit at the end.
 */
const KINDS: RecordKind[] = [
  {
    action: "attendance",
    title: "Hours",
    icon: Clock,
    accent: 1,
    empty: "No hours logged on this issue yet.",
  },
  {
    action: "part",
    title: "Parts",
    icon: Package,
    accent: 2,
    empty: "No parts recorded against this issue.",
  },
  {
    action: "diagnosis",
    title: "What was found",
    icon: Stethoscope,
    accent: 3,
    empty: "Nothing written up yet.",
  },
  {
    action: "warranty",
    title: "Warranty",
    icon: ShieldCheck,
    accent: 4,
    empty: "Nothing under warranty here.",
  },
  {
    action: "pay",
    title: "One-off payments",
    icon: Wallet,
    accent: 5,
    empty: "No one-off payment on this issue.",
  },
];

const ACCENT_BORDER: Record<number, string> = {
  1: "border-s-[var(--color-chart-1)]",
  2: "border-s-[var(--color-chart-2)]",
  3: "border-s-[var(--color-chart-3)]",
  4: "border-s-[var(--color-chart-4)]",
  5: "border-s-[var(--color-chart-5)]",
};

const ACCENT_TEXT: Record<number, string> = {
  1: "text-[var(--color-chart-1)]",
  2: "text-[var(--color-chart-2)]",
  3: "text-[var(--color-chart-3)]",
  4: "text-[var(--color-chart-4)]",
  5: "text-[var(--color-chart-5)]",
};

interface IssueRecordBoardProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  /** Which square's form is open, so the square can show it is the one talking. */
  activeAction: IssueActionId | null;
  /** The likely next step. It used to be flagged in the action grid; when the
   *  likely next step is a record, the flag has to follow it onto the square. */
  suggested: IssueActionId | null;
  onAdd: (action: IssueActionId | null) => void;
  onCorrect: (seed: CorrectionSeed) => void;
  onChanged: () => void;
  className?: string;
}

export function IssueRecordBoard({
  issue,
  storeId,
  ticketId,
  activeAction,
  suggested,
  onAdd,
  onCorrect,
  onChanged,
  className,
}: IssueRecordBoardProps) {
  async function markAndRefresh(fn: () => Promise<void>) {
    await fn();
    onChanged();
  }

  /** Live records only for the count -- a flagged one is still shown in the
   *  square, but counting it would overstate what actually happened. */
  const counts: Record<RecordKind["action"], number> = {
    attendance: issue.attendanceEntries.filter((e) => !e.mistaken).length,
    part: issue.partUsages.filter((p) => !p.mistaken).length,
    diagnosis: issue.diagnoses.filter((d) => !d.mistaken).length,
    warranty: issue.warranties.filter((w) => !w.mistaken).length,
    pay: issue.payEntries.filter((p) => !p.mistaken).length,
  };

  /** Flagged records included. A square holding nothing but mistakes is not
   *  empty -- it has something to show, and saying "nothing here" over the top
   *  of a visible row would be a plain lie. */
  const totals: Record<RecordKind["action"], number> = {
    attendance: issue.attendanceEntries.length,
    part: issue.partUsages.length,
    diagnosis: issue.diagnoses.length,
    warranty: issue.warranties.length,
    pay: issue.payEntries.length,
  };

  return (
    // Five squares into a 3-wide grid: hours/parts/findings on the top row,
    // warranty/payments on the second. Fixed columns per breakpoint, so a
    // square's position is a function of the screen and nothing else.
    <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>
      {KINDS.map((kind) => (
        <Square
          key={kind.action}
          kind={kind}
          issue={issue}
          count={counts[kind.action]}
          total={totals[kind.action]}
          isActive={activeAction === kind.action}
          isSuggested={suggested === kind.action}
          onAdd={onAdd}
        >
          {kind.action === "attendance" &&
            issue.attendanceEntries.map((entry) => (
              <Row key={entry.id} isMistaken={entry.mistaken}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {entry.technician?.name ?? `Technician #${entry.technicianId}`}
                    </span>
                    {entry.payment && <PaymentStatusBadge status={entry.payment.status} />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.startClock ? formatTimestamp(entry.startClock) : "no clock-in"}
                    {" → "}
                    {entry.endClock ? formatTimestamp(entry.endClock) : "still on the clock"}
                  </p>
                  <AttendanceDurationsStrip durations={entry.durations} />
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

          {kind.action === "part" &&
            issue.partUsages.map((usage) => (
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

          {kind.action === "diagnosis" &&
            issue.diagnoses.map((diagnosis) => (
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
                      maintenanceTicketsService.markDiagnosisMistaken(
                        storeId,
                        ticketId,
                        diagnosis.id
                      )
                    )
                  }
                />
              </Row>
            ))}

          {kind.action === "warranty" &&
            issue.warranties.map((warranty) => (
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

          {kind.action === "pay" &&
            issue.payEntries.map((entry) => (
              <Row key={entry.id} isMistaken={entry.mistaken}>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {entry.technician?.name ?? `Technician #${entry.technicianId}`}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    base {fmtFixed(entry.basePay, 2)} · performance{" "}
                    {fmtFixed(entry.performancePay, 2)}
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
        </Square>
      ))}
    </div>
  );
}

function Square({
  kind,
  issue,
  count,
  total,
  isActive,
  isSuggested,
  onAdd,
  children,
}: {
  kind: RecordKind;
  issue: TicketIssue;
  count: number;
  total: number;
  isActive: boolean;
  isSuggested: boolean;
  onAdd: (action: IssueActionId | null) => void;
  children: React.ReactNode;
}) {
  const Icon = kind.icon;
  const action = ISSUE_ACTIONS.find((a) => a.id === kind.action);
  // Same rule as the old grid: never hidden, disabled WITH the reason. A button
  // that vanishes teaches nothing; one that explains itself teaches the rule.
  const { enabled, reason } = action
    ? availability(action, issue)
    : { enabled: false, reason: undefined };


  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-s-2 bg-card transition-colors",
        ACCENT_BORDER[kind.accent],
        // The square whose form is open below says so, so the form on screen is
        // never ambiguous about which square it belongs to.
        isActive && "ring-2 ring-primary/40",
        isSuggested && !isActive && enabled && "ring-1 ring-primary/30"
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", ACCENT_TEXT[kind.accent])} aria-hidden="true" />
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider">
          {kind.title}
        </h3>
        {count > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}

        {/* The add-button for THIS kind, in the square for this kind. */}
        <button
          type="button"
          onClick={() => onAdd(isActive ? null : kind.action)}
          disabled={!enabled}
          aria-pressed={isActive}
          // The full sentence goes in the title, so the reason is reachable
          // even though the button itself has room for one word.
          title={enabled ? action?.description : reason}
          className={cn(
            "ms-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition-colors",
            enabled
              ? isActive
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              : "cursor-not-allowed border-dashed text-muted-foreground/50"
          )}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {isActive ? "Close" : isSuggested && enabled ? "Add next" : "Add"}
        </button>
      </header>

      {/* Capped and scrolled. Twenty hour entries in one square must not push
          the two squares beside it a thousand pixels down -- the whole point is
          that these things stay where they were. */}
      <div className="max-h-80 space-y-1.5 overflow-y-auto p-2.5">
        {total === 0 ? (
          <p className="py-1 text-xs leading-relaxed text-muted-foreground">{kind.empty}</p>
        ) : (
          children
        )}
        {!enabled && reason && (
          <p className="pt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            {reason}
          </p>
        )}
      </div>
    </section>
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
        "flex items-start gap-2 rounded-md border bg-background p-2.5",
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
