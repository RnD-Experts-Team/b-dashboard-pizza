"use client";

/**
 * The pieces every small action dialog on the ticket page is made of
 * (docs/MAINTENANCE-UI.md rules 4–5): a labelled field with its error
 * under it, a submit that disables + spins, a 422 mapped onto the fields
 * with focus moved to the first invalid one, a success toast, and an
 * unsaved-changes guard when something was typed.
 */

import { useCallback, useId, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";

/* ── Submitting ──────────────────────────────────────────────────────────── */

export interface DialogSubmit {
  busy: boolean;
  formError: string | null;
  /** The first server message for a field (snake_case dotted path). */
  fieldError: (name: string) => string | undefined;
  /** Client-side errors, set before sending. */
  setFieldErrors: (errors: Record<string, string>) => void;
  /** Runs the write; true when it succeeded. */
  submit: (fn: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
  reset: () => void;
  /** Put as `data-action-scope` on the form's container, so the first invalid field can be focused. */
  scope: string;
}

function firstMessages(bag: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(bag ?? {}).map(([key, list]) => [key, list[0] ?? ""]));
}

export function useDialogSubmit(): DialogSubmit {
  const t = useTranslations("maintenanceSystem");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const scope = useId();

  const focusFirstInvalid = useCallback(() => {
    requestAnimationFrame(() => {
      const box = document.querySelector(`[data-action-scope="${CSS.escape(scope)}"]`);
      const el = box?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.focus();
    });
  }, [scope]);

  const setFieldErrors = useCallback(
    (next: Record<string, string>) => {
      setErrors(next);
      if (Object.keys(next).length) focusFirstInvalid();
    },
    [focusFirstInvalid],
  );

  const submit = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      setBusy(true);
      setFormError(null);
      setErrors({});
      try {
        await fn();
        toast.success(successMessage ?? t("common.saved"));
        return true;
      } catch (err) {
        const e = err instanceof MaintenanceTicketsError ? err : null;
        const bag = firstMessages(e?.validationErrors);
        setErrors(bag);
        setFormError(e?.message ?? t("common.saveError"));
        if (Object.keys(bag).length) focusFirstInvalid();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t, focusFirstInvalid],
  );

  const reset = useCallback(() => {
    setBusy(false);
    setFormError(null);
    setErrors({});
  }, []);

  return { busy, formError, fieldError: (name) => errors[name], setFieldErrors, submit, reset, scope };
}

/* ── A field ─────────────────────────────────────────────────────────────── */

export function Field({
  id,
  label,
  required,
  help,
  error,
  children,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem.common");
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="ms-0.5 text-destructive" aria-label={t("required")}>
            *
          </span>
        ) : null}
      </Label>
      {children}
      {help && !error ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ── The dialog ──────────────────────────────────────────────────────────── */

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  form,
  dirty = false,
  destructive = false,
  canSubmit = true,
  wide = false,
  children,
  footerStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => void;
  form: DialogSubmit;
  /** Something was typed: closing asks first. */
  dirty?: boolean;
  destructive?: boolean;
  canSubmit?: boolean;
  wide?: boolean;
  children: ReactNode;
  footerStart?: ReactNode;
}) {
  const t = useTranslations("maintenanceSystem.common");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formId = useId();

  function requestClose(next: boolean) {
    if (next) return onOpenChange(true);
    if (form.busy) return;
    if (dirty) return setConfirmDiscard(true);
    form.reset();
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          data-action-scope={form.scope}
          className={cn("max-h-[90vh] w-[95vw] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <form
            id={formId}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.busy && canSubmit) onSubmit();
            }}
          >
            {children}
            {form.formError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                {form.formError}
              </p>
            ) : null}
          </form>
          <DialogFooter className="items-center gap-2">
            {footerStart ? <div className="me-auto">{footerStart}</div> : null}
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={form.busy}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form={formId}
              variant={destructive ? "destructive" : "default"}
              disabled={form.busy || !canSubmit}
            >
              {form.busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {form.busy ? t("saving") : submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("unsavedBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepEditing")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                form.reset();
                onOpenChange(false);
              }}
            >
              {t("discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** "More details" disclosure for the optional fields of a step. */
export function MoreDetails({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const t = useTranslations("maintenanceSystem.common");
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" className="-ms-2 h-7 text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? t("fewerDetails") : t("moreDetails")}
      </Button>
      {open ? <div className="space-y-4">{children}</div> : null}
    </div>
  );
}
