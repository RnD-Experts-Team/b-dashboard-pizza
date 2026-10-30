"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService, useTechnicianCategories } from "@/lib/hooks/use-maintenance-catalog";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import type { TechnicianCategory } from "@/types/maintenance-v2";

const SKELETON_ROWS = 3;

function messageOf(err: unknown, fallback: string): string {
  const fields = getTicketsFieldErrors(err);
  return fields.name ?? (err instanceof MaintenanceTicketsError ? err.message : fallback);
}

/**
 * The editable list of technician categories (In-house, Company,
 * Independent…): rename in place, add, delete. Names are unique the backend's
 * way (case and repeated spaces ignored), checked while typing.
 */
export function CategoryManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After any change, so the caller's category list reloads. */
  onChanged?: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { categories, isLoading, error, refresh, setData } = useTechnicianCategories(open);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TechnicianCategory | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (open) {
      setNewName("");
      setAddError(null);
    }
  }, [open]);

  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const clash = findNameClash(newName, categories);
  const shownAddError = clash ? t("names.duplicateCategory", { name: tidyName(clash.name) }) : addError;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = tidyName(newName);
    if (!name || clash) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await maintenanceCatalogService.createCategory({ name });
      setData((prev) => [...(prev ?? []), created]);
      setNewName("");
      toast.success(t("technicians.categoryAdded", { name: created.name }));
      onChanged?.();
    } catch (err) {
      setAddError(messageOf(err, t("common.saveError")));
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await maintenanceCatalogService.deleteCategory(deleting.id);
      setData((prev) => (prev ?? []).filter((c) => c.id !== deleting.id));
      toast.success(t("technicians.categoryDeleted", { name: deleting.name }));
      onChanged?.();
      setDeleting(null);
    } catch (err) {
      toast.error(messageOf(err, t("common.saveError")));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("technicians.manageCategories")}</DialogTitle>
            <DialogDescription>{t("technicians.categoriesHelp")}</DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {error && !isLoading && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span>{error.message}</span>
              <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
            </div>
          )}

          {!isLoading && !error && (
            <ul className="divide-y rounded-md border">
              {sorted.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t("technicians.noCategories")}</li>}
              {sorted.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  all={categories}
                  onSaved={(saved) => {
                    setData((prev) => (prev ?? []).map((x) => (x.id === saved.id ? { ...x, ...saved } : x)));
                    onChanged?.();
                  }}
                  onDelete={() => setDeleting(c)}
                />
              ))}
            </ul>
          )}

          <form onSubmit={add} className="space-y-1.5">
            <label htmlFor="new-category" className="text-sm font-medium">{t("technicians.newCategory")}</label>
            <div className="flex gap-2">
              <Input
                id="new-category"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddError(null);
                }}
                placeholder={t("technicians.newCategoryPlaceholder")}
                aria-invalid={Boolean(shownAddError)}
                aria-describedby={shownAddError ? "new-category-error" : undefined}
              />
              <Button type="submit" disabled={adding || !tidyName(newName) || Boolean(clash)}>
                {adding ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />}
                {t("common.add")}
              </Button>
            </div>
            {shownAddError && <p id="new-category-error" role="alert" className="text-xs font-medium text-destructive">{shownAddError}</p>}
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && !deletePending && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("technicians.deleteCategoryTitle", { name: deleting?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("technicians.deleteCategoryBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deletePending}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {deletePending && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CategoryRow({
  category,
  all,
  onSaved,
  onDelete,
}: {
  category: TechnicianCategory;
  all: TechnicianCategory[];
  onSaved: (saved: TechnicianCategory) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clash = findNameClash(name, all, category.id);
  const shownError = clash ? t("names.duplicateCategory", { name: tidyName(clash.name) }) : error;
  const inputId = `category-${category.id}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const tidy = tidyName(name);
    if (!tidy || clash) return;
    if (tidy === category.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await maintenanceCatalogService.updateCategory(category.id, { name: tidy });
      onSaved(saved);
      toast.success(t("technicians.categorySaved", { name: saved.name }));
      setEditing(false);
    } catch (err) {
      setError(messageOf(err, t("common.saveError")));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{category.name}</span>
          {category.techniciansCount != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("technicians.technicianCount", { count: category.techniciansCount })}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={t("technicians.renameCategory", { name: category.name })}
            onClick={() => {
              setName(category.name);
              setError(null);
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label={t("technicians.deleteCategory", { name: category.name })}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </span>
      </li>
    );
  }

  return (
    <li className="px-3 py-2">
      <form onSubmit={save} className="space-y-1">
        <label htmlFor={inputId} className="sr-only">{t("common.name")}</label>
        <div className="flex items-center gap-1">
          <Input
            id={inputId}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              // Escape cancels the rename, not the whole dialog.
              e.stopPropagation();
              setEditing(false);
            }}
            autoFocus
            className="h-8"
            aria-invalid={Boolean(shownError)}
            aria-describedby={shownError ? `${inputId}-error` : undefined}
          />
          <Button type="submit" size="icon" className="h-8 w-8" disabled={saving || !tidyName(name) || Boolean(clash)} aria-label={t("common.save")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)} disabled={saving} aria-label={t("common.cancel")}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {shownError && <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-destructive">{shownError}</p>}
      </form>
    </li>
  );
}
