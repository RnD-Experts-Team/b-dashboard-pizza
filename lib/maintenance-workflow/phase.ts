/**
 * Where an issue really is, for the ticket page's step strip and Now panel.
 *
 * The status is the server's, but two steps send an issue back to In review
 * although it is far past step 2: an approval (so the office can schedule
 * the work) and the store saying it still doesn't work (schedule more
 * work). Those read as "ready to schedule", on the Scheduled step, not as
 * a new review. Any other way back to In review (the store answered, the
 * approval was rejected, a jump) is a real review.
 */

import type { IssueStatus, TicketIssueDetail } from "@/types/maintenance-system";

export type IssuePhase = IssueStatus | "approved" | "not_fixed";

/** A step and the status change it causes are saved in the same request. */
const SAME_ACTION_MS = 5_000;

/** The status the step strip sits on for a phase. */
const PHASE_STATUS: Record<"approved" | "not_fixed", IssueStatus> = {
  approved: "scheduled",
  not_fixed: "scheduled",
};

function time(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** When the issue last moved into In review (the presenter sends `to_status` on each change). */
function lastIntoReview(issue: TicketIssueDetail): number | null {
  const into = issue.statusChanges.filter((c) => {
    const raw = c as unknown as { toStatus?: string; status?: { value?: string } | null };
    return (raw.toStatus ?? raw.status?.value) === "in_review";
  });
  const times = into.map((c) => time(c.createdAt)).filter((ms): ms is number => ms !== null);
  return times.length ? Math.max(...times) : null;
}

/** Did `at` cause the move into review at `review`? */
function caused(at: string | null | undefined, review: number): boolean {
  const ms = time(at);
  return ms !== null && Math.abs(ms - review) <= SAME_ACTION_MS;
}

export function issuePhase(issue: TicketIssueDetail): IssuePhase {
  const status = issue.status.value;
  if (status !== "in_review") return status;
  const review = lastIntoReview(issue);
  if (review === null) return status;

  const approval = issue.approvals.filter((a) => !a.mistaken).sort((a, b) => b.id - a.id)[0];
  if (approval?.decision === "approved" && caused(approval.decidedAt, review)) return "approved";
  if (issue.storeConfirmedWorking === false && caused(issue.storeConfirmedAt, review)) return "not_fixed";
  return status;
}

/** The status the step strip shows for a phase. */
export function phaseStatus(phase: IssuePhase): IssueStatus {
  return phase === "approved" || phase === "not_fixed" ? PHASE_STATUS[phase] : phase;
}
