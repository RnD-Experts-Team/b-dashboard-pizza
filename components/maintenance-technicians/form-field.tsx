"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One labelled form field (docs/MAINTENANCE-V2-UI.md rule 4): the label, a
 * "Required" mark where it applies, the control, helper text under anything
 * not obvious, and the error under the field. `id` ties the label, the helper
 * and the error to the control (`aria-describedby` is the caller's: use
 * `describedBy(id, error, help)`).
 */
export function FormField({
  id,
  label,
  required,
  help,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <div className={cn("space-y-1.5", className)} data-slot="form-field">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {required && (
          <span className="text-xs font-normal text-muted-foreground">
            <span aria-hidden="true" className="text-destructive">*</span>
            <span className="sr-only">{t("common.required")}</span>
          </span>
        )}
      </Label>
      {children}
      {help && !error && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The `aria-describedby` for a control rendered inside `FormField`. */
export function describedBy(id: string, error?: string, help?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (help) return `${id}-help`;
  return undefined;
}

/** Puts the keyboard on the first field that carries an error (rule 4). */
export function focusFirstInvalid(container: HTMLElement | null, ids: readonly string[], errors: Record<string, string | undefined>) {
  const first = ids.find((id) => errors[id]);
  if (!first || !container) return;
  // Next frame: the error text must be rendered before the focus lands.
  requestAnimationFrame(() => {
    const el = container.querySelector<HTMLElement>(`#${CSS.escape(first)}`);
    el?.focus();
  });
}
