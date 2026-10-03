import { CheckCircle2, CircleDot, Clock, Lock, type LucideIcon } from "lucide-react";
import type { TicketStatus } from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status presentation. The server owns the rules (`allowed_transitions`);  */
/*  this file only decides how a status LOOKS.                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface StatusVisual {
  icon: LucideIcon;
  badge: string;
  dot: string;
}

export const STATUS_VISUALS: Record<TicketStatus, StatusVisual> = {
  pending: {
    icon: Clock,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  in_progress: {
    icon: CircleDot,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  fixed: {
    icon: CheckCircle2,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  closed: {
    icon: Lock,
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export function statusVisual(status: string): StatusVisual {
  return STATUS_VISUALS[status as TicketStatus] ?? STATUS_VISUALS.pending;
}

const TERMINAL: ReadonlySet<string> = new Set(["fixed", "closed"]);

/** A reopen is any terminal → pending edge (and it needs a reason). */
export function isReopenEdge(from: string, to: string): boolean {
  return TERMINAL.has(from) && to === "pending";
}
