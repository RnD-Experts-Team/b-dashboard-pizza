/**
 * What the coordinator can do to an issue, and what to say when they can't.
 *
 * This is the whole vocabulary of the maintenance system in one table. It is
 * pure -- no React, no service calls -- so the ticket page, the bulk bar and
 * the detail sheet can all ask the same questions and get the same answers.
 *
 * Three rules shaped it, and all three came from the people who use this:
 *
 *  1. NOTHING IS HIDDEN. Every action is always listed. An action that cannot
 *     apply right now is disabled WITH A REASON, never removed -- a coordinator
 *     who remembers a button and cannot find it concludes the app is broken.
 *  2. PLAIN WORDS. Every action carries a one-line description in the language
 *     the job is actually done in. "Defer" means nothing; "stop this for now
 *     and make a fresh copy to do later" is what it does.
 *  3. SUGGEST, DON'T DECIDE. The likely next step is marked so the eye lands on
 *     it, but it is never the only thing available.
 *
 * Deliberately NOT a state machine. The backend has no transition graph -- any
 * status can follow any status -- and inventing one here would block real
 * situations the coordinator has to record, like a job that was marked complete
 * and then turned out not to be.
 */

import type { TicketIssue } from "@/types/maintenance-tickets.types";

export type IssueActionId =
  | "status"
  | "assign"
  | "priority"
  | "relink"
  | "defer"
  | "wait"
  | "cancel"
  | "diagnosis"
  | "attendance"
  | "part"
  | "warranty"
  | "pay"
  | "attachTechs"
  | "delay"
  | "changeTechs";

export type IssueActionGroup = "progress" | "records" | "people";

export const GROUP_LABELS: Record<IssueActionGroup, string> = {
  progress: "Move it along",
  records: "Write down what happened",
  people: "Who is doing it",
};

export interface IssueAction {
  id: IssueActionId;
  group: IssueActionGroup;
  /** The button. A verb phrase, because the user is about to do something. */
  label: string;
  /** One line, under the label. What actually happens, in plain words. */
  description: string;
  /** Lucide icon name, resolved by the component so this file stays React-free. */
  icon: string;
  /** Marks the destructive/irreversible ones for the UI to treat carefully. */
  tone?: "danger";
}

/** Order matters: this is the reading order on screen. */
export const ISSUE_ACTIONS: IssueAction[] = [
  {
    id: "assign",
    group: "progress",
    label: "Book a technician",
    description: "Pick who goes and what day. Also marks the issue as assigned.",
    icon: "UserPlus",
  },
  {
    id: "status",
    group: "progress",
    label: "Change the status",
    description: "Move it between pending, assigned, in progress and complete.",
    icon: "Flag",
  },
  {
    id: "wait",
    group: "progress",
    label: "Put it on hold",
    description: "Waiting on a part, on access, or on the branch. Needs a reason.",
    icon: "PauseCircle",
  },
  {
    id: "defer",
    group: "progress",
    label: "Stop and do it later",
    description: "Closes this one and opens a fresh copy to pick up another day.",
    icon: "CalendarArrowDown",
  },
  {
    id: "cancel",
    group: "progress",
    label: "Cancel it",
    description: "It is not going to be done. Needs a reason, and cannot be undone.",
    icon: "XCircle",
    tone: "danger",
  },
  {
    id: "priority",
    group: "progress",
    label: "Set how urgent it is",
    description: "Your own priority, kept separate from the one the branch chose.",
    icon: "ArrowUpNarrowWide",
  },
  {
    id: "relink",
    group: "progress",
    label: "Change what the problem is",
    description: "Point this at a different problem from the list.",
    icon: "Replace",
  },

  {
    id: "attendance",
    group: "records",
    label: "Log hours",
    description: "Clock in and out, travel, breaks and parts runs. This is what gets paid.",
    icon: "Clock",
  },
  {
    id: "part",
    group: "records",
    label: "Record a part",
    description: "What was fitted, where it came from, and who paid for it.",
    icon: "Package",
  },
  {
    id: "diagnosis",
    group: "records",
    label: "Write what was found",
    description: "The troubleshooting notes. Photos can go here too.",
    icon: "Stethoscope",
  },
  {
    id: "warranty",
    group: "records",
    label: "Record a warranty",
    description: "What is covered and until when.",
    icon: "ShieldCheck",
  },
  {
    id: "pay",
    group: "records",
    label: "Record a one-off payment",
    description: "A fixed amount for this issue, separate from the daily pay sheet.",
    icon: "Wallet",
  },

  {
    id: "attachTechs",
    group: "people",
    label: "Add a technician",
    description: "Put someone on this issue without booking a day for them.",
    icon: "UserRoundPlus",
  },
  {
    id: "delay",
    group: "people",
    label: "Move the booking",
    description: "Change the day or time already booked. Keeps the old one on record.",
    icon: "CalendarClock",
  },
  {
    id: "changeTechs",
    group: "people",
    label: "Swap the technicians",
    description: "Replace who is booked, keeping the same day.",
    icon: "Users",
  },
];

