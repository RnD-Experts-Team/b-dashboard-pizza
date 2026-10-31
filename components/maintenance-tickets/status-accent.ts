/* ────────────────────────────────────────────────────────────────────────── */
/*  Ticket status and priority colours: the ONE source of truth             */
/*                                                                          */
/*  Every place a ticket is shown (tickets list, ticket page, peek sheet,    */
/*  Dashboard V1 card, DSPR table, analytics, history panels) reads its      */
/*  colours from here, through `StatusBadge` / `PriorityBadge` in            */
/*  ticket-chips.tsx. Change a hue here once and every surface follows.      */
/*                                                                          */
/*  Rules (docs/MAINTENANCE-UI.md, UX rules 7 and 10):                       */
/*  - never colour alone: a badge always carries its word (and priority an   */
/*    arrow icon);                                                           */
/*  - paired light/dark Tailwind classes, written out in full so Tailwind    */
/*    can see them (no string building);                                     */
/*  - statuses are tinted fills, priorities are outlined, so the two never   */
/*    read as the same kind of thing when they sit side by side.             */
/* ────────────────────────────────────────────────────────────────────────── */

import type { IssueStatus, Priority } from "@/types/maintenance-tickets.types";

export interface StatusAccent {
  /** Solid colour for the small dot / dash. */
  bar: string;
  /** Foreground colour for the label / value on a plain surface. */
  text: string;
  /** Tinted fill + text for the badge. */
  pill: string;
  /** Hairline border in the same hue (row accents, cards). */
  border: string;
}

/**
 * One hue per step of the flow (MAINTENANCE §2), chosen so neighbours differ:
 * - new — sky: just arrived;
 * - in_review — indigo: the office is on it;
 * - waiting_on_store — amber: someone else has to answer;
 * - inspection — cyan: a technician is looking;
 * - waiting_approval — fuchsia: money waiting on a decision (kept away from
 *   the orange/red of priorities);
 * - scheduled — violet: booked;
 * - work_done — lime: fixed, being checked (kept clear of the cyan
 *   inspection and the emerald closed beside it);
 * - closed — emerald: finished;
 * - cancelled — neutral grey: nothing more will happen.
 */
export const STATUS_ACCENT: Record<IssueStatus, StatusAccent> = {
  new: {
    bar: "bg-sky-500 dark:bg-sky-400",
    text: "text-sky-700 dark:text-sky-300",
    pill: "bg-sky-500/15 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
    border: "border-sky-500/30 dark:border-sky-400/30",
  },
  in_review: {
    bar: "bg-indigo-500 dark:bg-indigo-400",
    text: "text-indigo-700 dark:text-indigo-300",
    pill: "bg-indigo-500/15 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
    border: "border-indigo-500/30 dark:border-indigo-400/30",
  },
  waiting_on_store: {
    bar: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    pill: "bg-amber-500/15 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
    border: "border-amber-500/35 dark:border-amber-400/30",
  },
  inspection: {
    bar: "bg-cyan-500 dark:bg-cyan-400",
    text: "text-cyan-700 dark:text-cyan-300",
    pill: "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-200",
    border: "border-cyan-500/30 dark:border-cyan-400/30",
  },
  waiting_approval: {
    bar: "bg-fuchsia-500 dark:bg-fuchsia-400",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    pill: "bg-fuchsia-500/15 text-fuchsia-800 dark:bg-fuchsia-400/15 dark:text-fuchsia-200",
    border: "border-fuchsia-500/30 dark:border-fuchsia-400/30",
  },
  scheduled: {
    bar: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-700 dark:text-violet-300",
    pill: "bg-violet-500/15 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
    border: "border-violet-500/30 dark:border-violet-400/30",
  },
  work_done: {
    bar: "bg-lime-500 dark:bg-lime-400",
    text: "text-lime-700 dark:text-lime-300",
    pill: "bg-lime-500/15 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200",
    border: "border-lime-500/35 dark:border-lime-400/30",
  },
  closed: {
    bar: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    pill: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
    border: "border-emerald-500/30 dark:border-emerald-400/30",
  },
  cancelled: {
    bar: "bg-zinc-400 dark:bg-zinc-500",
    text: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground",
    border: "border-border",
  },
};

/** Status words older rows can still carry, mapped to the step they meant (colour only; the server's label is kept). */
const LEGACY_STATUS: Record<string, IssueStatus> = {
  open: "new",
  pending: "new",
  assigned: "scheduled",
  in_progress: "scheduled",
  waiting: "waiting_on_store",
  deferred: "waiting_approval",
  complete: "closed",
  completed: "closed",
};

export const FALLBACK_ACCENT: StatusAccent = {
  bar: "bg-muted-foreground/50",
  text: "text-foreground",
  pill: "bg-muted text-foreground",
  border: "border-border",
};

/** The step a status value belongs to, or null when it is not one we know. */
export function knownStatus(status: string | null | undefined): IssueStatus | null {
  if (!status) return null;
  if (status in STATUS_ACCENT) return status as IssueStatus;
  return LEGACY_STATUS[status] ?? null;
}

export function statusAccent(status: string | null | undefined): StatusAccent {
  const known = knownStatus(status);
  return known ? STATUS_ACCENT[known] : FALLBACK_ACCENT;
}

/* ── Priorities ──────────────────────────────────────────────────────────── */

/**
 * urgent = the store cannot operate; high = affects operations; medium = a
 * normal repair; low = cosmetic. Outlined so they never look like a status;
 * only urgent gets a fill, because it is the one that must shout.
 */
export const PRIORITY_ACCENT: Record<Priority, StatusAccent> = {
  urgent: {
    bar: "bg-red-500 dark:bg-red-400",
    text: "text-red-700 dark:text-red-300",
    pill: "border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300",
    border: "border-red-500/40 dark:border-red-400/40",
  },
  high: {
    bar: "bg-orange-500 dark:bg-orange-400",
    text: "text-orange-700 dark:text-orange-300",
    pill: "border-orange-500/40 bg-card text-orange-700 dark:border-orange-400/40 dark:text-orange-300",
    border: "border-orange-500/40 dark:border-orange-400/40",
  },
  medium: {
    bar: "bg-yellow-500 dark:bg-yellow-400",
    text: "text-yellow-800 dark:text-yellow-300",
    pill: "border-yellow-500/45 bg-card text-yellow-800 dark:border-yellow-400/40 dark:text-yellow-300",
    border: "border-yellow-500/45 dark:border-yellow-400/40",
  },
  low: {
    bar: "bg-slate-400 dark:bg-slate-500",
    text: "text-muted-foreground",
    pill: "border-border bg-card text-muted-foreground",
    border: "border-border",
  },
};

export const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const satisfies readonly Priority[];

export function knownPriority(priority: string | null | undefined): Priority | null {
  return priority && priority in PRIORITY_ACCENT ? (priority as Priority) : null;
}

export function priorityAccent(priority: string | null | undefined): StatusAccent {
  const known = knownPriority(priority);
  return known ? PRIORITY_ACCENT[known] : FALLBACK_ACCENT;
}

/** The most severe priority among a ticket's issues (urgent first), or null. */
export function topPriority<P extends { value: string; label: string }>(issues: readonly { priority: P | null }[]): P | null {
  const rank = (v: string) => {
    const i = PRIORITY_ORDER.indexOf(v as Priority);
    return i === -1 ? PRIORITY_ORDER.length : i;
  };
  return issues.reduce<P | null>((best, i) => {
    if (!i.priority) return best;
    return !best || rank(i.priority.value) < rank(best.value) ? i.priority : best;
  }, null);
}
