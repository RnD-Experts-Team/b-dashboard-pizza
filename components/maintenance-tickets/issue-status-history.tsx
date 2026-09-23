"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { formatTimestamp } from "@/lib/utils/date-display";
import { StatusChip } from "./ticket-chips";
import type { TicketIssue } from "@/types/maintenance-tickets.types";

/**
 * Every status this issue has been through, who moved it, and why.
 *
 * Collapsed by default, and this is the one thing on the ticket page that is
 * allowed to be: it is a reference, not an action. "Nothing hidden" is about
 * what the coordinator can DO -- burying a button they need is what made the
 * old screen hostile. A closed history is a shorter page, and the count on the
 * toggle already tells them whether there is anything in it.
 *
 * Lifted out of ticket-detail-sheet.tsx so the page and the sheet render the
 * same history rather than two versions of it drifting apart.
 */
export function IssueStatusHistory({
  changes,
}: {
  changes: TicketIssue["statusChanges"];
}) {
  const [open, setOpen] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        What has happened to this issue ({changes.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-s ps-4">
          {changes.map((change) => (
            <div
              key={change.id}
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <StatusChip value={change.status.value} label={change.status.label} />
              {(change.creator || change.changedBy) && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden="true" />
                  {change.creator ? change.creator.name : change.changedBy}
                </span>
              )}
              <span>{formatTimestamp(change.createdAt, "MMM d, yyyy HH:mm")}</span>
              {/* The reason is the whole point of the wait/defer/cancel rules
                  upstream requiring one -- show it, never truncate it away. */}
              {change.reason && <span className="italic">“{change.reason}”</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
