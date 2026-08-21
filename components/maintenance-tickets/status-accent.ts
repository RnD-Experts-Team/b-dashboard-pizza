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

export const STATUS_ACCENT: Record<string, StatusAccent> = {
  pending:     { bar: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400" },
  assigned:    { bar: "bg-blue-500",   text: "text-blue-700 dark:text-blue-400" },
  in_progress: { bar: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400" },
  waiting:     { bar: "bg-purple-500", text: "text-purple-700 dark:text-purple-400" },
  complete:    { bar: "bg-green-500",  text: "text-green-700 dark:text-green-400" },
  deferred:    { bar: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" },
  cancelled:   { bar: "bg-red-500",    text: "text-red-700 dark:text-red-400" },
};

export const FALLBACK_ACCENT: StatusAccent = {
  bar: "bg-muted-foreground/40",
  text: "text-foreground",
};

export function statusAccent(status: string): StatusAccent {
  return STATUS_ACCENT[status] ?? FALLBACK_ACCENT;
}
