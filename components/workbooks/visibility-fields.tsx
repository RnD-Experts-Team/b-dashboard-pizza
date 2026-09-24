"use client";

import { AlertTriangle, CornerLeftUp, Eye, Info, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeRoles, sharedRoles } from "@/lib/workbooks/roles";
import type { VisibilityOption, VisibilityPayload } from "@/types/workbooks.types";
import { ChipInput } from "./chip-input";
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
}: VisibilityFieldsProps) {
  const t = useTranslations("workbooks.visibility");
  const selected = options.find((o) => o.value === value.visibility);
  const needsRoles = Boolean(selected?.needsRoles);

  const parentRoles = parent?.roles ?? null;
  const overlap = needsRoles && parentRoles ? sharedRoles(normalizeRoles(value.roles), parentRoles) : null;

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
          <Label htmlFor={`${idPrefix}-roles`} className="text-xs">
            {t("rolesLabel")} <span className="text-destructive">*</span>
          </Label>
          <ChipInput
            id={`${idPrefix}-roles`}
            value={value.roles}
            onChange={(roles) => onChange({ ...value, roles })}
            placeholder={t("rolesPlaceholder")}
            addLabel={t("rolesAdd")}
            removeLabel={(role) => t("rolesRemove", { role })}
            invalid={Boolean(rolesError)}
            disabled={disabled}
          />
          {rolesError && <p className="text-[11px] text-destructive">{rolesError}</p>}
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            <li className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
              {t("rolesHintExact")}
            </li>
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
