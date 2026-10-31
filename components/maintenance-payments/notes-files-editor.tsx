"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, FileText, MessageSquare, Paperclip, Plus, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/utils/date-display";
import {
  addFiles,
  addNote,
  dropFile,
  dropNote,
  extrasCount,
  setNote,
  toggleSavedFile,
  toggleSavedNote,
  type ExtrasDraft,
} from "@/lib/maintenance-payments/extras";
import { fieldId } from "./field";

/**
 * Attachments and notes, as many as wanted (docs/MAINTENANCE-UI.md §5):
 * files picked or pasted show as chips that can be taken off before saving;
 * notes are added one box at a time. When editing, the saved ones show
 * first — taking one off strikes it through with an Undo until Save.
 *
 * `errorPrefix` is the 422 path the errors hang off: "" for the payment
 * (`files`, `notes`, `remove_note_ids`…), "lines.0." for a line.
 */
export function NotesFilesEditor({
  value,
  onChange,
  errors,
  errorPrefix,
  scope,
}: {
  value: ExtrasDraft;
  onChange: (next: ExtrasDraft) => void;
  errors: Record<string, string>;
  errorPrefix: string;
  scope: "payment" | "line";
}) {
  const t = useTranslations("maintenanceSystem.payments.extras");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusLast, setFocusLast] = useState(false);
  /** Remounts the file input after each pick, so the same file can be picked again. */
  const [inputKey, setInputKey] = useState(0);

  const err = (...fields: string[]) => fields.map((f) => errors[`${errorPrefix}${f}`]).find(Boolean);
  const filesError = err("files", "keep_attachment_ids", "remove_attachment_ids");
  const notesError = err("notes", "keep_note_ids", "remove_note_ids");
  const filesId = fieldId(`${errorPrefix}files`);
  const notesId = fieldId(`${errorPrefix}notes`);

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (!pasted.length) return;
    e.preventDefault();
    onChange(addFiles(value, pasted));
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Attachments */}
      <div className="min-w-0 space-y-1.5 outline-none" tabIndex={-1} onPaste={onPaste}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {t("attachments")}
          </p>
          <Button
            id={filesId}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t("addFiles")}
          </Button>
          <input
            key={inputKey}
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              onChange(addFiles(value, Array.from(e.target.files ?? [])));
              setInputKey((k) => k + 1);
            }}
          />
        </div>
        {value.savedFiles.length + value.files.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          >
            <Paperclip className="size-3.5" aria-hidden="true" />
            {scope === "payment" ? t("filesEmpty") : t("lineFilesEmpty")}
          </button>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {value.savedFiles.map((f) => {
              const removed = value.removedFileIds.includes(f.id);
              return (
                <FileChip
                  key={`saved-${f.id}`}
                  name={f.fileName}
                  href={removed ? undefined : f.url}
                  removed={removed}
                  onToggle={() => onChange(toggleSavedFile(value, f.id))}
                />
              );
            })}
            {value.files.map((f, i) => (
              <FileChip key={`new-${f.name}-${i}`} name={f.name} isNew onToggle={() => onChange(dropFile(value, i))} />
            ))}
          </ul>
        )}
        {filesError ? (
          <p role="alert" className="text-[11px] text-destructive">
            {filesError}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">{t("filesHelp")}</p>
        )}
      </div>

      {/* Notes */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {t("notes")}
          </p>
          <Button
            id={notesId}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              setFocusLast(true);
              onChange(addNote(value));
            }}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t("addNote")}
          </Button>
        </div>
        {value.savedNotes.length + value.notes.length === 0 && (
          <button
            type="button"
            onClick={() => {
              setFocusLast(true);
              onChange(addNote(value));
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          >
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {scope === "payment" ? t("notesEmpty") : t("lineNotesEmpty")}
          </button>
        )}
        <ul className="space-y-1.5">
          {value.savedNotes.map((n) => {
            const removed = value.removedNoteIds.includes(n.id);
            const who = n.creator?.name;
            return (
              <li
                key={`saved-${n.id}`}
                className={cn("flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5", removed && "opacity-60")}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("whitespace-pre-wrap break-words text-xs", removed && "line-through")}>{n.body}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {removed ? t("removedOnSave") : [who, formatTimestamp(n.createdAt, "MMM d, yyyy")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground"
                  onClick={() => onChange(toggleSavedNote(value, n.id))}
                  aria-label={removed ? t("undoRemove") : t("removeNote")}
                  title={removed ? t("undoRemove") : t("removeNote")}
                >
                  {removed ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
                </Button>
              </li>
            );
          })}
          {value.notes.map((body, i) => (
            <li key={`new-${i}`} className="flex items-start gap-1.5">
              <Textarea
                value={body}
                rows={2}
                autoFocus={focusLast && i === value.notes.length - 1}
                onFocus={() => setFocusLast(false)}
                onChange={(e) => onChange(setNote(value, i, e.target.value))}
                placeholder={t("notePlaceholder")}
                aria-label={t("noteNumber", { number: i + 1 })}
                className="min-h-14 flex-1 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(dropNote(value, i))}
                aria-label={t("removeNote")}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        {notesError && (
          <p role="alert" className="text-[11px] text-destructive">
            {notesError}
          </p>
        )}
      </div>
    </div>
  );
}

function FileChip({
  name,
  href,
  isNew,
  removed,
  onToggle,
}: {
  name: string;
  href?: string;
  isNew?: boolean;
  removed?: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("maintenanceSystem.payments.extras");
  const label = (
    <>
      <FileText className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className={cn("max-w-44 truncate", removed && "line-through")}>{name}</span>
    </>
  );
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 ps-2 pe-0.5 text-xs",
        removed && "opacity-60",
      )}
    >
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:underline">
          {label}
        </a>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1">{label}</span>
      )}
      {isNew && (
        <Badge variant="outline" className="px-1 py-0 text-[9px] font-semibold uppercase tracking-wider">
          {t("new")}
        </Badge>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={removed ? t("undoRemove") : t("removeFile", { name })}
        title={removed ? t("undoRemove") : t("removeFile", { name })}
        className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {removed ? <Undo2 className="size-3" /> : <X className="size-3" />}
      </button>
    </li>
  );
}

/**
 * Under a line card: a single "Notes & attachments" row, collapsed by
 * default, with a small count badge when the line has any.
 */
export function LineNotesFiles({
  value,
  onChange,
  errors,
  index,
}: {
  value: ExtrasDraft;
  onChange: (next: ExtrasDraft) => void;
  errors: Record<string, string>;
  index: number;
}) {
  const t = useTranslations("maintenanceSystem.payments.extras");
  const prefix = `lines.${index}.`;
  const hasError = ["files", "notes", "keep_note_ids", "keep_attachment_ids"].some((f) => errors[`${prefix}${f}`]);
  const [open, setOpen] = useState(hasError);
  const count = extrasCount(value);
  const isOpen = open || hasError;
  const panelId = `pay-line-${index}-extras`;

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {isOpen ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
        <span className="font-medium">{t("lineToggle")}</span>
        {count.files > 0 && (
          <Badge variant="secondary" className="gap-0.5 px-1.5 py-0 text-[10px] tabular-nums">
            <Paperclip className="size-2.5" aria-hidden="true" />
            {count.files}
            <span className="sr-only">{t("filesCount", { count: count.files })}</span>
          </Badge>
        )}
        {count.notes > 0 && (
          <Badge variant="secondary" className="gap-0.5 px-1.5 py-0 text-[10px] tabular-nums">
            <MessageSquare className="size-2.5" aria-hidden="true" />
            {count.notes}
            <span className="sr-only">{t("notesCount", { count: count.notes })}</span>
          </Badge>
        )}
      </button>
      {isOpen && (
        <div id={panelId} className="mt-2">
          <NotesFilesEditor value={value} onChange={onChange} errors={errors} errorPrefix={prefix} scope="line" />
        </div>
      )}
    </div>
  );
}