export interface ActionAvailability {
  /** False disables the button -- it stays visible, always. */
  enabled: boolean;
  /**
   * Why not, in plain words, shown under the label in place of the description.
   * Written as the thing to DO next, not as a complaint: "Add a technician
   * first" tells them how to unblock themselves, "no technician" does not.
   */
  reason?: string;
}

const TERMINAL = new Set(["complete", "deferred", "cancelled"]);

/**
 * Only the genuinely impossible are disabled. The backend enforces exactly two
 * ordering rules -- a technician must be on the issue before their hours can be
 * filed, and a payee must be on the issue before a pay line can cover them --
 * so those are the ones that earn a disabled state. Everything else stays live,
 * because the coordinator records reality, and reality does not follow a graph.
 */
export function availability(action: IssueAction, issue: TicketIssue): ActionAvailability {
  const hasTechnician = issue.technicians.length > 0;
  const liveAssignments = issue.assignments.filter((a) => !a.mistaken);
  const isTerminal = TERMINAL.has(issue.status.value);

  switch (action.id) {
    case "attendance":
      // Enforced upstream: "The technician must be assigned to at least one of
      // the selected issues first."
      if (!hasTechnician) {
        return { enabled: false, reason: "Add a technician to this issue first" };
      }
      return { enabled: true };

    case "pay":
      if (!hasTechnician) {
        return { enabled: false, reason: "Add a technician to this issue first" };
      }
      return { enabled: true };

    case "delay":
      if (liveAssignments.length === 0) {
        return { enabled: false, reason: "Nothing is booked yet -- book a technician first" };
      }
      return { enabled: true };

    case "changeTechs":
      if (liveAssignments.length === 0) {
        return { enabled: false, reason: "Nothing is booked yet -- book a technician first" };
      }
      return { enabled: true };

    case "defer":
      if (isTerminal) {
        return { enabled: false, reason: `Already ${issue.status.label.toLowerCase()}` };
      }
      return { enabled: true };

    case "wait":
      if (isTerminal) {
        return { enabled: false, reason: `Already ${issue.status.label.toLowerCase()}` };
      }
      return { enabled: true };

    case "cancel":
      if (issue.status.value === "cancelled") {
        return { enabled: false, reason: "Already cancelled" };
      }
      return { enabled: true };

    default:
      return { enabled: true };
  }
}

/**
 * The one action to make bigger. At most one, and never the only one available.
 *
 * Reads the issue's own situation rather than its status alone, because status
 * is derived and lags reality: an issue can be "assigned" with nobody on it if
 * someone set the status by hand.
 */
export function suggestedAction(issue: TicketIssue): IssueActionId | null {
  if (TERMINAL.has(issue.status.value)) return null;

  const hasTechnician = issue.technicians.length > 0;
  const liveAssignments = issue.assignments.filter((a) => !a.mistaken);

  // Nobody on it: the job is to book someone.
  if (!hasTechnician && liveAssignments.length === 0) return "assign";

  // Booked, but nothing recorded from the visit yet: the job is to log it.
  const hasAttendance = issue.attendanceEntries.some((a) => !a.mistaken);
  if (hasTechnician && !hasAttendance) return "attendance";

  // Hours are in but it is still open: the job is to close it.
  if (hasAttendance && issue.status.value !== "complete") return "status";

  return null;
}

export function actionsByGroup(): Array<{ group: IssueActionGroup; label: string; actions: IssueAction[] }> {
  const groups: IssueActionGroup[] = ["progress", "records", "people"];
  return groups.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    actions: ISSUE_ACTIONS.filter((a) => a.group === group),
  }));
}
