/**
 * Small workflow facts the list and the ticket page share: whose turn it is,
 * whether an issue is finished, whether it is overdue, the "needs attention"
 * chips on the tickets list, and the paired status badge tones.
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

/**
 * Paired light/dark tone per status, for badges (always WITH text — never
 * colour alone). Tailwind palette pairs, as CLAUDE.md asks for status colours.
 */
export const STATUS_TONE = {
  new: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  in_review: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  waiting_on_store: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  inspection: "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  waiting_approval: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  scheduled: "bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  work_done: "bg-teal-500/15 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  closed: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
} as const satisfies Record<IssueStatus, string>;
