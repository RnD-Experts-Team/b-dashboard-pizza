"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquarePlus, Paperclip, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { TicketNote, TicketAttachment } from "@/types/maintenance-tickets.types";
import { NotesList } from "./notes-list";
import { AttachmentGallery } from "./attachment-gallery";

interface EntityNotesAttachmentsProps {
  /** Relative entity path from `entityPaths.*` (no /notes or /attachments suffix). */
  entityPath: string;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
  /** Called after a successful note/attachment create so the parent can reload. */
  onSuccess: () => void;
  /** Optional: receive the created note (e.g. to update local state without a refetch). */
  onNoteAdded?: (note: TicketNote) => void;
  /** Optional: receive created attachments (e.g. to update local state without a refetch). */
  onAttachmentsAdded?: (attachments: TicketAttachment[]) => void;
  /** Allow typing a free-form note `type` tag (hidden by default). */
  allowNoteType?: boolean;
  /** When false, hides the "Add Note" and "Add File" buttons. Defaults to true. */
  canAdd?: boolean;
  className?: string;
}

/**
 * A compact expandable "Notes (n) · Files (n)" block usable on any entity.
 * Lists existing notes + attachments and provides inline add forms backed by
 * the generic `addNote` / `addAttachments` service methods.
 */
export function EntityNotesAttachments({
  entityPath,
  notes = [],
  attachments = [],
  onSuccess,
  onNoteAdded,
  onAttachmentsAdded,
  allowNoteType = false,
  canAdd = true,
  className,
}: EntityNotesAttachmentsProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | "note" | "attachment">(null);
  const total = notes.length + attachments.length;

  return (
    <div className={cn("rounded-md border border-dashed bg-muted/10", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <MessageSquarePlus className="h-3 w-3" />
        <span>Notes & files</span>
        {total > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium">{total}</span>
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-2">
          <NotesList notes={notes} />
          {attachments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Files</p>
              <AttachmentGallery attachments={attachments} className="mt-0" />
            </div>
          )}

          {mode === null && canAdd && (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setMode("note")}>
                <MessageSquarePlus className="me-1 h-3 w-3" /> Add Note
              </Button>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setMode("attachment")}>
                <Paperclip className="me-1 h-3 w-3" /> Add File
              </Button>
            </div>
          )}

          {mode === "note" && (
            <AddNoteForm
              entityPath={entityPath}
              allowNoteType={allowNoteType}
              onClose={() => setMode(null)}
              onCreated={(note) => { onNoteAdded?.(note); setMode(null); onSuccess(); }}
            />
          )}
          {mode === "attachment" && (
            <AddAttachmentForm
              entityPath={entityPath}
              onClose={() => setMode(null)}
              onCreated={(atts) => { onAttachmentsAdded?.(atts); setMode(null); onSuccess(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AddNoteForm({
  entityPath,
  allowNoteType,
  onClose,
  onCreated,
}: {
  entityPath: string;
  allowNoteType: boolean;
  onClose: () => void;
  onCreated: (note: TicketNote) => void;
}) {
  const [body, setBody] = useState("");
  const [type, setType] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!body.trim()) { setError("Note text is required."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const note = await maintenanceTicketsService.addNote(
        entityPath,
        { body: body.trim(), ...(allowNoteType && type.trim() ? { type: type.trim() } : {}) },
        files,
      );
      onCreated(note);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to add note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      <Textarea
        className="text-sm resize-none min-h-16"
        placeholder="Write a note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {allowNoteType && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Tag (optional)</Label>
          <Input className="h-7 text-xs" placeholder="e.g. vendor" value={type} onChange={(e) => setType(e.target.value)} />
        </div>
      )}
      <Input type="file" multiple className="h-7 text-xs" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleSubmit} disabled={isSubmitting || !body.trim()}>
          {isSubmitting && <Loader2 className="me-1 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function AddAttachmentForm({
  entityPath,
  onClose,
  onCreated,
}: {
  entityPath: string;
  onClose: () => void;
  onCreated: (attachments: TicketAttachment[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (files.length === 0) { setError("Select at least one file."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await maintenanceTicketsService.addAttachments(entityPath, files);
      onCreated(created);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to upload files.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      <Input type="file" multiple className="h-7 text-xs" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleSubmit} disabled={isSubmitting || files.length === 0}>
          {isSubmitting && <Loader2 className="me-1 h-3 w-3 animate-spin" />}<Plus className="me-1 h-3 w-3" />Upload
        </Button>
      </div>
    </div>
  );
}
