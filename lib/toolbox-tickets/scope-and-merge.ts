import type { TicketAssignment, ToolboxTicket } from "@/types/toolbox-tickets.types";

/**
 * "Most permissive wins": one person can match through several assignment
 * rows, and if ANY active row is unscoped they receive across every store.
 * Returns user id → effective store_scoped (true = only stores they hold).
 */
export function effectiveScopeByUser(rows: TicketAssignment[]): Map<number, boolean> {
  const out = new Map<number, boolean>();
  for (const row of rows) {
    if (!row.user || !row.active) continue;
    const prev = out.get(row.user.id);
    out.set(row.user.id, (prev ?? true) && row.storeScoped);
  }
  return out;
}

/**
 * Merge a partial ticket payload (update / status / reopen responses, or a
 * future realtime event) into what's on screen. Never replace: those payloads
 * omit the thread relations, and a realtime one omits `viewer` entirely —
 * replacing would wipe the thread or hand everyone the wrong buttons.
 */
export function mergeTicket(prev: ToolboxTicket | null, next: ToolboxTicket): ToolboxTicket {
  if (!prev) return next;
  return {
    ...prev,
    ...next,
    viewer: next.viewer ?? prev.viewer,
    responses: next.responses ?? prev.responses,
    notes: next.notes ?? prev.notes,
    attachments: next.attachments ?? prev.attachments,
    statusChanges: next.statusChanges ?? prev.statusChanges,
    participants: next.participants.length ? next.participants : prev.participants,
  };
}
