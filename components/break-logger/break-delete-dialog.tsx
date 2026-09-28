"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { useBreakMutations } from "@/lib/hooks/use-break-mutations";
import { parseBreakError } from "@/lib/break-logger/errors";
import type { BreakEntry } from "@/types/breaks.types";
import { useBreakErrorText, useFormatWorkDate } from "./break-ui";

/** Hard delete (notes included) behind a confirmation. */
export function BreakDeleteDialog({
  entry,
  onOpenChange,
  onDeleted,
}: {
  entry: BreakEntry | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatWorkDate = useFormatWorkDate();
  const { remove } = useBreakMutations();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!entry) return;
    setBusy(true);
    try {
      await remove(entry.id);
      toast.success(t("delete.deleted"));
      onDeleted?.();
      onOpenChange(false);
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "CANCELLED") return;
      if (e.code === "NOT_FOUND") {
        // Already gone — the outcome the user wanted. Just resync.
        toast.success(t("delete.deleted"));
        onDeleted?.();
        onOpenChange(false);
        return;
      }
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={entry != null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
          {entry && (
            <AlertDialogDescription>
              {t("delete.description", {
                label: entry.label,
                date: formatWorkDate(entry.work_date),
              })}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("delete.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              // Keep the dialog open until the request settles.
              e.preventDefault();
              void confirm();
            }}
          >
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t("delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
