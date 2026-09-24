"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderTree, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import { useWorkbooksStore } from "@/lib/store/workbooks.store";
import { getWorkbookFieldErrors, hasServerCode, isCancelled } from "@/lib/workbooks/errors";
import type { WorkbookFolder } from "@/types/workbooks.types";
import { DialogShell, Field, FormError } from "./dialog-shell";
import {
  VisibilityFields,
  toVisibilityPayload,
  visibilityDraftError,
  type VisibilityDraft,
} from "./visibility-fields";

const ROOT = "root";

interface FolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** create: where it goes by default. edit: ignored. */
  parent?: WorkbookFolder | null;
  /** edit: the folder being edited. */
  folder?: WorkbookFolder | null;
  storeCode: string | null;
  onSaved: (folder: WorkbookFolder, previousParentId: number | null) => void;
}

/** "Operations / Openings / Morning" from the flat list's parent links. */
function buildPaths(folders: WorkbookFolder[]): Map<number, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const paths = new Map<number, string>();
  const pathOf = (f: WorkbookFolder, guard = 0): string => {
    const cached = paths.get(f.id);
    if (cached) return cached;
    const parent = f.parentId != null ? byId.get(f.parentId) : undefined;
    const p = parent && guard < 50 ? `${pathOf(parent, guard + 1)} / ${f.name}` : f.name;
    paths.set(f.id, p);
    return p;
  };
  folders.forEach((f) => pathOf(f));
  return paths;
}

