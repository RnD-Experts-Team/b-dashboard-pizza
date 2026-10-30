import type { Ticket, TicketNote, TicketNoteWithOwner } from "@/types/maintenance-tickets.types";
import type { TicketIssueV2 } from "@/types/maintenance-v2";

/**
 * Put a ticket's notes — from GET .../notes or .../notes/all (the "all" read
 * includes MOS-only locked notes) — onto the ticket, its issues and their
 * inspections, replacing the notes those came with. Every note says what it
 * sits on (`owner`), which is all this needs.
 */
export function withTicketNotes(
  ticket: Ticket,
  issues: TicketIssueV2[],
  notes: TicketNoteWithOwner[],
): { ticket: Ticket; issues: TicketIssueV2[] } {
  const byOwner = notes.reduce<Map<string, TicketNote[]>>((acc, { owner, ...note }) => {
    if (!owner.type) return acc;
    const key = `${owner.type}:${owner.id}`;
    acc.set(key, [...(acc.get(key) ?? []), note]);
    return acc;
  }, new Map());
  const notesOf = (type: string, id: number) => byOwner.get(`${type}:${id}`) ?? [];

  const placeOnIssue = (issue: TicketIssueV2): TicketIssueV2 => ({
    ...issue,
    notes: notesOf("ticket_issue", issue.id),
    inspections: issue.inspections.map((i) => ({ ...i, notes: notesOf("issue_inspection", i.id) })),
  });

  return {
    ticket: { ...ticket, notes: notesOf("ticket", ticket.id) },
    issues: issues.map(placeOnIssue),
  };
}
