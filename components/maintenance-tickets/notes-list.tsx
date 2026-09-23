"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date-display";
import type { TicketNote } from "@/types/maintenance-tickets.types";
import { AttachmentGallery } from "./attachment-gallery";

/** Renders a stack of note cards (type badge, author, timestamp, body, files). */
export function NotesList({
  notes,
  className,
}: {
  notes: TicketNote[];
  className?: string;
}) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      {notes.map((note) => (
        <div key={note.id} className="rounded border bg-background px-2 py-1.5 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {note.typeLabel && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                {note.typeLabel}
              </span>
            )}
            {note.creator?.name && (
              <span className="flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {note.creator.name}
              </span>
            )}
            <span>{formatTimestamp(note.createdAt)}</span>
          </div>
          {note.body && <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.body}</p>}
          <AttachmentGallery attachments={note.attachments} />
        </div>
      ))}
    </div>
  );
}
