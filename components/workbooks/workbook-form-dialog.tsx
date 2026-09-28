"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import {
  blankDraft,
  draftKeyForErrorField,
  toColumnPayload,
  validateDrafts,
  type ColumnDraft,
} from "@/lib/workbooks/columns-diff";
import { getWorkbookFieldErrors, hasServerCode, isCancelled } from "@/lib/workbooks/errors";
import type { Workbook, WorkbookFolder } from "@/types/workbooks.types";
import { ColumnEditor } from "./column-editor";
import { DialogShell, Field, FormError } from "./dialog-shell";
import { useErrorText } from "./guarded";
import {
  VisibilityFields,
  toVisibilityPayload,
  visibilityDraftError,
  type VisibilityDraft,
} from "./visibility-fields";

interface WorkbookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** create: the folder it goes into. */
  folder?: WorkbookFolder | null;
  /** edit: the workbook being renamed. */
  workbook?: Workbook | null;
  storeCode: string | null;
  onSaved: (workbook: Workbook) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

/**
 * Create: name + access + the columns (a workbook needs at least one, and they
 * are defined here). Edit: name and description only — columns and access
 * have their own dialogs.
 */
export function WorkbookFormDialog({
  open,
  onOpenChange,
  mode,
  folder,
  workbook,
  storeCode,
  onSaved,
}: WorkbookFormDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const { visibilities, columnTypes, loading: optionsLoading } = useWorkbookOptions();
  const bodyRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<VisibilityDraft>({ visibility: "owner_only", roles: [] });
  const [columns, setColumns] = useState<ColumnDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [columnErrors, setColumnErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setColumnErrors({});
    setFormError(null);
    if (mode === "edit" && workbook) {
      setName(workbook.name);
      setDescription(workbook.description ?? "");
    } else {
      setName("");
      setDescription("");
      setDraft({ visibility: "owner_only", roles: [] });
      setColumns([blankDraft("text")]);
    }
  }, [open, mode, workbook]);

  const scrollTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const submit = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t("workbookForm.nameRequired");
    let colErrors: Record<string, string> = {};
    if (mode === "create") {
      if (visibilityDraftError(draft, visibilities)) errors.visibility_roles = t("visibility.rolesRequired");
      const v = validateDrafts(columns, columnTypes);
      colErrors = v.byKey;
      if (v.form) errors.columns = t(`columns.errors.${v.form}`);
    }
    setFieldErrors(errors);
    setColumnErrors(colErrors);
    if (Object.keys(errors).length || Object.keys(colErrors).length) {
      if (errors.name) scrollTop();
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      let saved: Workbook;
      if (mode === "create") {
        if (!folder) return;
        saved = await workbooksService.createWorkbook(storeCode, folder.id, {
          name: name.trim(),
          description: description.trim() || null,
          ...toVisibilityPayload(draft, visibilities),
          columns: toColumnPayload(columns, columnTypes),
        });
        toast.success(t("workbookForm.created"));
      } else {
        if (!workbook) return;
        saved = await workbooksService.updateWorkbook(workbook.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success(t("workbookForm.updated"));
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getWorkbookFieldErrors(err);
      const top: Record<string, string> = {};
      const cols: Record<string, string> = {};
      for (const [field, message] of Object.entries(fields)) {
        const key = draftKeyForErrorField(field, columns);
        if (key) cols[key] = message;
        else top[field] = message;
      }
      if (hasServerCode(err, "WORKBOOK_ROLES_REQUIRED")) top.visibility_roles = t("visibility.rolesRequired");
      setFieldErrors(top);
      setColumnErrors(cols);
      if (Object.keys(top).length === 0 && Object.keys(cols).length === 0) {
        const message = errorText(err, workbook ? workbook.breadcrumb : folder ? [...folder.breadcrumb, { id: folder.id, name: folder.name }] : []);
        setFormError(message);
        toast.error(message);
        scrollTop();
      } else if (top.name) {
        scrollTop();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        ref={bodyRef}
        size={mode === "create" ? "lg" : "md"}
        busy={saving}
        title={mode === "create" ? t("workbookForm.createTitle") : t("workbookForm.editTitle")}
        description={
          mode === "create" && folder ? t("workbookForm.createDescription", { folder: folder.name }) : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {mode === "create"
                ? saving ? t("common.creating") : t("common.create")
                : saving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <FormError message={formError} />

          <section className="space-y-3">
            <SectionLabel>{t("workbookForm.stepDetails")}</SectionLabel>
            <Field label={t("workbookForm.name")} htmlFor="wb-name" required error={fieldErrors.name}>
              <Input
                id="wb-name"
                value={name}
                maxLength={255}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workbookForm.namePlaceholder")}
                aria-invalid={Boolean(fieldErrors.name) || undefined}
              />
            </Field>
            <Field label={t("workbookForm.description")} htmlFor="wb-description" error={fieldErrors.description}>
              <Textarea
                id="wb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("common.optional")}
                className="min-h-16 resize-none"
                rows={2}
              />
            </Field>
          </section>

          {mode === "create" && (
            <>
              <section className="space-y-3 border-t pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <SectionLabel>{t("workbookForm.stepColumns")}</SectionLabel>
                  <span className="text-[11px] text-muted-foreground">{t("workbookForm.columnsHint")}</span>
                </div>
                {fieldErrors.columns && <FormError message={fieldErrors.columns} />}
                <ColumnEditor
                  drafts={columns}
                  onChange={(next) => {
                    setColumns(next);
                    setFieldErrors((e) => ({ ...e, columns: "" }));
                  }}
                  columnTypes={columnTypes}
                  errors={columnErrors}
                  disabled={saving || optionsLoading}
                />
              </section>

              <section className="space-y-3 border-t pt-4">
                <SectionLabel>{t("workbookForm.stepAccess")}</SectionLabel>
                <VisibilityFields
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setFieldErrors((e) => ({ ...e, visibility_roles: "" }));
                  }}
                  options={visibilities}
                  loading={optionsLoading}
                  parent={
                    folder
                      ? {
                          name: folder.name,
                          visibility: folder.visibility,
                          visibilityLabel: folder.visibilityLabel,
                          roles: folder.visibilityRoles,
                        }
                      : null
                  }
                  rolesError={fieldErrors.visibility_roles || null}
                  visibilityError={fieldErrors.visibility || null}
                  disabled={saving}
                  idPrefix="wb-vis"
                />
              </section>
            </>
          )}
        </div>
      </DialogShell>
    </Dialog>
  );
}
