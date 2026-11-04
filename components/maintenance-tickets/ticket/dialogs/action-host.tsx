"use client";

import type { ReactNode } from "react";
import type { WorkflowActionId } from "@/types/maintenance-system";
import { BookInspectionDialog, MoveBookingDialog, ScheduleWorkDialog } from "./booking-dialogs";
import { CancelDialog, CloseDialog, JumpDialog, WorkDoneDialog } from "./finish-dialogs";
import { ApprovalRequestDialog, InspectionResultDialog, RecordApprovalDialog } from "./inspection-approval-dialogs";
import { AnswerDialog, AskStoreDialog, ConfirmationDialog, ReviewDialog } from "./review-store-dialogs";
import type { StepDialogProps } from "./types";

/** What the page asks to open: a workflow step, or one of the page's own actions. */
export type OpenAction =
  | { id: WorkflowActionId; scheduleId?: number; inspectionId?: number }
  | { id: "second_opinion" }
  | { id: "cancel_ticket" };

export interface ActionHostProps extends Omit<StepDialogProps, "open"> {
  action: OpenAction | null;
  ticketId: number;
  onBooked: (date: string) => void;
  onTicketCancelled: () => void;
}

type HostDialog = (props: ActionHostProps & { open: boolean }) => ReactNode;

/** One small dialog per action (UI doc §2); unknown ids open nothing. */
const DIALOGS: Record<string, HostDialog> = {
  review: (p) => <ReviewDialog {...p} />,
  info_request: (p) => <AskStoreDialog {...p} />,
  answer: (p) => <AnswerDialog {...p} />,
  inspection: (p) => <BookInspectionDialog {...p} />,
  second_opinion: (p) => <BookInspectionDialog {...p} secondOpinion />,
  inspection_result: (p) => (
    <InspectionResultDialog {...p} inspectionId={p.action && "inspectionId" in p.action ? p.action.inspectionId : null} />
  ),
  approval_request: (p) => <ApprovalRequestDialog {...p} />,
  approval: (p) => <RecordApprovalDialog {...p} />,
  schedule: (p) => <ScheduleWorkDialog {...p} />,
  move: (p) => <MoveBookingDialog {...p} scheduleId={p.action && "scheduleId" in p.action ? p.action.scheduleId : null} />,
  work_done: (p) => <WorkDoneDialog {...p} />,
  confirmation: (p) => <ConfirmationDialog {...p} />,
  close: (p) => <CloseDialog {...p} />,
  jump: (p) => <JumpDialog {...p} />,
  cancel: (p) => <CancelDialog {...p} scope="issue" />,
  cancel_ticket: (p) => <CancelDialog {...p} scope="ticket" />,
};

/** Mounts only the open dialog, so each starts with fresh fields. */
export function ActionHost(props: ActionHostProps) {
  const render = props.action ? DIALOGS[props.action.id] : undefined;
  if (!render) return null;
  return <>{render({ ...props, open: true })}</>;
}

export function hasDialog(id: string): boolean {
  return id in DIALOGS;
}
