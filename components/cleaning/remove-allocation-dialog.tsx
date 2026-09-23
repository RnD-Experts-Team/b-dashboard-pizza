"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Lock, Trash2 } from "lucide-react";
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
  AllocationRemoveRequest,
  AllocationRemoveResponse,
  PeriodType,
} from "@/types/cleaning.types";

export interface RemoveTarget {
  storeId: number;
  store: string;
  /** The absent task selected in the Allocate dialog when Remove was opened,
   *  if any — powers the optional "only remove this one" scope. Null means
   *  the only available scope is "clear everything". */
  task: { taskId: number; name: string } | null;
}

interface RemoveStoreOption {
  storeId: number;
  store: string;
  finalizedAt: string | null;
  /** Distinct source tasks with a saved split — shown next to the name. */
  splitCount: number;
}

/** 1–50 store ids per request (remove-button guide §1). */
const MAX_STORES = 50;

export function RemoveAllocationDialog({
  target,
  periodType,
  periodKey,
  stores,
  onOpenChange,
  onRemove,
}: {
  target: RemoveTarget | null;
  periodType: PeriodType;
  periodKey: string;
  /** Only stores that actually HAVE a split — offering the rest just returns
   *  `nothing_to_remove`. Unlike the copy picker this DOES include the store
   *  the auditor came from; the endpoint allows it. */
  stores: RemoveStoreOption[];
  onOpenChange: (open: boolean) => void;
  onRemove: (payload: AllocationRemoveRequest) => Promise<AllocationRemoveResponse>;
}) {
  const t = useTranslations("cleaningChart.removeAllocationDialog");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Unticked by default = clear EVERY split for the selected stores, which
  // is the "I copied by mistake" case the endpoint is built for (guide §1).
  const [onlyThisTask, setOnlyThisTask] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<AllocationRemoveResponse | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);

  useEffect(() => {
    // Never pre-tick stores for a delete (guide §2).
    setSelected(new Set());
    setOnlyThisTask(false);
    setResult(null);
    setResultKey(null);
    setPreviewing(false);
    setRemoving(false);
  }, [target]);

  // Scope is part of the key, not just the selection — switching "only this
  // task" on or off changes what gets deleted, so a preview taken before the
  // switch must not be applied after it (guide §2).
  const requestKey = useMemo(
    () => `${onlyThisTask ? "task" : "all"}:${Array.from(selected).sort((a, b) => a - b).join(",")}`,
    [selected, onlyThisTask]
  );
  const isStale = result != null && resultKey !== requestKey;
  const canApply = result != null && result.dryRun && !isStale && selected.size > 0;

  const selectableStores = useMemo(() => stores.filter((s) => s.finalizedAt == null), [stores]);
  const allSelected = selectableStores.length > 0 && selected.size === selectableStores.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleStore = (storeId: number, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else if (next.size < MAX_STORES) {
        next.add(storeId);
      } else {
        toast.error(t("maxStores", { max: MAX_STORES }));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    if (selectableStores.length > MAX_STORES) toast.error(t("maxStores", { max: MAX_STORES }));
    setSelected(new Set(selectableStores.slice(0, MAX_STORES).map((s) => s.storeId)));
  };

  const run = async (dryRun: boolean) => {
    if (!target || selected.size === 0) return;
    const setBusy = dryRun ? setPreviewing : setRemoving;
    setBusy(true);
    try {
      const response = await onRemove({
        store_ids: Array.from(selected),
        period_type: periodType,
        period_key: periodKey,
        ...(onlyThisTask && target.task ? { source_task_ids: [target.task.taskId] } : {}),
        dry_run: dryRun,
      });
      setResult(response);
      setResultKey(requestKey);
      if (!dryRun) {
        const removedTotal = response.results.reduce((sum, r) => sum + r.removed, 0);
        toast.success(t("removed", { count: removedTotal }));
        // Keep the dialog open when something was skipped, so the reason
        // stays readable instead of vanishing with the toast.
        if (!response.results.some((r) => r.skipped.length > 0)) onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && !removing && onOpenChange(false)}>
      <DialogContent className="max-h-[92vh] w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Guide §3 — this belongs in the modal itself, not a tooltip. */}
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("clearsNotUndoWarning")}</span>
          </p>

          {target?.task && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOnlyThisTask((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOnlyThisTask((v) => !v);
                }
              }}
              className="flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <Checkbox checked={onlyThisTask} className="pointer-events-none" />
              <span className="min-w-0 flex-1">
                {t("onlyThisTask", { task: target.task.name })}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {onlyThisTask && target?.task
              ? t("scopeSelectedTasks", { task: target.task.name })
              : t("scopeAllSplits")}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("storesLabel", { count: selected.size })}</Label>
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
              <p className="text-xs text-muted-foreground">{t("noStoresWithSplits")}</p>
            ) : (
              <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
                {stores.map((s) => {
                  const finalized = s.finalizedAt != null;
                  return (
                    <li key={s.storeId}>
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
                          "flex w-full select-none items-center gap-2 rounded px-2 py-1.5 text-start text-sm transition-colors",
                          finalized
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selected.has(s.storeId)}
                          disabled={finalized}
                          className="pointer-events-none"
                        />
                        <span className="min-w-0 flex-1 truncate">{s.store}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {t("splitCount", { count: s.splitCount })}
                        </span>
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
                          r.removed > 0 ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {t("removedCount", { count: r.removed })}
                      </span>
                    </div>
                    {r.splits.map((sp) => (
                      <p
                        key={sp.sourceTaskId}
                        className="flex items-start gap-1 text-xs text-muted-foreground"
                      >
                        <span className="shrink-0">·</span>
                        {t("splitDetail", {
                          task: sp.name,
                          amount: sp.amount,
                          targets: sp.targets,
                        })}
                      </p>
                    ))}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
            {t("close")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void run(true)}
            disabled={selected.size === 0 || previewing || removing}
          >
            {previewing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("preview")}
          </Button>
          {/* Destructive on purpose — must not read like the copy button. */}
          <Button
            variant="destructive"
            onClick={() => void run(false)}
            disabled={!canApply || removing}
          >
            {removing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("removeNow", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
