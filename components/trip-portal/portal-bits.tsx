"use client";

import { useId, useRef, type ReactNode } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { portalErrorKind } from "@/lib/api/services/trip-portal.service";
import type { TripPortalErrorKind } from "@/types/maintenance-v2";

/* ── Big touch targets (UX rule 11: ≥ 48 px, full width, 8 px apart) ─────── */

export function BigButton({
  children,
  icon,
  busy = false,
  variant = "default",
  size = "big",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & {
  icon?: ReactNode;
  busy?: boolean;
  /** "giant" = the one primary action of the page. */
  size?: "big" | "giant";
}) {
  return (
    <Button
      variant={variant}
      className={cn(
        "w-full gap-3 rounded-xl font-semibold [&_svg:not([class*='size-'])]:size-6",
        size === "giant" ? "min-h-20 text-2xl" : "min-h-14 text-lg",
        className,
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </Button>
  );
}

/** A bottom sheet for one action: big title, the fields, a big Cancel. */
export function PortalSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl font-semibold">{title}</SheetTitle>
          {description && <SheetDescription className="text-base">{description}</SheetDescription>}
        </SheetHeader>
        <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-4">
          {open && children}
          <BigButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </BigButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Label + big control + help + error, stacked. */
export function BigField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-base font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

export const BIG_INPUT = "h-14 rounded-xl px-4 text-lg md:text-lg";
export const BIG_TEXTAREA = "min-h-28 rounded-xl px-4 py-3 text-lg md:text-lg";

/**
 * Photos from the camera (`capture="environment"` opens the back camera on
 * a phone; a computer gets a file picker). Shows what was picked, each
 * removable.
 */
export function PhotoField({
  label,
  files,
  onChange,
  multiple = true,
  help,
}: {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  help?: string;
}) {
  const t = useTranslations("maintenanceV2");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <span className="block text-base font-medium">{label}</span>
      <label
        htmlFor={id}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 px-4 text-lg font-medium focus-within:ring-[3px] focus-within:ring-ring/50"
      >
        <Camera className="size-6" aria-hidden="true" />
        {files.length ? t("tripPortal.addAnotherPhoto") : t("tripPortal.takePhoto")}
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
            // Let the same photo be picked again after removing it.
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      {!!files.length && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex min-h-12 items-center gap-2 rounded-lg border bg-card ps-3">
              <span className="min-w-0 flex-1 truncate text-base">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                className="size-12"
                aria-label={t("tripPortal.removePhoto", { name: file.name })}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Two big choices (Yes / No). */
export function BigChoice<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V | null;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-14 rounded-xl border-2 text-lg font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Errors in his words ─────────────────────────────────────────────────── */

const KIND_KEYS: Partial<Record<TripPortalErrorKind, string>> = {
  expired: "tripPortal.expired",
  not_found: "tripPortal.notFound",
  network: "tripPortal.offline",
  rate_limited: "tripPortal.tooFast",
};

/** What to say under a form when an action fails (the server's own words for a refusal). */
export function usePortalErrorText(): (err: unknown) => string {
  const t = useTranslations("maintenanceV2");
  return (err: unknown) => {
    const kind = portalErrorKind(err);
    const key = KIND_KEYS[kind];
    if (key) return t(key);
    if (err instanceof MaintenanceTicketsError && kind === "validation") return err.message;
    return t("tripPortal.somethingWrong");
  };
}

/** A whole-number odometer reading, or null. */
export function parseOdometer(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
