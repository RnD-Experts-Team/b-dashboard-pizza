"use client";

import { Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/types/maintenance-tickets.types";

/** The small "Before" / "After" tag on a job photo (attachment `kind`). */
function KindTag({ kind, overlay }: { kind: NonNullable<TicketAttachment["kind"]>; overlay?: boolean }) {
  const t = useTranslations("maintenanceV2.common.photoKind");
  return (
    <span
      className={cn(
        "rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider",
        overlay ? "absolute start-0.5 bottom-0.5 bg-background/85 text-foreground shadow-xs" : "bg-muted text-muted-foreground",
      )}
    >
      {t(kind)}
    </span>
  );
}

/**
 * An image file extension at the end of a (lower-cased) name or URL:
 * matches "photo.jpeg", rejects "invoice.pdf".
 * https://regex101.com/?flavor=javascript&regex=%5C.(png%7Cjpe%3Fg%7Cgif%7Cwebp%7Cbmp%7Csvg)%24&flags=m&testString=photo.jpeg%0Ainvoice.pdf
 */
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
              className="relative inline-flex items-center"
              title={label}
              aria-label={`Open ${label} in new tab`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- upload URLs from the API, any host */}
              <img
                src={attachment.url}
                alt={label}
                className="h-16 w-16 rounded-sm border object-cover"
                loading="lazy"
              />
              {attachment.kind && <KindTag kind={attachment.kind} overlay />}
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
            {attachment.kind && <KindTag kind={attachment.kind} />}
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
}
