"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentGallery } from "@/components/maintenance-tickets/attachment-gallery";
import type { TicketAttachment } from "@/types/maintenance-tickets.types";

/**
 * A troubleshooting guide, read-only: the steps in order, then the link and
 * files. Used in the new-ticket form, the library, and on a ticket to show
 * what the manager confirmed trying.
 */
export function TroubleshootingSteps({
  steps,
  linkUrl,
  attachments = [],
  fileNames = [],
  className,
}: {
  steps: string[];
  linkUrl: string | null;
  attachments?: TicketAttachment[];
  /** Files known only by name (a ticket's snapshot of the guide). */
  fileNames?: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="whitespace-pre-wrap">{step}</li>
        ))}
      </ol>
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open the guide (video / manual)
        </a>
      )}
      {attachments.length > 0 && <AttachmentGallery attachments={attachments} />}
      {attachments.length === 0 && fileNames.length > 0 && (
        <p className="text-xs text-muted-foreground">Files: {fileNames.join(", ")}</p>
      )}
    </div>
  );
}
