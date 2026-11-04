/**
 * Small workflow facts the list and the ticket page share: whose turn it is,
 * whether an issue is finished, whether it is overdue, the "needs attention"
 * chips on the tickets list. Status and priority colours live in
 * components/maintenance-tickets/status-accent.ts (one source for every surface).
 */

import type { IssueStatus, WhoseTurn } from "@/types/maintenance-system";

/** `App\Enums\IssueStatus` whose-turn column. */
export const WHOSE_TURN_BY_STATUS = {
  new: "office",
  in_review: "office",
  waiting_on_store: "store",
  inspection: "technician",
  waiting_approval: "approver",
  scheduled: "technician",
  work_done: "office_or_store",
  closed: "none",
  cancelled: "none",
} as const satisfies Record<IssueStatus, WhoseTurn>;

export function whoseTurn(status: IssueStatus): WhoseTurn {
  return WHOSE_TURN_BY_STATUS[status];
}

const TERMINAL: ReadonlySet<IssueStatus> = new Set<IssueStatus>(["closed", "cancelled"]);

export function isTerminal(status: IssueStatus): boolean {
  return TERMINAL.has(status);
}

/** Target date passed and not finished. A bad or missing date is never overdue. */
export function isOverdue(
  targetCompletionAt: string | null | undefined,
  status: IssueStatus,
  now: Date = new Date(),
): boolean {
  if (!targetCompletionAt || isTerminal(status)) return false;
  const target = new Date(targetCompletionAt).getTime();
  return Number.isFinite(target) && target < now.getTime();
}

/** The tickets list's "needs attention" chips (UI doc §1). */
export type AttentionChip = "waiting_on_store" | "waiting_approval" | "work_done" | "overdue";

export const ATTENTION_CHIPS = [
  { id: "waiting_on_store", key: "tickets.attention.waitingOnStore", label: "Waiting on store", status: "waiting_on_store" },
  { id: "waiting_approval", key: "tickets.attention.waitingApproval", label: "Waiting for approval", status: "waiting_approval" },
  { id: "work_done", key: "tickets.attention.workDone", label: "Work done to check", status: "work_done" },
  { id: "overdue", key: "tickets.attention.overdue", label: "Overdue", status: null },
] as const satisfies readonly { id: AttentionChip; key: string; label: string; status: IssueStatus | null }[];

