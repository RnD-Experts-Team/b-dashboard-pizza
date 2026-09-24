"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fixed-height dialog body — the store-passport-dialog.tsx pattern.        */
/*                                                                            */
/*  Height is FIXED (not content-driven): header and footer never move and   */
/*  only the body scrolls. Two classes rather than h-[min(85vh,…)] because   */
/*  Tailwind splits arbitrary values on the comma.                           */
/* ────────────────────────────────────────────────────────────────────────── */

const SIZE = {
  md: "h-[85vh] max-h-[640px] sm:max-w-2xl",
  lg: "h-[88vh] max-h-[760px] sm:max-w-3xl",
} as const;

interface DialogShellProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZE;
  children: React.ReactNode;
  /** Pinned strip between header and scroll body (e.g. step tabs). */
  toolbar?: React.ReactNode;
  bodyClassName?: string;
  /** Block closing while a request is in flight. */
  busy?: boolean;
}

export const DialogShell = forwardRef<HTMLDivElement, DialogShellProps>(function DialogShell(
  { title, description, footer, size = "md", children, toolbar, bodyClassName, busy },
  bodyRef,
) {
  return (
    <DialogContent
      className={cn("flex w-[95vw] flex-col gap-0 overflow-hidden p-0", SIZE[size])}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={(e) => {
        if (busy) e.preventDefault();
      }}
      onEscapeKeyDown={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <DialogHeader className="shrink-0 border-b px-5 py-3 pe-10 text-start">
        <DialogTitle className="font-heading font-semibold">{title}</DialogTitle>
        {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
      </DialogHeader>
      {toolbar && <div className="shrink-0 border-b bg-muted/30 px-5 py-2">{toolbar}</div>}
      <div
        ref={bodyRef}
        className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", bodyClassName)}
      >
        {children}
      </div>
      {footer && <DialogFooter className="shrink-0 border-t px-5 py-3">{footer}</DialogFooter>}
    </DialogContent>
  );
});

/** Small labelled field wrapper shared by the workbook forms. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive animate-in fade-in-0">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Form-level error callout (part-usage-panel shape). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive animate-in fade-in-0 slide-in-from-top-1"
    >
      {message}
    </div>
  );
}
