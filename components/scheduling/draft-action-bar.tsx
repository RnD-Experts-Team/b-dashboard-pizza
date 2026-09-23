"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Save / Cancel bar for unsaved shifts.
 *
 * Mounted OUTSIDE `gridRef` on purpose: the screenshot and publish handlers
 * capture that element, and this bar has no business appearing in the PNG that
 * goes up in the store.
 *
 * Styled on the Apply-bar in `components/maintenance-tickets/tickets-filters.tsx`
 * and the pending-count badge convention in
 * `components/hiring/reference-catalog-dialog.tsx`.
 */

interface DraftActionBarProps {
  count: number;
  /** `replace` only comes from Copy Previous Week, and it needs saying out loud. */
  saveMode: "merge" | "replace";
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function DraftActionBar({
  count,
  saveMode,
  isSaving,
  onSave,
  onCancel,
}: DraftActionBarProps) {
  if (count === 0) return null;
  const isReplace = saveMode === "replace";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5",
        isReplace
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <Badge
        variant="secondary"
        className="h-5 shrink-0 px-1.5 text-[11px] tabular-nums"
      >
        +{count}
      </Badge>

      <div className="min-w-48 flex-1">
        <p className="text-xs font-medium">
          {count} shift{count !== 1 ? "s" : ""} not scheduled yet
        </p>
        <p className="text-[11px] text-muted-foreground">
          {isReplace ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <TriangleAlert className="h-3 w-3 shrink-0" />
              Saving replaces everything currently in this week.
            </span>
          ) : (
            "Overlaps and overtime are checked when you save."
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 max-sm:w-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="me-1 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="me-1 h-3.5 w-3.5" />
          )}
          {isSaving ? "Saving…" : `Save ${count} shift${count !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
