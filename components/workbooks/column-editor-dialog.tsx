"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import {
  draftKeyForErrorField,
  draftsFromColumns,
  removedColumns,
  toColumnPayload,
  validateDrafts,
  type ColumnDraft,
} from "@/lib/workbooks/columns-diff";
import { getWorkbookFieldErrors, hasServerCode, isCancelled } from "@/lib/workbooks/errors";
import type { Workbook, WorkbookColumn } from "@/types/workbooks.types";
import { ColumnEditor } from "./column-editor";
import { DialogShell, FormError } from "./dialog-shell";
import { useErrorText } from "./guarded";

interface ColumnEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workbook: Workbook;
  /** Rows the viewer can see — "up to", since hidden rows lose cells too. */
  rowCount: number | null;
  onSaved: (columns: WorkbookColumn[]) => void;
}

/**
 * The whole column list as one modal. Submitting is a WHOLE-LIST replace, so
 * any existing column missing from the list is deleted with its cells — the
 * dialog stops on a confirm step naming each one before sending.
 */
export function ColumnEditorDialog({ open, onOpenChange, workbook, rowCount, onSaved }: ColumnEditorDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const { columnTypes } = useWorkbookOptions();
  const [drafts, setDrafts] = useState<ColumnDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDrafts(draftsFromColumns(workbook.columns));
      setErrors({});
      setFormError(null);
      setConfirming(false);
    }
  }, [open, workbook.columns]);

  const removed = useMemo(() => removedColumns(workbook.columns, drafts), [workbook.columns, drafts]);

  const send = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const columns = await workbooksService.replaceColumns(workbook.id, toColumnPayload(drafts, columnTypes));
      toast.success(t("columns.saved"));
      onSaved(columns);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      setConfirming(false);
      if (hasServerCode(err, "WORKBOOK_LAST_COLUMN")) {
        setFormError(t("columns.errors.lastColumn"));
        return;
      }
      const fields = getWorkbookFieldErrors(err);
      const byKey: Record<string, string> = {};
      const leftovers: string[] = [];
      for (const [field, message] of Object.entries(fields)) {
        const key = draftKeyForErrorField(field, drafts);
        if (key) byKey[key] = message;
        else leftovers.push(message);
      }
      setErrors(byKey);
      const message = leftovers[0] ?? (Object.keys(byKey).length ? null : errorText(err, workbook.breadcrumb));
      if (message) {
        setFormError(message);
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const { byKey, form } = validateDrafts(drafts, columnTypes);
    setErrors(byKey);
    setFormError(form ? t(`columns.errors.${form}`) : null);
    if (form || Object.keys(byKey).length) return;
    if (removed.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void send();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        size="lg"
        busy={saving}
        title={confirming ? t("columns.confirmTitle", { count: removed.length }) : t("columns.editTitle")}
        description={confirming ? undefined : t("columns.editDescription")}
        footer={
          confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" />
                {t("common.back")}
              </Button>
              <Button variant="destructive" onClick={() => void send()} disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("columns.confirm")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </>
          )
        }
      >
        {confirming ? (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-1">
            <div className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">{t("columns.confirmBody")}</p>
                {rowCount != null && rowCount > 0 && (
                  <p className="text-xs">{t("columns.confirmRows", { count: rowCount })}</p>
                )}
              </div>
            </div>
            <ul className="divide-y rounded-lg border">
              {removed.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.typeLabel ?? c.type}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <FormError message={formError} />
            <ColumnEditor
              drafts={drafts}
              onChange={(next) => {
                setDrafts(next);
                setFormError(null);
              }}
              columnTypes={columnTypes}
              errors={errors}
              disabled={saving}
            />
            {removed.length > 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive animate-in fade-in-0">
                <AlertTriangle className="h-3 w-3" />
                {t("columns.pendingRemoval", { names: removed.map((c) => c.name).join(", ") })}
              </p>
            )}
          </div>
        )}
      </DialogShell>
    </Dialog>
  );
}
