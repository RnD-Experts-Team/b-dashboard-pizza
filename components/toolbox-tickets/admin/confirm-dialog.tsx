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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Extra warning block (e.g. the level-deactivation outage explanation). */
  children?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown>;
}

/** AlertDialog that stays open and blocks closing while the action runs. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const tc = useTranslations("toolboxTickets.common");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* The caller toasts; keep the dialog open so the user can retry or cancel. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-3 text-start">
          <AlertDialogTitle className="font-heading font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>}
        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={() => void confirm()}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
