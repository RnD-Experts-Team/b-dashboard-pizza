"use client";

import { useCallback, useState } from "react";
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

/**
 * The unsaved-changes guard every storage dialog with typed data uses
 * (docs/MAINTENANCE-V2-UI.md rule 5): closing with something typed asks
 * first; closing a clean form just closes.
 *
 *   const guard = useDiscardGuard(isDirty, () => onOpenChange(false));
 *   <Dialog open={open} onOpenChange={(o) => !o && guard.requestClose()}>
 *   {guard.dialog}
 */
export function useDiscardGuard(dirty: boolean, close: () => void) {
  const t = useTranslations("maintenanceV2");
  const [asking, setAsking] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else close();
  }, [dirty, close]);

  const dialog = (
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading font-semibold">{t("common.unsavedTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.unsavedBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.keepEditing")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              setAsking(false);
              close();
            }}
          >
            {t("common.discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestClose, dialog };
}

/**
 * Runs `reset` (state setters) when a dialog goes from closed to open, during
 * render rather than in an effect, so the first open frame already shows the
 * fresh form (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 */
export function useResetOnOpen(open: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }
}
