"use client";

import { useRef } from "react";
import { Plus, Receipt, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentGallery } from "@/components/maintenance-tickets/attachment-gallery";
import { emptyNote, type NoteForm } from "@/lib/daily-pay/entry-form-state";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Repeatable note editor, used at both payment and line level               */
/*                                                                            */
/*  Existing notes (edit mode) are shown read-only, with their files, and a    */
/*  Keep checkbox. A kept note goes back to the server BY ID, so it survives   */
/*  the save as the same note -- same author, same date, files still on it.   */
/*  (It used to be re-sent by body, which duplicated it under the editor's    */
/*  name and lost its attachments.) New notes are typed here as before.       */
/* ────────────────────────────────────────────────────────────────────────── */

const LEGACY_INVOICES_TYPE = "legacy_invoices";

interface DailyPayNoteListProps {
  notes: NoteForm[];
  onChange: (notes: NoteForm[]) => void;
  disabled?: boolean;
  /** Shown when the list is empty, e.g. "Payment notes". */
  label: string;
}

export function DailyPayNoteList({
  notes,
  onChange,
  disabled,
  label,
}: DailyPayNoteListProps) {
  function patch(index: number, next: Partial<NoteForm>) {
    onChange(notes.map((n, i) => (i === index ? { ...n, ...next } : n)));
  }

  function remove(index: number) {
    onChange(notes.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {notes.map((note, i) =>
        note.existingId != null ? (
          /* ── Existing note: keep or drop, cannot be edited ─────────────── */
          <div
            key={`existing-${note.existingId}`}
            className="rounded-md border border-dashed bg-muted/40 p-2.5 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {note.type === LEGACY_INVOICES_TYPE ? (
                  <>
                    <Receipt className="h-3 w-3" />
                    Legacy invoices (migrated)
                  </>
                ) : (
                  <>
                    <StickyNote className="h-3 w-3" />
                    Existing note
                  </>
                )}
              </span>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                <Checkbox
                  checked={note.keep}
                  onCheckedChange={(checked) => patch(i, { keep: checked === true })}
                  disabled={disabled}
                />
                Keep
              </label>
            </div>
            <p className={note.keep ? "whitespace-pre-wrap text-xs" : "whitespace-pre-wrap text-xs text-muted-foreground line-through"}>
              {note.body}
            </p>
            {note.attachments.length > 0 && <AttachmentGallery attachments={note.attachments} className="mt-1" />}
            {!note.keep && (
              <p className="text-[11px] text-destructive">
                This note{note.attachments.length > 0 ? " and its files" : ""} will be removed from the entry when you save.
              </p>
            )}
          </div>
        ) : (
          <NewNoteRow
            key={`new-${i}`}
            note={note}
            onPatch={(next) => patch(i, next)}
            onRemove={() => remove(i)}
            disabled={disabled}
          />
        )
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange([...notes, emptyNote()])}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
          Add note
        </Button>
        {notes.length === 0 && (
          <Label className="text-[11px] text-muted-foreground">{label}</Label>
        )}
      </div>
    </div>
  );
}

function NewNoteRow({
  note,
  onPatch,
  onRemove,
  disabled,
}: {
  note: NoteForm;
  onPatch: (next: Partial<NoteForm>) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5" />
          New note
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <Textarea
        value={note.body}
        onChange={(e) => onPatch({ body: e.target.value })}
        placeholder="Note body…"
        disabled={disabled}
        className="min-h-16 resize-none text-sm"
      />
      <Input
        ref={inputRef}
        type="file"
        multiple
        // ADDS to what was picked before. It used to replace it, so picking a
        // second batch silently dropped the first.
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) onPatch({ files: [...note.files, ...picked] });
          // Clear the input so picking the same file again still fires.
          if (inputRef.current) inputRef.current.value = "";
        }}
        disabled={disabled}
        className="h-8 text-xs"
      />
      {note.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.files.map((f, fi) => (
            <span
              key={`${f.name}-${fi}`}
              className="inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-xs"
            >
              {f.name}
              <button
                type="button"
                className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                onClick={() => onPatch({ files: note.files.filter((_, idx) => idx !== fi) })}
                disabled={disabled}
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
