/**
 * The ticket page's progress strip (docs/MAINTENANCE-UI.md §2): the 11
 * flowchart steps compressed to 8 dots —
 *
 *   Submitted · Review · Store · Inspection · Approval · Scheduled · Work done · Closed
 *
 * Step numbers are the backend's `IssueWorkflowService::stepOf`: new 1,
 * in_review 2, waiting_on_store 3, inspection 5, waiting_approval 7,
 * scheduled 8, work_done 10, closed/cancelled 11. The current dot is filled;
 * an optional dot before it that the issue never went through is hollow
 * ("skipped"); the rest are done or still to come.
 */

import type { IssueStatus } from "@/types/maintenance-system";

export type StepDotId =
  | "submitted"
  | "review"
  | "store"
  | "inspection"
  | "approval"
  | "scheduled"
  | "work_done"
  | "closed";

export type StepDotState = "done" | "current" | "skipped" | "upcoming";

export interface StepDot {
  id: StepDotId;
  /** i18n key in `maintenanceSystem`. */
  key: string;
  label: string;
  /** The status this dot stands for. */
  status: IssueStatus;
  /** Optional steps can be skipped (hollow) without anything being wrong. */
  optional: boolean;
}

export const STEP_DOTS = [
  { id: "submitted", key: "workflow.steps.submitted", label: "Submitted", status: "new", optional: false },
  { id: "review", key: "workflow.steps.review", label: "Review", status: "in_review", optional: false },
  { id: "store", key: "workflow.steps.store", label: "Store", status: "waiting_on_store", optional: true },
  { id: "inspection", key: "workflow.steps.inspection", label: "Inspection", status: "inspection", optional: true },
  { id: "approval", key: "workflow.steps.approval", label: "Approval", status: "waiting_approval", optional: true },
  { id: "scheduled", key: "workflow.steps.scheduled", label: "Scheduled", status: "scheduled", optional: true },
  { id: "work_done", key: "workflow.steps.workDone", label: "Work done", status: "work_done", optional: true },
  { id: "closed", key: "workflow.steps.closed", label: "Closed", status: "closed", optional: false },
] as const satisfies readonly StepDot[];

/**
 * The owner's 11-step flowchart in order; a step's number is its position
 * (1-based). The in-between steps (store answered, inspection result, the
 * visit) have no status of their own, so they hold `null`. This yields
 * `IssueWorkflowService::stepOf`: new 1, in_review 2, waiting_on_store 3,
 * inspection 5, waiting_approval 7, scheduled 8, work_done 10, closed 11.
 */
const FLOWCHART: readonly (IssueStatus | null)[] = [
  "new",
  "in_review",
  "waiting_on_store",
  null,
  "inspection",
  null,
  "waiting_approval",
  "scheduled",
  null,
  "work_done",
  "closed",
];

/** `IssueWorkflowService::stepOf` (cancelled shares the last step with closed). */
export function stepOf(status: IssueStatus): number {
  const at = FLOWCHART.indexOf(status === "cancelled" ? "closed" : status);
  return at + 1;
}

/** How many steps the flowchart has. */
export const STEP_COUNT = FLOWCHART.length;

/** Which dot a status sits on (cancelled sits on the last one). */
export function dotIndexOf(status: IssueStatus): number {
  if (status === "cancelled") return STEP_DOTS.length - 1;
  return STEP_DOTS.findIndex((d) => d.status === status);
}

export interface StepDotView extends StepDot {
  state: StepDotState;
}

function dotState(index: number, current: number, dot: StepDot, seen: ReadonlySet<IssueStatus> | null): StepDotState {
  if (index === current) return "current";
  if (index > current) return "upcoming";
  return dot.optional && seen && !seen.has(dot.status) ? "skipped" : "done";
}

/**
 * The 8 dots for an issue. `visited` = every status the issue has been in
 * (from its status changes); without it, every optional dot before the
 * current one reads as done.
 */
export function stepDots(status: IssueStatus, visited?: readonly IssueStatus[]): StepDotView[] {
  const current = dotIndexOf(status);
  const seen = visited ? new Set<IssueStatus>(visited) : null;
  return STEP_DOTS.map((dot, i) => ({ ...dot, state: dotState(i, current, dot, seen) }));
}
