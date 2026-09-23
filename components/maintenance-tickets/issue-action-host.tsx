"use client";

import {
  ChangeStatusPanel,
  AssignPriorityPanel,
  RelinkIssuePanel,
  AssignPanel,
  DeferPanel,
  WaitPanel,
  CancelPanel,
  DiagnosisPanel,
  WarrantyPanel,
  PayEntryPanel,
  AttachTechsPanel,
  DelayAssignmentPanel,
  ChangeTechsPanel,
} from "./action-panels";
import { AttendancePanel } from "./attendance-panel";
import { PartUsagePanel } from "./part-usage-panel";
import type { IssueActionId } from "@/lib/maintenance-tickets/issue-actions";
import type { IssueDraft } from "@/lib/hooks/use-ticket-draft";
import type {
  CatalogTechnician,
  TicketIssue,
  TicketIssueAttendance,
} from "@/types/maintenance-tickets.types";

/**
 * Renders whichever action panel is currently chosen.
 *
 * One switch, so every surface that offers actions -- the ticket page, the
 * detail sheet, the bulk bar -- reaches the same panels through the same door.
 * Adding an action means adding a case here and a row in `ISSUE_ACTIONS`;
 * there is nowhere else to forget.
 */

export interface IssueActionHostProps {
  action: IssueActionId | null;
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  /** Every issue on this ticket, for the attendance panel's cross-issue picker. */
  ticketIssues?: TicketIssue[];
  /** Scopes attendance's other-tickets search. Null searches unscoped. */
  storeNumber?: string | null;
  /** An existing attendance session to add to, instead of starting a new one.
   *  Set when "Record what happened next" was pressed on that session, or when
   *  "Log hours" was pressed and exactly one session on this issue was open. */
  liveAttendance?: TicketIssueAttendance | null;
  /** Every session on this issue that is still open. When `liveAttendance` is
   *  null because more than one was open, the panel offers these as a pick
   *  rather than starting a session on top of them. */
  attendanceOpenSessions?: TicketIssueAttendance[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClearDraftFields: (keys: Array<keyof IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function IssueActionHost({
  action,
  issue,
  storeId,
  ticketId,
  technicians,
  ticketIssues,
  storeNumber,
  liveAttendance = null,
  attendanceOpenSessions,
  issueDraft,
  onPatchDraft,
  onClearDraftFields,
  onClose,
  onSuccess,
}: IssueActionHostProps) {
  if (!action) return null;

  // The shape every panel takes. Pulled out so a new panel cannot be wired up
  // with a subtly different set of callbacks.
  const base = { issue, storeId, ticketId, onClose, onSuccess };
  const withDraft = { ...base, issueDraft, onPatchDraft };
  const full = { ...withDraft, onClearDraftFields };

  switch (action) {
    case "status":
      return <ChangeStatusPanel {...base} />;
    case "priority":
      return <AssignPriorityPanel {...base} />;
    case "relink":
      return <RelinkIssuePanel {...base} />;
    case "assign":
      return <AssignPanel {...withDraft} technicians={technicians} />;
    case "defer":
      return <DeferPanel {...withDraft} />;
    case "wait":
      return <WaitPanel {...withDraft} />;
    case "cancel":
      return <CancelPanel {...withDraft} />;
    case "diagnosis":
      return <DiagnosisPanel {...full} />;
    case "warranty":
      return <WarrantyPanel {...full} />;
    case "pay":
      return <PayEntryPanel {...full} technicians={technicians} />;
    case "attachTechs":
      return <AttachTechsPanel {...full} technicians={technicians} />;
    case "delay":
      return <DelayAssignmentPanel {...full} />;
    case "changeTechs":
      return <ChangeTechsPanel {...full} technicians={technicians} />;
    case "attendance":
      return (
        <AttendancePanel
          {...full}
          technicians={technicians}
          ticketIssues={ticketIssues}
          storeNumber={storeNumber}
          liveEntry={liveAttendance}
          openEntries={attendanceOpenSessions}
        />
      );
    case "part":
      return <PartUsagePanel {...full} technicians={technicians} />;
    default: {
      // Exhaustiveness guard: adding an IssueActionId without a case here is a
      // compile error, not a silently blank panel.
      const never: never = action;
      return never;
    }
  }
}
