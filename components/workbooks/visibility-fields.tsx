"use client";

import { useMemo } from "react";
import { AlertTriangle, CornerLeftUp, Eye, Info, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeRoles, sharedRoles } from "@/lib/workbooks/roles";
import type { VisibilityOption, VisibilityPayload } from "@/types/workbooks.types";
import { MultiSelect, type MultiSelectOption } from "@/components/daily-pay/multi-select";
import { useMyStoreRoles } from "@/lib/hooks/use-my-store-roles";
import { VisibilityChip } from "./visibility-chip";
import { visibilityAccent } from "./visibility-accent";

export interface VisibilityDraft {
  visibility: string;
  roles: string[];
}

/** The tag an item already sits above — shown so "most restrictive wins" isn't a surprise. */
export interface ParentAccess {
  name: string;
  visibility: string;
  visibilityLabel: string;
  roles: string[] | null;
}

export function toVisibilityPayload(draft: VisibilityDraft, options: VisibilityOption[]): VisibilityPayload {
  const opt = options.find((o) => o.value === draft.visibility);
  return opt?.needsRoles
    ? { visibility: draft.visibility, visibility_roles: normalizeRoles(draft.roles) }
    : { visibility: draft.visibility };
}

/** Client check mirrors the server's WORKBOOK_ROLES_REQUIRED — nothing more. */
export function visibilityDraftError(draft: VisibilityDraft, options: VisibilityOption[]): "rolesRequired" | null {
  const opt = options.find((o) => o.value === draft.visibility);
  if (opt?.needsRoles && normalizeRoles(draft.roles).length === 0) return "rolesRequired";
  return null;
}

interface VisibilityFieldsProps {
  value: VisibilityDraft;
  onChange: (next: VisibilityDraft) => void;
  options: VisibilityOption[];
  loading?: boolean;
  parent?: ParentAccess | null;
  rolesError?: string | null;
  visibilityError?: string | null;
  disabled?: boolean;
  idPrefix?: string;
  /**
   * The store the ITEM belongs to, when it already exists (retagging). Roles are
   * matched at that store; the list shows the user's roles at the sidebar store,
   * so a difference is called out rather than left to mislead.
   */
  itemStore?: { storeNumber: string; name: string } | null;
}

/**
 * The one visibility editor, reused for folders, workbooks and rows — the
 * payload is identical for all three. Everything is rendered from the
 * catalogue: labels, `grants_edit`, `needs_roles`.
 */
export function VisibilityFields({
  value,
  onChange,
  options,
  loading,
  parent,
  rolesError,
  visibilityError,
  disabled,
  idPrefix = "vis",
  itemStore,
}: VisibilityFieldsProps) {
  const t = useTranslations("workbooks.visibility");
  const selected = options.find((o) => o.value === value.visibility);
  const needsRoles = Boolean(selected?.needsRoles);

  const parentRoles = parent?.roles ?? null;
  const overlap = needsRoles && parentRoles ? sharedRoles(normalizeRoles(value.roles), parentRoles) : null;

  // The user's own direct roles at the sidebar's store — picked, never typed.
  const { storeCode, storeName, roles: myRoles } = useMyStoreRoles();
  // Roles already on the item stay in the list (ticked, removable) even when the
  // viewer doesn't hold them, instead of being silently dropped on save.
  const roleOptions = useMemo<MultiSelectOption<string>[]>(() => {
    const mine = new Set(myRoles);
    const others = value.roles.filter((r) => !mine.has(r));
    return [
      ...myRoles.map((r) => ({ value: r, label: r })),
      ...others.map((r) => ({ value: r, label: r, hint: t("rolesNotYours") })),
    ];
  }, [myRoles, value.roles, t]);
  const itemStoreDiffers = Boolean(itemStore && storeCode && itemStore.storeNumber !== storeCode);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parent && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            <CornerLeftUp className="h-3 w-3" aria-hidden="true" />
            {t("parentTitle")}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{parent.name}</span>
            <VisibilityChip value={parent.visibility} label={parent.visibilityLabel} roles={parent.roles} />
          </div>
          <p className="mt-1.5 text-muted-foreground">{t("parentBody")}</p>
          {parentRoles && parentRoles.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              {t("parentRoles", { roles: parentRoles.join(", ") })}
            </p>
          )}
        </div>
      )}

      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const isSelected = opt.value === value.visibility;
          const accent = visibilityAccent(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange({ ...value, visibility: opt.value })}
              className={cn(
                "flex min-h-14 items-start gap-2.5 rounded-lg border p-2.5 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                isSelected ? accent.soft : "border-border bg-card hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected ? "border-primary" : "border-input",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full bg-primary transition-transform duration-150",
                    isSelected ? "scale-100" : "scale-0",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", isSelected && accent.text)}>{opt.label}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {opt.grantsEdit ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {opt.audienceLabel} · {opt.grantsEdit ? t("canEdit") : t("viewOnly")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {visibilityError && <p className="text-[11px] text-destructive">{visibilityError}</p>}

      {needsRoles && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 animate-in fade-in-0 slide-in-from-top-1">
          <div className="space-y-0.5">
            <span id={`${idPrefix}-roles-label`} className="block text-xs font-medium">
              {t("rolesLabel")} <span className="text-destructive">*</span>
            </span>
            <p className="text-[11px] text-muted-foreground">
              {storeName ? t("rolesOfStore", { store: storeName }) : t("rolesNoStore")}
            </p>
          </div>
          <div role="group" aria-labelledby={`${idPrefix}-roles-label`} className="space-y-2">
            <MultiSelect<string>
              options={roleOptions}
              selected={value.roles}
              onChange={(roles) => onChange({ ...value, roles })}
              placeholder={t("rolesPlaceholder")}
              searchPlaceholder={t("rolesSearch")}
              emptyText={t("rolesEmpty")}
              disabled={disabled || roleOptions.length === 0}
              className={cn(rolesError && "border-destructive")}
            />
            {value.roles.length > 0 && (
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                {value.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[11px] animate-in fade-in-0 zoom-in-95"
                  >
                    {role}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...value, roles: value.roles.filter((r) => r !== role) })}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={t("rolesRemove", { role })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {roleOptions.length === 0 && (
            <p className="flex gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {storeCode ? t("rolesNone", { store: storeName ?? storeCode }) : t("rolesNoStore")}
            </p>
          )}
          {itemStoreDiffers && itemStore && (
            <p className="flex gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t("rolesItemStoreNote", {
                item: itemStore.name || itemStore.storeNumber,
                store: storeName ?? storeCode ?? "",
              })}
            </p>
          )}
          {rolesError && <p className="text-[11px] text-destructive">{rolesError}</p>}
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            <li className="flex gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t("rolesHintHierarchy")}
            </li>
            <li className="flex gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t("rolesHintDelay")}
            </li>
          </ul>
          {overlap && value.roles.length > 0 && (
            overlap.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">{t("sharedRoles", { roles: overlap.join(", ") })}</p>
            ) : (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                {t("noSharedRoles")}
              </p>
            )
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{t("ownerNote")}</p>
    </div>
  );
}
