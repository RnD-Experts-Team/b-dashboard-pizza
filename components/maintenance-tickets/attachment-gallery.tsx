"use client";

import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/types/maintenance-tickets.types";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/;

function isImageAttachment(a: TicketAttachment): boolean {
  const mime = (a.contentType || "").toLowerCase();
  const url = (a.url || "").toLowerCase();
  const name = (a.fileName || "").toLowerCase();
  return mime.startsWith("image/") || IMAGE_EXT.test(url) || IMAGE_EXT.test(name);
}

/**
 * Renders a flex-wrapped gallery of attachments. Images become clickable
 * thumbnails; other files become labelled paperclip links. Missing URLs are
 * shown greyed-out and non-interactive.
 */
export function AttachmentGallery({
  attachments,
  className,
}: {
  attachments: TicketAttachment[];
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", className)}>
      {attachments.map((attachment, index) => {
        const hasUrl = Boolean(attachment.url);
        const label = attachment.fileName || `Attachment ${index + 1}`;

        if (!hasUrl) {
          return (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40"
              title={`${label} (missing URL)`}
            >
              <Paperclip className="h-3 w-3" />
              <span>{label}</span>
            </span>
          );
        }

        if (isImageAttachment(attachment)) {
          return (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
              title={label}
              aria-label={`Open ${label} in new tab`}
            >
              <img
                src={attachment.url}
                alt={label}
                className="h-16 w-16 rounded-sm border object-cover"
                loading="lazy"
              />
            </a>
          );
        }

        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title={label}
            aria-label={`Open ${label} in new tab`}
          >
            <Paperclip className="h-3 w-3" />
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
}
