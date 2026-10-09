"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTR,
  ALLOWED_LABEL,
  MAX_FILES,
  fileProblem,
  formatBytes,
} from "@/lib/toolbox-tickets/uploads";

interface TicketFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Server errors keyed by index, from Laravel's `files.N`. */
  serverErrors?: Record<number, string>;
  compact?: boolean;
}

/**
 * Drag-and-drop / paste / browse picker for ticket uploads. Shows the REAL
 * allowlist (the server sniffs content, so an `accept=` filter alone is not
 * enough) and flags files that will be refused before they're sent.
 */
export function TicketFilePicker({ files, onChange, disabled, serverErrors, compact }: TicketFilePickerProps) {
  const t = useTranslations("toolboxTickets.files");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (incoming: File[]) => {
    if (!incoming.length) return;
    const next = [...files, ...incoming];
    if (next.length > MAX_FILES) {
      toast.warning(t("truncated", { max: MAX_FILES, dropped: next.length - MAX_FILES }));
    }
    onChange(next.slice(0, MAX_FILES));
  };

  const full = files.length >= MAX_FILES;

  return (
    <div className="space-y-2" data-slot="ticket-file-picker">
      <div
        role="button"
        tabIndex={disabled || full ? -1 : 0}
        aria-disabled={disabled || full}
        onClick={() => !disabled && !full && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !full) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={(e) => {
          if (disabled || full) return;
          const pasted = Array.from(e.clipboardData.files);
          if (pasted.length) {
            e.preventDefault();
            add(pasted);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !full) add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "py-3" : "py-5",
          dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
          (disabled || full) && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium">{full ? t("full", { max: MAX_FILES }) : t("drop")}</p>
        <p className="text-[11px] text-muted-foreground">
          {t("limits", { max: MAX_FILES, types: ALLOWED_LABEL })}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => {
            const problem = fileProblem(file);
            const serverError = serverErrors?.[i];
            const bad = Boolean(problem || serverError);
            return (
              <li
                key={`${file.name}-${file.size}-${i}`}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                  bad ? "border-destructive/40 bg-destructive/5" : "bg-muted/30",
                )}
              >
                {file.type.startsWith("image/") ? (
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  {bad ? (
                    <p className="text-[11px] text-destructive">
                      {serverError ?? (problem === "size" ? t("tooBig") : t("badType"))}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{formatBytes(file.size)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  disabled={disabled}
                  aria-label={t("remove")}
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Index-keyed server errors (`files.3` → 3) out of a form-error map. */
export function fileErrorsFrom(errors: Record<string, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [key, msg] of Object.entries(errors)) {
    const m = /^files\.(\d+)/.exec(key);
    if (m) out[Number(m[1])] = msg;
  }
  return out;
}

/**
 * Server `files.N` errors point at positions in the list that was SENT. Once
 * the list changes they'd land on the wrong files — drop them.
 */
export function withoutFileErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) if (!/^files(\.|$)/.test(k)) out[k] = v;
  return out;
}

/** True when any staged file will certainly be refused. */
export function hasBadFiles(files: File[]): boolean {
  return files.some((f) => fileProblem(f) !== null);
}
