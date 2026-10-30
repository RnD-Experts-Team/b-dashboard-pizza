/**
 * Labels and icons for the workflow actions the server lists in
 * `workflow.next[]` (the ticket page's sticky footer: the primary next step
 * and the chevron menu). The server's own `label` wins when present; these
 * are the i18n keys / English fallbacks and the icon for each known id.
 *
 * Each action opens ONE small dialog with only its fields (UI doc §2).
 * `service` names the maintenanceWorkflowService method it calls.
 */

import type { WorkflowActionId, WorkflowNextAction } from "@/types/maintenance-v2";

export interface WorkflowActionMeta {
  id: WorkflowActionId;
  key: string;
  label: string;
  /** lucide-react icon name. */
  icon: string;
  /** maintenanceWorkflowService method. */
  service: string;
  /** Styled destructive (cancel). */
  destructive?: boolean;
  /** Store managers can do it from the read-only page. */
  storeStep?: boolean;
}

const k = (id: string) => `workflow.actions.${id}`;

export const WORKFLOW_ACTIONS = {
  review: { id: "review", key: k("review"), label: "Start review", icon: "Search", service: "review" },
  info_request: { id: "info_request", key: k("info_request"), label: "Ask the store", icon: "MessageCircleQuestion", service: "askStore" },
  answer: {
    id: "answer",
    key: k("answer"),
    label: "Answer the question",
    icon: "MessageCircleReply",
    service: "answerStoreQuestion",
    storeStep: true,
  },
  inspection: { id: "inspection", key: k("inspection"), label: "Book inspection", icon: "ScanSearch", service: "bookInspection" },
  inspection_result: {
    id: "inspection_result",
    key: k("inspection_result"),
    label: "Record inspection result",
    icon: "ClipboardList",
    service: "recordInspectionResult",
  },
  approval_request: {
    id: "approval_request",
    key: k("approval_request"),
    label: "Ask for approval",
    icon: "BadgeDollarSign",
    service: "requestApproval",
  },
  approval: { id: "approval", key: k("approval"), label: "Record approval", icon: "Stamp", service: "recordApproval" },
  schedule: { id: "schedule", key: k("schedule"), label: "Schedule work", icon: "CalendarPlus", service: "scheduleWork" },
  move: { id: "move", key: k("move"), label: "Move booking", icon: "CalendarClock", service: "moveSchedule" },
  work_done: { id: "work_done", key: k("work_done"), label: "Mark work done", icon: "Hammer", service: "markWorkDone" },
  confirmation: {
    id: "confirmation",
    key: k("confirmation"),
    label: "Is it working now?",
    icon: "CircleHelp",
    service: "confirm",
    storeStep: true,
  },
  close: { id: "close", key: k("close"), label: "Close ticket", icon: "CircleCheck", service: "close" },
  jump: { id: "jump", key: k("jump"), label: "Jump to a status", icon: "Shuffle", service: "jump" },
  cancel: { id: "cancel", key: k("cancel"), label: "Cancel", icon: "CircleSlash", service: "cancel", destructive: true },
} as const satisfies Record<string, WorkflowActionMeta>;

const FALLBACK_ICON = "ArrowRight";
const UNDERSCORE = "_";

/** Meta for any id, including ones this file does not know yet. */
export function actionMeta(id: WorkflowActionId): WorkflowActionMeta {
  const known = (WORKFLOW_ACTIONS as Record<string, WorkflowActionMeta>)[id];
  if (known) return known;
  return { id, key: "", label: id.split(UNDERSCORE).join(" "), icon: FALLBACK_ICON, service: "" };
}

/** The footer's split: the primary step and the rest (chevron menu). */
export function splitNextActions(next: readonly WorkflowNextAction[] | null | undefined): {
  primary: WorkflowNextAction | null;
  others: WorkflowNextAction[];
} {
  const list = next ?? [];
  const primary = list.find((a) => a.primary) ?? list[0] ?? null;
  return { primary, others: list.filter((a) => a !== primary) };
}
