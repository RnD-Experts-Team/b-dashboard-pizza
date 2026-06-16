"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 *  WbrDetailDialog — a thin, content-agnostic expand dialog used by the
 *  text-heavy WBR cards (complaints, feedbacks, money-owed, non-negotiable,
 *  channel split, promo breakdown, portal-weekly history).
 *
 *  The body scrolls; long text wraps so it never breaks the page or dialog.
 * ────────────────────────────────────────────────────────────────────── */

interface WbrDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Small pill next to the title (e.g. a date range or a count). */
  badgeText?: string;
  children: ReactNode;
  /** Constrain the content width — defaults to a roomy 4xl. */
  className?: string;
}

export function WbrDetailDialog({
  open,
  onOpenChange,
  title,
  badgeText,
  children,
  className,
}: WbrDetailDialogProps) {
  return (
    // Stop clicks bubbling to the card underneath (which would re-open the dialog).
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "overflow-hidden p-0 sm:max-w-4xl",
            className,
          )}
        >
          <DialogHeader className="border-b px-5 py-3">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {title}
              {badgeText && (
                <Badge
                  variant="outline"
                  className="ms-1 h-5 py-0 text-[10px] font-normal"
                >
                  {badgeText}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── DetailField — label + wrapping value, for record detail dialogs ──── */

export function DetailField({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: ReactNode;
  /** When true, render as a stacked block so long text can wrap freely. */
  wrap?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  if (wrap) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="whitespace-pre-wrap break-words text-[12.5px]">{value}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
