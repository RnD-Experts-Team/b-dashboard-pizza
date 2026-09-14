"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import type {
  AllocationCopyRequest,
  AllocationCopyResponse,
  PeriodType,
} from "@/types/cleaning.types";

export interface CopyTarget {
  storeId: number;
  store: string;
}

interface StorePickerOption {
  storeId: number;
  store: string;
  finalizedAt: string | null;
}

/** Up to 50 targets per request (guide §3). */
const MAX_TARGETS = 50;

export function CopyAllocationDialog({
  sourceTarget,
  periodType,
  periodKey,
  stores,
  onOpenChange,
  onCopy,
}: {
  sourceTarget: CopyTarget | null;
  periodType: PeriodType;
  periodKey: string;
  stores: StorePickerOption[];
  onOpenChange: (open: boolean) => void;
  onCopy: (payload: AllocationCopyRequest) => Promise<AllocationCopyResponse>;
}) {
  const t = useTranslations("cleaningChart.copyAllocationDialog");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState<AllocationCopyResponse | null>(null);
  // The exact selection a preview/copy was run for — if the selection
  // changes afterwards, the result is stale and must not be trusted for
  // "Copy now" (guide §3: it always previews the CURRENT selection first).
  const [resultSelectionKey, setResultSelectionKey] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set());
    setResult(null);
    setResultSelectionKey(null);
    setPreviewing(false);
    setCopying(false);
  }, [sourceTarget]);

  const selectionKey = useMemo(
    () => Array.from(selected).sort((a, b) => a - b).join(","),
    [selected]
  );
  const isStale = result != null && resultSelectionKey !== selectionKey;
  const canCopyNow = result != null && result.dryRun && !isStale && selected.size > 0;

  // Finalized stores are never selectable (the server skips them anyway) —
  // "select all" only ever means "all selectable ones", not literally every row.
  const selectableStores = useMemo(() => stores.filter((s) => s.finalizedAt == null), [stores]);
  const allSelected =
    selectableStores.length > 0 && selected.size === selectableStores.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleStore = (storeId: number, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else if (next.size < MAX_TARGETS) {
        next.add(storeId);
      } else {
        toast.error(t("maxTargets", { max: MAX_TARGETS }));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    if (selectableStores.length > MAX_TARGETS) {
      toast.error(t("maxTargets", { max: MAX_TARGETS }));
    }
    setSelected(new Set(selectableStores.slice(0, MAX_TARGETS).map((s) => s.storeId)));
  };

  const runCopy = async (dryRun: boolean) => {
    if (!sourceTarget || selected.size === 0) return;
    const setBusy = dryRun ? setPreviewing : setCopying;
    setBusy(true);
    try {
      const response = await onCopy({
        source_store_id: sourceTarget.storeId,
        target_store_ids: Array.from(selected),
        period_type: periodType,
        period_key: periodKey,
        dry_run: dryRun,
      });
      setResult(response);
      setResultSelectionKey(selectionKey);
      if (!dryRun) {
        const copiedTotal = response.results.reduce((sum, r) => sum + r.copied, 0);
        toast.success(t("copied", { count: copiedTotal }));
        // Guide §3: "show every skip reason" — only close automatically when
        // there's nothing left to review. If any store was skipped, keep the
        // dialog open on the results so that reason isn't just a toast that
        // already scrolled away.
        const hasSkips = response.results.some((r) => r.skipped.length > 0);
        if (!hasSkips) onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={sourceTarget != null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-h-[92vh] w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { store: sourceTarget?.store ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5">
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {t("wholeSplitWarning")}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("targetStoresLabel", { count: selected.size })}</Label>
              {selectableStores.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggleAll}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAll();
                    }
                  }}
                  className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    className="pointer-events-none h-3.5 w-3.5"
                  />
                  {allSelected ? t("deselectAll") : t("selectAll")}
                </div>
              )}
            </div>
            {stores.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noOtherStores")}</p>
            ) : (
              <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
                {stores.map((s) => {
                  const finalized = s.finalizedAt != null;
                  return (
                    <li key={s.storeId}>
                      {/* A `role="button"` div, not a real <button> — the
                          shadcn Checkbox below already renders as a
                          <button role="checkbox">, and HTML forbids nesting
                          a button inside a button (same pattern as the
                          existing hiring/store-multi-select.tsx rows). */}
                      <div
                        role="button"
                        tabIndex={finalized ? -1 : 0}
                        aria-disabled={finalized}
                        title={finalized ? t("finalizedNote") : undefined}
                        onClick={() => toggleStore(s.storeId, finalized)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleStore(s.storeId, finalized);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm transition-colors select-none",
                          finalized ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selected.has(s.storeId)}
                          disabled={finalized}
                          className="pointer-events-none"
                        />
                        <span className="min-w-0 flex-1 truncate">{s.store}</span>
                        {finalized && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{result.dryRun ? t("previewLabel") : t("resultLabel")}</Label>
                {isStale && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    {t("staleNotice")}
                  </span>
                )}
              </div>
              <ul className="space-y-2 rounded-md border p-2 text-sm">
                {result.results.map((r) => (
                  <li key={r.storeId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.store}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold tabular-nums",
                          r.copied > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {t("copiedCount", { count: r.copied })}
                      </span>
                    </div>
                    {r.splits.some((sp) => sp.replacesExisting) && (
                      <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {t("replacesExistingWarning")}
                      </p>
                    )}
                    {r.skipped.map((sk, i) => (
                      <p key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                        <span className="shrink-0">·</span>
                        {t(`skipReasons.${sk.reason}`)}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={copying}>
            {t("close")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void runCopy(true)}
            disabled={selected.size === 0 || previewing || copying}
          >
            {previewing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("preview")}
          </Button>
          <Button onClick={() => void runCopy(false)} disabled={!canCopyNow || copying}>
            {copying && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("copyNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
