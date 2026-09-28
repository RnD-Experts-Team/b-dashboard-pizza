"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import { checkCellInput, toEditorValue, toWireValue } from "@/lib/workbooks/cells";
import { getWorkbookFieldErrors, isCancelled, readCellMismatch } from "@/lib/workbooks/errors";
import type { Workbook, WorkbookColumn, WorkbookRow } from "@/types/workbooks.types";
import { DialogShell, Field, FormError } from "./dialog-shell";
import { useErrorText } from "./guarded";
import {
  VisibilityFields,
  toVisibilityPayload,
  visibilityDraftError,
  type VisibilityDraft,
} from "./visibility-fields";

const EMPTY = "__empty__";

interface RowFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workbook: Workbook;
  columns: WorkbookColumn[];
  /** Edit when given; add otherwise. */
  row?: WorkbookRow | null;
  storeCode: string | null;
  storeName: string | null;
  onSaved: (row: WorkbookRow, created: boolean) => void;
}

/**
 * The full-row form. Add posts to /stores/{code}/workbooks/{id}/rows — the
 * row records THAT store, which need not be the workbook's. Edit is partial:
 * only changed cells are sent.
 */
export function RowFormDialog({
  open,
  onOpenChange,
  workbook,
  columns,
  row,
  storeCode,
  storeName,
  onSaved,
}: RowFormDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const { visibilities, loading: optionsLoading } = useWorkbookOptions();
  const bodyRef = useRef<HTMLDivElement>(null);
  const isEdit = Boolean(row);

  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<VisibilityDraft>({ visibility: "owner_only", roles: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    for (const c of columns) init[String(c.id)] = row ? toEditorValue(c, row.cells[String(c.id)] ?? null) : "";
    setValues(init);
    // A new row starts with the workbook's own tag, so it reaches the same people.
    setDraft({ visibility: workbook.visibility, roles: workbook.visibilityRoles ?? [] });
    setErrors({});
    setFormError(null);
    setAllowed({});
  }, [open, row, columns, workbook.visibility, workbook.visibilityRoles]);

  const set = (id: number, v: string) => {
    setValues((prev) => ({ ...prev, [String(id)]: v }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  };

  const submit = async () => {
    const local: Record<string, string> = {};
    for (const c of columns) {
      const problem = checkCellInput(
        { ...c, options: allowed[String(c.id)] ?? c.options },
        values[String(c.id)] ?? "",
      );
      if (problem) local[String(c.id)] = t(`cell.${problem}`);
    }
    if (!isEdit && visibilityDraftError(draft, visibilities)) local.visibility_roles = t("visibility.rolesRequired");
    setErrors(local);
    if (Object.keys(local).length) {
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const cells: Record<string, string | null> = {};
    for (const c of columns) {
      const key = String(c.id);
      const next = values[key] ?? "";
      if (isEdit && row) {
        if (next.trim() === toEditorValue(c, row.cells[key] ?? null).trim()) continue;
      }
      cells[key] = toWireValue(next);
    }
    if (isEdit && Object.keys(cells).length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const saved =
        isEdit && row
          ? await workbooksService.updateRow(workbook.id, row.id, { cells })
          : await workbooksService.createRow(storeCode, workbook.id, {
              cells,
              ...toVisibilityPayload(draft, visibilities),
            });
      toast.success(isEdit ? t("grid.rowUpdated") : t("grid.rowCreated"));
      onSaved(saved, !isEdit);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const next: Record<string, string> = {};
      const mismatch = readCellMismatch(err);
      if (mismatch?.columnId != null) {
        next[String(mismatch.columnId)] = mismatch.message;
        if (mismatch.allowed?.length) {
          setAllowed((a) => ({ ...a, [String(mismatch.columnId)]: mismatch.allowed! }));
        }
      }
      for (const [field, message] of Object.entries(getWorkbookFieldErrors(err))) {
        const m = field.match(/^cells\.(\d+)/);
        if (m) next[m[1]] = message;
        else if (field.startsWith("visibility")) next.visibility_roles = message;
        else next._form = message;
      }
      const formMsg = next._form ?? (Object.keys(next).length === 0 ? (errorText(err, [...workbook.breadcrumb, { id: workbook.id, name: workbook.name }])) : null);
      delete next._form;
      setErrors(next);
      if (formMsg) {
        setFormError(formMsg);
        toast.error(formMsg);
        bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        ref={bodyRef}
        busy={saving}
        title={isEdit ? t("rowForm.editTitle") : t("rowForm.createTitle")}
        description={
          isEdit
            ? t("rowForm.editDescription")
            : storeName
              ? t("rowForm.createDescription", { store: storeName })
              : t("rowForm.description")
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {saving ? t("common.saving") : isEdit ? t("common.save") : t("grid.addRow")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {columns.map((c) => {
              const key = String(c.id);
              const v = values[key] ?? "";
              const id = `row-field-${c.id}`;
              const opts = allowed[key] ?? c.options ?? [];
              return (
                <Field
                  key={c.id}
                  label={c.name}
                  htmlFor={id}
                  required={c.required}
                  hint={c.typeLabel ?? undefined}
                  error={errors[key]}
                  className={c.type === "long_text" ? "sm:col-span-2" : undefined}
                >
                  {c.type === "long_text" ? (
                    <Textarea id={id} value={v} onChange={(e) => set(c.id, e.target.value)} className="h-28 resize-none" />
                  ) : c.type === "date" ? (
                    <DatePicker value={v} onChange={(nv) => set(c.id, nv)} />
                  ) : c.type === "boolean" ? (
                    <div className="flex h-9 gap-1" role="group" aria-label={c.name}>
                      {(c.required ? [] : [{ v: "", label: t("cell.empty") }])
                        .concat([
                          { v: "true", label: t("common.yes") },
                          { v: "false", label: t("common.no") },
                        ])
                        .map((o) => (
                          <button
                            key={o.v || "empty"}
                            type="button"
                            aria-pressed={v === o.v}
                            onClick={() => set(c.id, o.v)}
                            className={
                              v === o.v
                                ? "inline-flex flex-1 items-center justify-center rounded-lg border border-primary bg-primary/10 px-2 text-xs font-medium transition-colors"
                                : "inline-flex flex-1 items-center justify-center rounded-lg border bg-card px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            }
                          >
                            {o.label}
                          </button>
                        ))}
                    </div>
                  ) : c.type === "select" ? (
                    <SearchableSelect<string>
                      options={[
                        ...(c.required ? [] : [{ value: EMPTY, label: t("cell.empty") }]),
                        ...opts.map((o) => ({ value: o, label: o })),
                      ]}
                      value={v === "" ? (c.required ? "" : EMPTY) : v}
                      onChange={(nv) => set(c.id, nv === EMPTY ? "" : nv)}
                      placeholder={t("cell.pick")}
                      searchPlaceholder={t("common.search")}
                      emptyText={t("common.noResults")}
                    />
                  ) : (
                    <Input
                      id={id}
                      value={v}
                      inputMode={c.type === "number" ? "decimal" : undefined}
                      onChange={(e) => set(c.id, e.target.value)}
                      aria-invalid={Boolean(errors[key]) || undefined}
                      className={c.type === "number" ? "tabular-nums" : undefined}
                    />
                  )}
                </Field>
              );
            })}
          </div>

          {!isEdit && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("rowForm.accessTitle")}
              </p>
              <VisibilityFields
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  setErrors((e) => ({ ...e, visibility_roles: "" }));
                }}
                options={visibilities}
                loading={optionsLoading}
                parent={{
                  name: workbook.name,
                  visibility: workbook.visibility,
                  visibilityLabel: workbook.visibilityLabel,
                  roles: workbook.visibilityRoles,
                }}
                rolesError={errors.visibility_roles || null}
                disabled={saving}
                idPrefix="row-vis"
              />
            </div>
          )}
        </div>
      </DialogShell>
    </Dialog>
  );
}