/** The folder and everything under it — a move target there is a cycle. */
function subtreeIds(rootId: number, folders: WorkbookFolder[]): Set<number> {
  const out = new Set<number>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId != null && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export function FolderFormDialog({
  open,
  onOpenChange,
  mode,
  parent,
  folder,
  storeCode,
  onSaved,
}: FolderFormDialogProps) {
  const t = useTranslations("workbooks");
  const { visibilities, loading: optionsLoading } = useWorkbookOptions();
  const allFolders = useWorkbooksStore((s) => s.allFolders);
  const allFoldersLoading = useWorkbooksStore((s) => s.allFoldersLoading);
  const loadAllFolders = useWorkbooksStore((s) => s.loadAllFolders);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentValue, setParentValue] = useState<string>(ROOT);
  // New folders default to owner_only and do NOT inherit the parent's tag —
  // inheriting would publish things by accident. So the picker is always shown.
  const [draft, setDraft] = useState<VisibilityDraft>({ visibility: "owner_only", roles: [] });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormError(null);
    if (mode === "edit" && folder) {
      setName(folder.name);
      setDescription(folder.description ?? "");
      setParentValue(folder.parentId != null ? String(folder.parentId) : ROOT);
    } else {
      setName("");
      setDescription("");
      setParentValue(parent ? String(parent.id) : ROOT);
      setDraft({ visibility: "owner_only", roles: [] });
    }
    if (!allFolders) void loadAllFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, folder?.id, parent?.id]);

  const parentOptions = useMemo<SearchableSelectOption<string>[]>(() => {
    const list = allFolders ?? [];
    const paths = buildPaths(list);
    const blocked = mode === "edit" && folder ? subtreeIds(folder.id, list) : new Set<number>();
    const opts: SearchableSelectOption<string>[] = [{ value: ROOT, label: t("folderForm.parentRoot") }];
    for (const f of list) {
      opts.push({
        value: String(f.id),
        label: paths.get(f.id) ?? f.name,
        disabled: blocked.has(f.id),
        hint: blocked.has(f.id) ? t("folderForm.insideItself") : undefined,
      });
    }
    // The current parent may not be in a searched/partial list — keep it pickable.
    if (parent && !list.some((f) => f.id === parent.id)) {
      opts.push({ value: String(parent.id), label: parent.name });
    }
    return opts.sort((a, b) => (a.value === ROOT ? -1 : b.value === ROOT ? 1 : a.label.localeCompare(b.label)));
  }, [allFolders, mode, folder, parent, t]);

  const chosenParent = useMemo(() => {
    if (parentValue === ROOT) return null;
    const id = Number(parentValue);
    return (allFolders ?? []).find((f) => f.id === id) ?? (parent?.id === id ? parent : null);
  }, [parentValue, allFolders, parent]);

  const submit = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t("folderForm.nameRequired");
    if (mode === "create" && visibilityDraftError(draft, visibilities)) {
      errors.visibility_roles = t("visibility.rolesRequired");
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setFormError(null);
    const parentId = parentValue === ROOT ? null : Number(parentValue);
    try {
      let saved: WorkbookFolder;
      if (mode === "create") {
        saved = await workbooksService.createFolder(storeCode, {
          name: name.trim(),
          description: description.trim() || null,
          parent_id: parentId,
          ...toVisibilityPayload(draft, visibilities),
        });
        toast.success(t("folderForm.created"));
        onSaved(saved, parentId);
      } else if (folder) {
        // Partial: send only what changed.
        const payload: Record<string, unknown> = {};
        if (name.trim() !== folder.name) payload.name = name.trim();
        if ((description.trim() || null) !== (folder.description ?? null)) payload.description = description.trim() || null;
        if (parentId !== folder.parentId) payload.parent_id = parentId;
        if (Object.keys(payload).length === 0) {
          onOpenChange(false);
          return;
        }
        saved = await workbooksService.updateFolder(folder.id, payload);
        toast.success(payload.parent_id !== undefined ? t("folderForm.moved") : t("folderForm.updated"));
        onSaved(saved, folder.parentId);
      }
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getWorkbookFieldErrors(err);
      if (hasServerCode(err, "WORKBOOK_FOLDER_CYCLE")) {
        fields.parent_id = t("folderForm.cycle");
      } else if (hasServerCode(err, "WORKBOOK_FORBIDDEN") && parentId !== (folder?.parentId ?? parent?.id ?? null)) {
        // Moving/creating into a folder you can't edit.
        fields.parent_id = t("folderForm.parentForbidden");
      } else if (hasServerCode(err, "WORKBOOK_ROLES_REQUIRED")) {
        fields.visibility_roles = t("visibility.rolesRequired");
      }
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) {
        const message = err instanceof Error ? err.message : t("errors.title");
        setFormError(message);
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "edit"
      ? t("folderForm.editTitle")
      : parent
        ? t("folderForm.createSubTitle", { name: parent.name })
        : t("folderForm.createTitle");

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        busy={saving}
        title={title}
        description={mode === "create" ? t("folderForm.noInherit") : undefined}
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
        <div className="space-y-4">
          <FormError message={formError} />
          <Field label={t("folderForm.name")} htmlFor="folder-name" required error={fieldErrors.name}>
            <Input
              id="folder-name"
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("folderForm.namePlaceholder")}
              aria-invalid={Boolean(fieldErrors.name) || undefined}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </Field>
          <Field
            label={t("folderForm.description")}
            htmlFor="folder-description"
            error={fieldErrors.description}
          >
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.optional")}
              className="min-h-16 resize-none"
              rows={2}
            />
          </Field>
          <Field
            label={t("folderForm.parent")}
            hint={t("folderForm.parentHint")}
            error={fieldErrors.parent_id}
          >
            <SearchableSelect<string>
              options={parentOptions}
              value={parentValue}
              onChange={(v) => {
                setParentValue(v);
                setFieldErrors((e) => ({ ...e, parent_id: "" }));
              }}
              placeholder={t("folderForm.parentPlaceholder")}
              searchPlaceholder={t("folderForm.parentSearch")}
              emptyText={t("common.noResults")}
              loading={allFoldersLoading && !allFolders}
              icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          </Field>

          {mode === "create" && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("visibility.title")}
              </p>
              <VisibilityFields
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  setFieldErrors((e) => ({ ...e, visibility_roles: "" }));
                }}
                options={visibilities}
                loading={optionsLoading}
                parent={
                  chosenParent
                    ? {
                        name: chosenParent.name,
                        visibility: chosenParent.visibility,
                        visibilityLabel: chosenParent.visibilityLabel,
                        roles: chosenParent.visibilityRoles,
                      }
                    : null
                }
                rolesError={fieldErrors.visibility_roles || null}
                visibilityError={fieldErrors.visibility || null}
                disabled={saving}
                idPrefix="folder-vis"
              />
            </div>
          )}
        </div>
      </DialogShell>
    </Dialog>
  );
}
