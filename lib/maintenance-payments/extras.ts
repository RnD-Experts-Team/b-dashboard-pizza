/* ────────────────────────────────────────────────────────────────────────── */
/*  Notes and attachments in the payment dialog (docs/MAINTENANCE-UI.md §5) */
/*                                                                            */
/*  The payment and every line carry as many notes and files as wanted.     */
/*  One shape serves both: what was typed / picked in this dialog, plus —    */
/*  when editing — the saved ones still kept and the ids taken off.          */
/*                                                                            */
/*  On the wire (MaintenancePizza docs/MAINTENANCE.md §4):                  */
/*   - payment: `notes[]`, `files[]`; on edit `remove_note_ids[]` /          */
/*     `remove_attachment_ids[]` for the saved ones taken off.              */
/*   - line: `lines[i][notes][]`, `lines[i][files][]`; on edit the saved     */
/*     ones it keeps go as `lines[i][keep_note_ids][]` /                     */
/*     `lines[i][keep_attachment_ids][]` (the edit replaces the lines, so a  */
/*     line note nobody keeps is removed).                                   */
/* ────────────────────────────────────────────────────────────────────────── */

import type { TicketAttachment, TicketNote } from "@/types/maintenance-system";

export interface ExtrasDraft {
  /** Notes typed in this dialog (blank ones are dropped on save). */
  notes: string[];
  /** Files picked in this dialog. */
  files: File[];
  /** Saved notes and files (edit), as loaded — removed ones included, so a removal can be undone. */
  savedNotes: TicketNote[];
  savedFiles: TicketAttachment[];
  /** The saved notes / files taken off in this dialog. */
  removedNoteIds: number[];
  removedFileIds: number[];
}

export function emptyExtras(): ExtrasDraft {
  return { notes: [], files: [], savedNotes: [], savedFiles: [], removedNoteIds: [], removedFileIds: [] };
}

/** What a saved payment or line already carries, read back for Edit. */
export function extrasFromSaved(notes: readonly TicketNote[] | null | undefined, files: readonly TicketAttachment[] | null | undefined): ExtrasDraft {
  return { ...emptyExtras(), savedNotes: [...(notes ?? [])], savedFiles: [...(files ?? [])] };
}

export function addNote(x: ExtrasDraft): ExtrasDraft {
  return { ...x, notes: [...x.notes, ""] };
}

export function setNote(x: ExtrasDraft, index: number, body: string): ExtrasDraft {
  return { ...x, notes: x.notes.map((n, i) => (i === index ? body : n)) };
}

export function dropNote(x: ExtrasDraft, index: number): ExtrasDraft {
  return { ...x, notes: x.notes.filter((_, i) => i !== index) };
}

export function addFiles(x: ExtrasDraft, files: readonly File[]): ExtrasDraft {
  return files.length ? { ...x, files: [...x.files, ...files] } : x;
}

export function dropFile(x: ExtrasDraft, index: number): ExtrasDraft {
  return { ...x, files: x.files.filter((_, i) => i !== index) };
}

const toggle = (ids: readonly number[], id: number) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** Take a saved note off, or put it back (Undo). */
export function toggleSavedNote(x: ExtrasDraft, id: number): ExtrasDraft {
  return { ...x, removedNoteIds: toggle(x.removedNoteIds, id) };
}

/** Take a saved file off, or put it back (Undo). */
export function toggleSavedFile(x: ExtrasDraft, id: number): ExtrasDraft {
  return { ...x, removedFileIds: toggle(x.removedFileIds, id) };
}

export function keptNotes(x: ExtrasDraft): TicketNote[] {
  return x.savedNotes.filter((n) => !x.removedNoteIds.includes(n.id));
}

export function keptFiles(x: ExtrasDraft): TicketAttachment[] {
  return x.savedFiles.filter((f) => !x.removedFileIds.includes(f.id));
}

/** The typed notes worth sending. */
export function noteBodies(x: ExtrasDraft): string[] {
  return x.notes.map((n) => n.trim()).filter(Boolean);
}

/** For the small count badges: notes + files (typed or saved). */
export function extrasCount(x: ExtrasDraft): { notes: number; files: number } {
  return { notes: keptNotes(x).length + noteBodies(x).length, files: keptFiles(x).length + x.files.length };
}

const orUndefined = <T,>(xs: T[]): T[] | undefined => (xs.length ? xs : undefined);

/** The payment's part of the body. Removal is sent only on edit. */
export function paymentExtrasInput(x: ExtrasDraft, editing: boolean) {
  return {
    notes: orUndefined(noteBodies(x)),
    files: orUndefined(x.files),
    removeNoteIds: editing ? orUndefined(x.removedNoteIds) : undefined,
    removeAttachmentIds: editing ? orUndefined(x.removedFileIds) : undefined,
  };
}

/** A line's part of the body. What it keeps is sent only on edit. */
export function lineExtrasInput(x: ExtrasDraft, editing: boolean) {
  return {
    notes: orUndefined(noteBodies(x)),
    files: orUndefined(x.files),
    keepNoteIds: editing ? orUndefined(keptNotes(x).map((n) => n.id)) : undefined,
    keepAttachmentIds: editing ? orUndefined(keptFiles(x).map((f) => f.id)) : undefined,
  };
}
