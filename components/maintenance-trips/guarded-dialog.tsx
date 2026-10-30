"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A dialog that asks "Discard your changes?" before closing while `dirty`
 * (UX rule 5). The children are mounted only while open, so every opening
 * starts from a fresh form.
 */
export function GuardedDialog({
  open,
  onOpenChange,
  dirty,
  busy = false,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty: boolean;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("maintenanceV2");
  const [asking, setAsking] = useState(false);

  function request(next: boolean): void {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (busy) return;
    if (dirty) {
      setAsking(true);
      return;
    }
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={request}>
        <DialogContent className={cn("max-h-[90dvh] overflow-y-auto sm:max-w-lg", className)}>
          {open && children}
        </DialogContent>
      </Dialog>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("common.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.unsavedBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.keepEditing")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAsking(false);
                onOpenChange(false);
              }}
            >
              {t("common.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
