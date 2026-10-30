"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Control id for a form error key: `lines.0.store_id` → `pay-lines-0-store_id`. */
export function fieldId(errorKey: string): string {
  return `pay-${errorKey.split(".").join("-")}`;
}

/**
 * One labelled field: label (required marked), the control, helper text
 * under anything not obvious, and the error under the field (UX rule 4).
 */
export function Field({
  htmlFor,
  label,
  required,
  help,
  error,
  className,
  children,
  aside,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
  /** Small thing at the end of the label row (a badge, a reset link). */
  aside?: ReactNode;
}) {
  const t = useTranslations("maintenanceV2.common");
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only">{t("required")}</span>}
        </Label>
        {aside}
      </div>
      {children}
      {help && !error && <p className="text-[11px] text-muted-foreground">{help}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
