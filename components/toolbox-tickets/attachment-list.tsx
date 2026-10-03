"use client";

import { Download, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatBytes, isImage } from "@/lib/toolbox-tickets/uploads";
import type { TicketAttachment } from "@/types/toolbox-tickets.types";

/**
 * Attachment URLs are PUBLIC (no auth on the bytes, by design upstream). They
 * render straight into <img src> / <a download> — and must never be copied
 * into a query string, a shareable surface, or an analytics event.
 */
export function AttachmentList({
  attachments,
  className,
  dense,
}: {
  attachments: TicketAttachment[];
  className?: string;
  dense?: boolean;
}) {
  const t = useTranslations("toolboxTickets.thread");
  if (!attachments.length) return null;

  const images = attachments.filter((a) => isImage(a.mimeType));
  const others = attachments.filter((a) => !isImage(a.mimeType));

  return (
    <div className={cn("space-y-2", className)} data-slot="ticket-attachments">
      {images.length > 0 && (
        <div className={cn("grid gap-2", dense ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4")}>
          {images.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group relative block aspect-square overflow-hidden rounded-md border bg-muted"
              title={a.originalName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.originalName}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                download={a.originalName}
                target="_blank"
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{a.originalName}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{formatBytes(a.size)}</span>
                <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("download")} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
