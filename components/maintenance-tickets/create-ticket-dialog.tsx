"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, Paperclip, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchCreateCombobox } from "./search-create-combobox";
import { maintenanceTicketsService, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type { CatalogIssue, Priority } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface IssueRow {
  id: string;
  issueId: number | null;
  priority: Priority;
  description: string;
  note: string;
  files: File[];
}

function makeRow(): IssueRow {
  return {
    id: Math.random().toString(36).slice(2),
    issueId: null,
    priority: "medium",
    description: "",
    note: "",
    files: [],
  };
}

interface CreateTicketDialogProps {
  open: boolean;
  storeId: string;
  catalogIssues: CatalogIssue[];
  onClose: () => void;
  onSuccess: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function CreateTicketDialog({
  open,
  storeId,
  catalogIssues,
  onClose,
  onSuccess,
}: CreateTicketDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const [rows, setRows] = useState<IssueRow[]>([makeRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Local catalog issues — seeded from prop, grows when user creates new ones in-session
  const [localCatalogIssues, setLocalCatalogIssues] = useState<CatalogIssue[]>(() =>
    catalogIssues.filter((i) => !i.deletedAt)
  );

  // Re-seed on dialog open so it always reflects the latest catalog data
  useEffect(() => {
    if (open) {
      setLocalCatalogIssues(catalogIssues.filter((i) => !i.deletedAt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const comboItems = localCatalogIssues.map((i) => ({ id: i.id, label: i.title }));

  function updateRow(id: string, patch: Partial<IssueRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function handleClose() {
    if (isSubmitting) return;
    setRows([makeRow()]);
    setSubmitError(null);
    onClose();
  }

  /** Creates a catalog issue and returns the new id. Called by SearchCreateCombobox. */
  async function createCatalogIssue(title: string): Promise<number> {
    const newIssue = await maintenanceTicketsService.createCatalogIssue({ title }, storeId);
    setLocalCatalogIssues((prev) => [...prev, newIssue]);
    return newIssue.id;
  }

  async function handleSubmit() {
    setSubmitError(null);

    for (const row of rows) {
      if (!row.issueId) {
        setSubmitError(t("createDialog.validationSelectIssue"));
        return;
      }
      if (!row.description.trim()) {
        setSubmitError(t("createDialog.validationDescriptionRequired"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await maintenanceTicketsService.createTicket(storeId, {
        issues: rows.map((row) => ({
          issue_id: row.issueId!,
          priority: row.priority,
          description: row.description.trim(),
          ...(row.note.trim() ? { notes: [{ body: row.note.trim() }] } : {}),
          ...(row.files.length ? { files: row.files } : {}),
        })),
      });
      setRows([makeRow()]);
      setSubmitError(null);
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof MaintenanceTicketsError ? err.message : t("createDialog.submitError")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rows.map((row, idx) => (
            <div key={row.id} className="rounded-lg border p-4 space-y-3">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("createDialog.issueRow", { number: idx + 1 })}
                </span>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Issue search + create */}
              <div className="space-y-1">
                <Label className="text-sm">
                  {t("createDialog.issueLabel")} <span className="text-destructive">*</span>
                </Label>
                <SearchCreateCombobox
                  items={comboItems}
                  selectedId={row.issueId}
                  onSelect={(id) => updateRow(row.id, { issueId: id })}
                  onCreate={createCatalogIssue}
                  placeholder="Search issues or type to create a new one…"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label className="text-sm">{t("createDialog.priorityLabel")}</Label>
                <Select
                  value={row.priority}
                  onValueChange={(v) => updateRow(row.id, { priority: v as Priority })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">{t("priority.urgent")}</SelectItem>
                    <SelectItem value="high">{t("priority.high")}</SelectItem>
                    <SelectItem value="medium">{t("priority.medium")}</SelectItem>
                    <SelectItem value="low">{t("priority.low")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-sm">{t("createDialog.descriptionLabel")}</Label>
                <Textarea
                  value={row.description}
                  onChange={(e) => updateRow(row.id, { description: e.target.value })}
                  placeholder={t("createDialog.descriptionPlaceholder")}
                  className="text-sm min-h-20"
                />
              </div>

              {/* Optional note */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {t("createDialog.noteLabel")}
                  <span className="ms-1 text-xs font-normal opacity-60">{t("createDialog.optional")}</span>
                </Label>
                <Textarea
                  value={row.note}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                  placeholder={t("createDialog.notePlaceholder")}
                  className="text-sm min-h-14"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {t("createDialog.filesLabel")}
                  <span className="ms-1 text-xs font-normal opacity-60">{t("createDialog.optional")}</span>
                </Label>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[row.id] = el; }}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length) updateRow(row.id, { files: [...row.files, ...picked] });
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[row.id]?.click()}
                >
                  <Paperclip className="me-1.5 h-3.5 w-3.5" />
                  {t("createDialog.attachFiles")}
                </Button>
                {row.files.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {row.files.map((file, fi) => (
                      <li key={fi} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3 shrink-0 opacity-50" />
                        <span className="truncate max-w-[220px]">{file.name}</span>
                        <button
                          type="button"
                          aria-label={t("createDialog.removeFile")}
                          onClick={() => updateRow(row.id, { files: row.files.filter((_, idx) => idx !== fi) })}
                          className="ms-auto text-destructive hover:opacity-80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addRow}
          >
            <Plus className="me-1.5 h-4 w-4" />
            {t("createDialog.addIssue")}
          </Button>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t("createDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("createDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
