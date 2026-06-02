"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { maintenanceTicketsService, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type { CatalogIssue, Priority } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface IssueRow {
  id: string; // local key only
  useCatalog: boolean;
  issueId: number | null;
  otherTitle: string;
  priority: Priority;
  description: string;
}

function makeRow(): IssueRow {
  return {
    id: Math.random().toString(36).slice(2),
    useCatalog: true,
    issueId: null,
    otherTitle: "",
    priority: "medium",
    description: "",
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

  const activeCatalogIssues = catalogIssues.filter((i) => !i.deletedAt);

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

  async function handleSubmit() {
    setSubmitError(null);

    // Validate
    for (const row of rows) {
      if (row.useCatalog && !row.issueId) {
        setSubmitError(t("createDialog.validationSelectIssue"));
        return;
      }
      if (!row.useCatalog && !row.otherTitle.trim()) {
        setSubmitError(t("createDialog.validationTitleRequired"));
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
          ...(row.useCatalog ? { issue_id: row.issueId! } : { other_title: row.otherTitle.trim() }),
          priority: row.priority,
          description: row.description.trim(),
        })),
      });
      setRows([makeRow()]);
      setSubmitError(null);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof MaintenanceTicketsError
          ? err.message
          : t("createDialog.submitError");
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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

              {/* Toggle catalog / free-text */}
              <div className="flex items-center gap-3">
                <Switch
                  id={`catalog-${row.id}`}
                  checked={row.useCatalog}
                  onCheckedChange={(v) => updateRow(row.id, { useCatalog: v, issueId: null, otherTitle: "" })}
                />
                <Label htmlFor={`catalog-${row.id}`} className="text-sm">
                  {row.useCatalog ? t("createDialog.useCatalog") : t("createDialog.useCustom")}
                </Label>
              </div>

              {/* Issue select or free-text */}
              {row.useCatalog ? (
                <div className="space-y-1">
                  <Label className="text-sm">{t("createDialog.issueLabel")}</Label>
                  <Select
                    value={row.issueId ? String(row.issueId) : ""}
                    onValueChange={(v) => updateRow(row.id, { issueId: Number(v) })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={t("createDialog.issuePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCatalogIssues.map((issue) => (
                        <SelectItem key={issue.id} value={String(issue.id)}>
                          {issue.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-sm">{t("createDialog.customTitleLabel")}</Label>
                  <Input
                    value={row.otherTitle}
                    onChange={(e) => updateRow(row.id, { otherTitle: e.target.value })}
                    placeholder={t("createDialog.customTitlePlaceholder")}
                    className="text-sm"
                  />
                </div>
              )}

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
            </div>
          ))}

          {/* Add row */}
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

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
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
