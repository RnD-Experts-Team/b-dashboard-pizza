"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/types/maintenance-tickets.types";
import { AttachmentGallery } from "./attachment-gallery";

/** How many lines show in place. Tailwind needs the class names written out. */
const CLAMP = {
  short: "line-clamp-2",
  normal: "line-clamp-4",
  long: "line-clamp-6",
} as const;

type ClampSize = keyof typeof CLAMP;

/**
 * A description, note, question or answer: a few lines in place, and when it
 * runs longer a "Read more" that opens the whole text (and its files) in a
 * dialog, so a long text never stretches its card.
 */
export function ReadMoreText({
  text,
  title,
  meta,
  attachments,
  size = "normal",
  className,
}: {
  text: string;
  /** The dialog's heading: what this text is ("Description", "Note"). */
  title: string;
  /** Who and when, under the heading. */
  meta?: React.ReactNode;
  /** Files that belong with the text, shown again in the dialog. */
  attachments?: TicketAttachment[];
  size?: ClampSize;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem.common");
  const ref = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  // Clipped is a matter of layout (width, font), so it is measured, and
  // measured again whenever the box changes size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, size]);

  return (
    <div className={className}>
      <p ref={ref} className={cn("whitespace-pre-wrap break-words", CLAMP[size])}>
        {text}
      </p>
      {clipped ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-0.5 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {t("readMore")}
        </button>
      ) : null}
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {meta ? <DialogDescription asChild><div>{meta}</div></DialogDescription> : null}
            </DialogHeader>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pe-1">
              <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
              {attachments?.length ? <AttachmentGallery attachments={attachments} className="mt-0" /> : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
