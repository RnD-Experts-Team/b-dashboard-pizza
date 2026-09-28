"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { isCancelled, readFolderNotEmpty } from "@/lib/workbooks/errors";
import type { Breadcrumb, WorkbookFolder } from "@/types/workbooks.types";
import { useErrorText } from "./guarded";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Folder delete: two steps, driven by the server.                          */
/*                                                                            */
/*  1. DELETE without force. An empty folder just goes.                      */
/*  2. A 409 WORKBOOK_FOLDER_NOT_EMPTY carries the counts; the dialog turns  */
/*     destructive, shows them, and only then re-sends with ?force=true.     */
/*     Delete cascades to the whole subtree — every row and cell beneath.    */
/* ────────────────────────────────────────────────────────────────────────── */

interface DeleteFolderDialogProps {
  folder: WorkbookFolder | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (folder: WorkbookFolder) => void;
  breadcrumb?: Breadcrumb[];
}

export function DeleteFolderDialog({ folder, onOpenChange, onDeleted, breadcrumb }: DeleteFolderDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<{ childFolders: number; workbooks: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folder) {
      setCounts(null);
      setError(null);
    }
  }, [folder]);

  const run = async (force: boolean) => {
    if (!folder) return;
    setBusy(true);
    setError(null);
    try {
      await workbooksService.deleteFolder(folder.id, { force });
      toast.success(t("deleteFolder.deleted"));
      onDeleted(folder);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const notEmpty = readFolderNotEmpty(err);
      if (notEmpty && !force) {
        setCounts(notEmpty);
      } else {
        const message = errorText(err, breadcrumb);
        setError(message);
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={folder !== null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="w-[95vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading font-semibold">
            {counts ? t("deleteFolder.notEmptyTitle") : t("deleteFolder.title", { name: folder?.name ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {counts ? (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1">
                  <p>{t("deleteFolder.notEmptyBody", { name: folder?.name ?? "" })}</p>
                  <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                    {counts.childFolders > 0 && (
                      <li>{t("deleteFolder.childFolders", { count: counts.childFolders })}</li>
                    )}
                    {counts.workbooks > 0 && <li>{t("deleteFolder.workbooks", { count: counts.workbooks })}</li>}
                    <li className="font-normal">{t("deleteFolder.rowsNote")}</li>
                  </ul>
                  <p className="text-xs">{t("deleteFolder.cannotUndo")}</p>
                </div>
              ) : (
                <p>{t("deleteFolder.body")}</p>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void run(Boolean(counts))}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {counts ? t("deleteFolder.confirmForce") : t("common.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Generic confirm (workbook, row) ─────────────────────────────────────── */

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  /** Resolve on success, throw on failure (the dialog shows the message). */
  onConfirm: () => Promise<void>;
  breadcrumb?: Breadcrumb[];
}

export function ConfirmDeleteDialog({ open, onOpenChange, title, body, onConfirm, breadcrumb }: ConfirmDeleteDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const message = errorText(err, breadcrumb);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="w-[95vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-heading font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
          {error && <p className="text-xs text-destructive animate-in fade-in-0">{error}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void run()}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
