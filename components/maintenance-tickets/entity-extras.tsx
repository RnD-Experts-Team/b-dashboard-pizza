"use client";

import { useState, useRef } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquarePlus, Paperclip, Plus, ClipboardPaste } from "lucide-react";
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
 *
 * Supports Ctrl+V paste-to-attach: when the component is focused/hovered and
 * the user pastes a file (e.g. a screenshot), it is pre-filled into the
 * attachment form and the form opens automatically.
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
  /** Files staged for upload — accumulates across multiple pastes and file-input picks */
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = notes.length + attachments.length;

  function handlePaste(e: React.ClipboardEvent) {
    if (!canAdd) return;
    const items = Array.from(e.clipboardData.items);
    const newFiles = items
      .filter((item) => item.kind === "file")
      .map((item, i) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        const ext = blob.type ? blob.type.split("/")[1] ?? "bin" : "bin";
        // Use index suffix so simultaneous pastes don't collide on name
        return new File([blob], `paste-${Date.now()}-${i}.${ext}`, { type: blob.type });
      })
      .filter((f): f is File => f !== null);

    if (newFiles.length === 0) return;
    e.preventDefault();
    // ACCUMULATE — don't replace existing staged files
    setStagedFiles((prev) => [...prev, ...newFiles]);
    setOpen(true);
    setMode("attachment");
  }

  function handleMouseEnter() {
    if (!canAdd) return;
    const active = document.activeElement as HTMLElement | null;
    // Only steal focus if no interactive element is already focused
    const isInteractive = active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.tagName === "BUTTON" ||
      active.isContentEditable
    );
    if (!isInteractive) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onPaste={handlePaste}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "rounded-md border border-dashed bg-muted/10 outline-none",
        "focus-within:ring-1 focus-within:ring-primary/30 focus-within:ring-dashed transition-shadow",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title={canAdd ? "Ctrl+V to paste an attachment" : undefined}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <MessageSquarePlus className="h-3 w-3" />
        <span>Notes &amp; files</span>
        {total > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium">{total}</span>
        )}
        {canAdd && (
          <span className="ms-auto text-[9px] text-muted-foreground/50 flex items-center gap-0.5">
            <ClipboardPaste className="h-2.5 w-2.5" />
            Paste
          </span>
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
              files={stagedFiles}
              onFilesChange={setStagedFiles}
              onClose={() => { setMode(null); setStagedFiles([]); }}
              onCreated={(atts) => { onAttachmentsAdded?.(atts); setMode(null); setStagedFiles([]); onSuccess(); }}
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
  files,
  onFilesChange,
  onClose,
  onCreated,
}: {
  entityPath: string;
  /** Controlled list of files staged for upload — lives in parent so pastes accumulate */
  files: File[];
  onFilesChange: (files: File[]) => void;
  onClose: () => void;
  onCreated: (attachments: TicketAttachment[]) => void;
}) {
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

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    // APPEND — don't overwrite pasted files already staged
    onFilesChange([...files, ...picked]);
    // Reset the input so the same file can be picked again if needed
    e.target.value = "";
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      {/* Staged files list */}
      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {files.length} file{files.length > 1 ? "s" : ""} queued
          </p>
          <ul className="space-y-0.5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-0.5 text-[11px]">
                <span className="truncate max-w-[200px]">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* File picker — APPENDS to queue */}
      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <Paperclip className="h-3 w-3 shrink-0" />
        <span>Add more files…</span>
        <Input
          type="file"
          multiple
          className="sr-only"
          onChange={handleFileInputChange}
        />
      </label>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleSubmit} disabled={isSubmitting || files.length === 0}>
          {isSubmitting && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
          <Plus className="me-1 h-3 w-3" />
          Upload {files.length > 0 ? `(${files.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
