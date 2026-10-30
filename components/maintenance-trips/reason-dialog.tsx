"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/maintenance-tickets/form-bits";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";

/**
 * A confirmation that asks why (MOS corrections are audited). `destructive`
 * styles the confirm button for "Mark as mistake". The dialog stays open on
 * a refusal and shows the server's words under the reason.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonRequired = true,
  withReason = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  /** false = a plain confirmation (no reason box). */
  withReason?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {open && (
          <ReasonBody
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            destructive={destructive}
            reasonRequired={withReason && reasonRequired}
            withReason={withReason}
            onConfirm={onConfirm}
            onDone={() => onOpenChange(false)}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReasonBody({
  title,
  description,
  confirmLabel,
  destructive,
  reasonRequired,
  withReason,
  onConfirm,
  onDone,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive: boolean;
  reasonRequired: boolean;
  withReason: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (reasonRequired && !reason.trim()) {
      setError(t("trips.reasonNeeded"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(reason.trim());
      onDone();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-heading font-semibold">{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      {withReason && (
      <div className="space-y-1.5">
        <Label htmlFor="trip-reason">
          {t("common.reason")}
          {reasonRequired ? <span className="text-destructive"> *</span> : ` (${t("common.optional")})`}
        </Label>
        <Textarea
          id="trip-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          aria-invalid={!!error}
          autoFocus
        />
        <p className="text-[11px] text-muted-foreground">{t("common.reasonHelp")}</p>
      </div>
      )}
      <FieldError message={error} />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
        <Button type="button" variant={destructive ? "destructive" : "default"} disabled={busy} onClick={() => void submit()}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
}
