"use client";

import { useState } from "react";
import { Loader2, Lock, LockOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date-display";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { TicketNote } from "@/types/maintenance-tickets.types";
import { AttachmentGallery } from "./attachment-gallery";

/**
 * Who may lock notes, and where. Only ticket-side notes can be private, so this
 * is only ever passed on the ticket page.
 */
export interface NotePrivacy {
  /** Holds the private-notes permission at this ticket's store. */
  canLock: boolean;
  storeNumber: string;
  ticketId: number;
  /** Reload after a lock or unlock, so every list shows the change. */
  onChanged: () => void;
}

/** Renders a stack of note cards (type badge, author, timestamp, body, files). */
export function NotesList({
  notes,
  privacy,
  className,
}: {
  notes: TicketNote[];
  privacy?: NotePrivacy;
  className?: string;
}) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      {notes.map((note) => (
        <div
          key={note.id}
          className={cn(
            "rounded border px-2 py-1.5 space-y-1",
            note.isPrivate ? "border-dashed border-amber-500/50 bg-amber-500/5 dark:border-amber-400/40" : "bg-background",
          )}
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {note.isPrivate && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                title={note.locker ? `Locked by ${note.locker.name}` : undefined}
              >
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                Private · MOS only
              </span>
            )}
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
            {privacy?.canLock && <LockToggle note={note} privacy={privacy} />}
          </div>
          {note.body && <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.body}</p>}
          <AttachmentGallery attachments={note.attachments} />
        </div>
      ))}
    </div>
  );
}

/**
 * Lock a note so only the MOS sees it, or unlock it for everyone. Changing a
 * note's audience is logged on the ticket.
 */
function LockToggle({ note, privacy }: { note: TicketNote; privacy: NotePrivacy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = note.isPrivate ? LockOpen : Lock;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await maintenanceTicketsService.setNotePrivacy(privacy.storeNumber, privacy.ticketId, note.id, !note.isPrivate);
      privacy.onChanged();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not change who can see this note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="ms-auto inline-flex items-center gap-1.5">
      {error && <span className="text-destructive">{error}</span>}
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        title={note.isPrivate ? "Make this note visible to everyone on the ticket" : "Hide this note (and its files) from everyone but the MOS"}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Icon className="h-3 w-3" aria-hidden="true" />}
        {note.isPrivate ? "Unlock" : "Lock"}
      </button>
    </span>
  );
}
