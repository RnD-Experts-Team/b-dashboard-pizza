"use client";

import { Info, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Breadcrumb, CappedBy } from "@/types/workbooks.types";

/**
 * "You can't edit this" with no reason is a support ticket every time. This
 * turns `effective_visibility.capped_by` into the sentence the user can act on:
 * *the folder Openings is view-only*.
 */
export function useCappedText() {
  const t = useTranslations("workbooks.capped");
  return (capped: CappedBy | null | undefined, breadcrumb: Breadcrumb[] = []): string | null => {
    if (!capped) return null;
    const name = breadcrumb.find((b) => b.id === capped.id)?.name;
    const label = capped.visibilityLabel ?? capped.visibility;
    if (capped.type === "workbook") {
      return name ? t("workbook", { name, label }) : t("workbookUnnamed", { label });
    }
    return name ? t("folder", { name, label }) : t("folderUnnamed", { label });
  };
}

interface AccessNoteProps {
  capped: CappedBy | null | undefined;
  breadcrumb?: Breadcrumb[];
  /** Shown when nothing above capped it but the item is still read-only. */
  readOnly?: boolean;
  className?: string;
}

/** Amber note under a header when the viewer can see but not change something. */
export function AccessNote({ capped, breadcrumb, readOnly, className }: AccessNoteProps) {
  const t = useTranslations("workbooks.capped");
  const cappedText = useCappedText()(capped, breadcrumb);
  if (!cappedText && !readOnly) return null;

  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 animate-in fade-in-0 dark:text-amber-300",
        className,
      )}
    >
      {cappedText ? (
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{cappedText ?? t("readOnly")}</p>
        {cappedText && <p className="opacity-90">{t("escapeHatch")}</p>}
      </div>
    </div>
  );
}
