"use client";

import { useRef } from "react";
import { ClipboardPaste, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Attach-or-paste file staging zone                                        */
/*                                                                            */
/*  Extracted verbatim from ticket-detail-sheet.tsx so the sheet and the      */
/*  panels pulled out of it can both use it without importing each other.    */
/* ────────────────────────────────────────────────────────────────────────── */

export function PasteFileZone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  function handlePaste(e: React.ClipboardEvent) {
    const newFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item, i) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        const ext = blob.type ? blob.type.split("/")[1] ?? "bin" : "bin";
        return new File([blob], `paste-${Date.now()}-${i}.${ext}`, { type: blob.type });
      })
      .filter((f): f is File => f !== null);
    if (newFiles.length === 0) return;
    e.preventDefault();
    onChange([...files, ...newFiles]);
  }

  function handleMouseEnter() {
    const active = document.activeElement as HTMLElement | null;
    const isInteractive =
      active && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName);
    if (!isInteractive) zoneRef.current?.focus({ preventScroll: true });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) onChange([...files, ...picked]);
    e.target.value = "";
  }

  return (
    <div
      ref={zoneRef}
      tabIndex={-1}
      onPaste={handlePaste}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "rounded-md border border-dashed bg-muted/20 outline-none transition-all",
        "hover:border-primary/50 hover:bg-primary/5",
        "focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/40"
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          {files.length > 0
            ? `${files.length} file${files.length > 1 ? "s" : ""} staged`
            : "Attach files…"}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
          <ClipboardPaste className="h-3 w-3" /> Paste
        </span>
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
      {files.length > 0 && (
        <ul className="px-3 pb-2 space-y-0.5">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-0.5 text-[11px]"
            >
              <span className="truncate max-w-[200px]">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
