/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared status colour tokens                                             */
/*                                                                          */
/*  Single source of truth so a status reads the same everywhere it appears  */
/*  (tickets table, analytics breakdown, …). Add a status here once and      */
/*  every surface picks it up.                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StatusAccent {
  /** Solid fill for the small colour dash. */
  bar: string;
  /** Foreground colour for the status label / value. */
  text: string;
}

/** The statuses (MAINTENANCE §2); the badge text always comes with it. */
export const STATUS_ACCENT: Record<string, StatusAccent> = {
  new:              { bar: "bg-sky-500",     text: "text-sky-700 dark:text-sky-400" },
  in_review:        { bar: "bg-indigo-500",  text: "text-indigo-700 dark:text-indigo-400" },
  waiting_on_store: { bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400" },
  inspection:       { bar: "bg-cyan-500",    text: "text-cyan-700 dark:text-cyan-400" },
  waiting_approval: { bar: "bg-orange-500",  text: "text-orange-700 dark:text-orange-400" },
  scheduled:        { bar: "bg-violet-500",  text: "text-violet-700 dark:text-violet-400" },
  work_done:        { bar: "bg-teal-500",    text: "text-teal-700 dark:text-teal-400" },
  closed:           { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  cancelled:        { bar: "bg-red-500",     text: "text-red-700 dark:text-red-400" },
};

export const FALLBACK_ACCENT: StatusAccent = {
  bar: "bg-muted-foreground/40",
  text: "text-foreground",
};

export function statusAccent(status: string): StatusAccent {
  return STATUS_ACCENT[status] ?? FALLBACK_ACCENT;
}
