"use client";

import { useCallback, useRef, useState } from "react";
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
 * (docs/MAINTENANCE-UI.md rule 5): closing with something typed asks
 * first; closing a clean form just closes.
 *
 *   const guard = useDiscardGuard(isDirty, () => onOpenChange(false));
 *   <Dialog open={open} onOpenChange={(o) => !o && guard.requestClose()}>
 *   {guard.dialog}
 *
 * `requestClose(then)` runs `then` once the dialog really closed (straight
 * away, or after "Discard"), e.g. to go to another tab; "Keep editing"
 * forgets it.
 */
export function useDiscardGuard(dirty: boolean, close: () => void) {
  const t = useTranslations("maintenanceSystem");
  const [asking, setAsking] = useState(false);
  const after = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (then?: unknown) => {
      // Also used straight as an onClick handler: only a function counts as "then".
      const next = typeof then === "function" ? (then as () => void) : null;
      if (dirty) {
        after.current = next;
        setAsking(true);
      } else {
        close();
        next?.();
      }
    },
    [dirty, close],
  );

  const dialog = (
    <AlertDialog
      open={asking}
      onOpenChange={(open) => {
        setAsking(open);
        if (!open) after.current = null;
      }}
    >
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
              const next = after.current;
              after.current = null;
              setAsking(false);
              close();
              next?.();
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
