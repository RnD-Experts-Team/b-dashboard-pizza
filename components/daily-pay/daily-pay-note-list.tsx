"use client";

import { Plus, Receipt, StickyNote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyNote, type NoteForm } from "@/lib/daily-pay/entry-form-state";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Repeatable note editor, used at both payment and line level               */
/*                                                                            */
/*  OPEN QUESTION WITH THE BACKEND — the /edit endpoint replaces the whole    */
/*  entry and accepts only NEW notes, with no way to reference existing ones. */
/*  So a prefilled note can only survive by being re-sent by body, which      */
/*  duplicates it under the editing user's name and loses its attachments.    */
/*                                                                            */
/*  Rather than pick silently, prefilled notes are shown read-only with an    */
/*  explicit keep/remove checkbox and a warning about the attachments. Once    */
/*  /edit accepts existing note ids, this whole block collapses to a list.    */
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
            <p className="whitespace-pre-wrap text-xs">{note.body}</p>
            {!note.keep && (
              <p className="text-[11px] text-destructive">
                This note will be removed from the entry when you save.
              </p>
            )}
          </div>
        ) : (
          /* ── New note ──────────────────────────────────────────────────── */
          <div key={`new-${i}`} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
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
                onClick={() => remove(i)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={note.body}
              onChange={(e) => patch(i, { body: e.target.value })}
              placeholder="Note body…"
              disabled={disabled}
              className="min-h-16 resize-none text-sm"
            />
            <Input
              type="file"
              multiple
              onChange={(e) => patch(i, { files: Array.from(e.target.files ?? []) })}
              disabled={disabled}
              className="h-8 text-xs"
            />
            {note.files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.files.map((f, fi) => (
                  <Badge key={fi} variant="secondary" className="font-normal">
                    {f.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {notes.some((n) => n.existingId != null && n.keep) && (
        <p className="text-[11px] text-muted-foreground">
          Kept notes are re-saved as new notes — their existing file attachments cannot be
          carried over.
        </p>
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
