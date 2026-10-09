import type {
  Ticket,
  TicketIssue,
  TicketNote,
  TicketNoteWithOwner,
} from "@/types/maintenance-tickets.types";

/**
 * Put a ticket's notes -- from GET .../notes or .../notes/all -- onto the
 * ticket, its issues and their records, replacing the notes those came with.
 * Every note says what it sits on (`owner`), which is all this needs.
 */
export function withTicketNotes(
  ticket: Ticket,
  issues: TicketIssue[],
  notes: TicketNoteWithOwner[]
): { ticket: Ticket; issues: TicketIssue[] } {
  const byOwner = new Map<string, TicketNote[]>();
  for (const { owner, ...note } of notes) {
    if (!owner.type) continue;
    const key = `${owner.type}:${owner.id}`;
    byOwner.set(key, [...(byOwner.get(key) ?? []), note]);
  }
  const notesOf = (type: string, id: number) => byOwner.get(`${type}:${id}`) ?? [];

  const placeOnIssue = (issue: TicketIssue): TicketIssue => ({
    ...issue,
    notes: notesOf("ticket_issue", issue.id),
    assignments: issue.assignments.map((a) => ({ ...a, notes: notesOf("assignment", a.id) })),
    diagnoses: issue.diagnoses.map((d) => ({ ...d, notes: notesOf("diagnosis", d.id) })),
    attendanceEntries: issue.attendanceEntries.map((e) => ({ ...e, notes: notesOf("attendance_entry", e.id) })),
    partUsages: issue.partUsages.map((p) => ({ ...p, notes: notesOf("part_usage", p.id) })),
    payEntries: issue.payEntries.map((p) => ({ ...p, notes: notesOf("pay_entry", p.id) })),
    warranties: issue.warranties.map((w) => ({ ...w, notes: notesOf("warranty", w.id) })),
    children: issue.children.map(placeOnIssue),
  });

  return {
    ticket: { ...ticket, notes: notesOf("ticket", ticket.id) },
    issues: issues.map(placeOnIssue),
  };
}
