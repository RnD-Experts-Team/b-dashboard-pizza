"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import type { AbsentTask, Allocation, EvalRow } from "@/types/cleaning.types";

export interface AllocateTarget {
  storeId: number;
  store: string;
  row: EvalRow;
}

/** Flatten the four chart groups into one "in-play this period" task list —
 *  the only valid allocation targets (guide §11: a target must be a task in
 *  play this period, and a task cannot receive its own weight — absent tasks
 *  and in-play tasks are disjoint sets by construction, so no self-target
 *  check is needed here). */
function inPlayTasks(row: EvalRow): { taskId: number; name: string }[] {
  const seen = new Map<number, string>();
  for (const group of [row.chart.daily, row.chart.weekly, row.chart.monthly, row.chart.hourly]) {
    for (const cell of group) seen.set(cell.taskId, cell.name);
  }
  return Array.from(seen, ([taskId, name]) => ({ taskId, name }));
}

/** Group existing allocations by source task, for the "current splits" list. */
function groupAllocations(allocations: Allocation[]): Map<number, Allocation[]> {
  const map = new Map<number, Allocation[]>();
  for (const a of allocations) {
    const list = map.get(a.sourceTaskId) ?? [];
    list.push(a);
    map.set(a.sourceTaskId, list);
  }
  return map;
}

export function AllocateWeightDialog({
  target,
  onOpenChange,
  onAllocate,
  onDeleteAllocation,
}: {
  target: AllocateTarget | null;
  onOpenChange: (open: boolean) => void;
  onAllocate: (
    storeId: number,
    sourceTaskId: number,
    amounts: { targetTaskId: number; amount: number }[]
  ) => Promise<void>;
  onDeleteAllocation: (storeId: number, sourceTaskId: number) => Promise<void>;
}) {
  const t = useTranslations("cleaningChart.allocateDialog");
  const [sourceTaskId, setSourceTaskId] = useState<number | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingSource, setDeletingSource] = useState<number | null>(null);

  // Only a monthly task legitimately goes absent (due once every 4 weeks,
  // guide §2.1/§11) — daily/weekly/hourly tasks are supposed to be in-play
  // every period. Filtered here too (not just by the caller) so this dialog
  // never offers reallocating a task that shouldn't be absent in the first
  // place, regardless of what triggers it.
  const absentTasks = (target?.row.absentTasks ?? []).filter((a) => a.frequency === "monthly");
  const targets = useMemo(() => (target ? inPlayTasks(target.row) : []), [target]);
  const allocationsBySource = useMemo(
    () => groupAllocations(target?.row.allocations ?? []),
    [target]
  );

  /** Pre-fill from whatever is already allocated for this source, so opening
   *  the dialog on a task that's already split shows exactly where its
   *  weight currently sits — editable in place — instead of a blank form
   *  someone has to reconstruct from memory before they can change anything. */
  const seedAmounts = (srcId: number | null) => {
    if (srcId == null) {
      setAmounts({});
      return;
    }
    const existing = allocationsBySource.get(srcId) ?? [];
    const seeded: Record<number, string> = {};
    for (const a of existing) seeded[a.targetTaskId] = String(a.amount);
    setAmounts(seeded);
  };

  // Re-seed whenever a different store's dialog opens, or default to the
  // first absent task when there's exactly one.
  useEffect(() => {
    if (!target) return;
    const defaultSource = absentTasks.length === 1 ? absentTasks[0].taskId : null;
    setSourceTaskId(defaultSource);
    seedAmounts(defaultSource);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const source: AbsentTask | undefined = absentTasks.find((a) => a.taskId === sourceTaskId);

  const total = Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const remaining = Math.max(0, (source?.weight ?? 0) - total);
  // Server also requires whole numbers ≥ 1 per entry — mirrored here so the
  // button doesn't invite a submission the API will just 422 back.
  const entries = Object.entries(amounts)
    .map(([targetTaskId, v]) => ({ targetTaskId: Number(targetTaskId), amount: Number(v) || 0 }))
    .filter((e) => e.amount > 0);
  const allWholeNumbers = entries.every((e) => Number.isInteger(e.amount) && e.amount >= 1);
  const canSubmit =
    source != null && entries.length > 0 && total === source.weight && allWholeNumbers;

  /** How much MORE this one field could hold without pushing the total past
   *  the source's weight — i.e. this field's current value plus whatever is
   *  still unallocated across the rest of the split. Setting this as both
   *  the input's `max` and clamping on change means the total can never be
   *  typed past the source's weight in the first place. */
  const maxFor = (taskId: number) => {
    const current = Number(amounts[taskId]) || 0;
    return current + remaining;
  };

  const setAmount = (taskId: number, raw: string) => {
    if (raw === "") {
      setAmounts((prev) => ({ ...prev, [taskId]: "" }));
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(n, maxFor(taskId)));
    setAmounts((prev) => ({ ...prev, [taskId]: String(clamped) }));
  };

  /** Soaks up whatever's left into this one field — the common case of "give
   *  the rest to this task" without hand-computing the last number. */
  const fillRemaining = (taskId: number) => {
    setAmounts((prev) => ({ ...prev, [taskId]: String(maxFor(taskId)) }));
  };

  const handleSubmit = async () => {
    if (!target || !source || !canSubmit) return;
    setSaving(true);
    try {
      await onAllocate(target.storeId, source.taskId, entries);
      toast.success(t("saved", { task: source.name }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!target) return;
    setDeletingSource(taskId);
    try {
      await onDeleteAllocation(target.storeId, taskId);
      toast.success(t("deleted"));
      if (sourceTaskId === taskId) seedAmounts(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setDeletingSource(null);
    }
  };

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { store: target?.store ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {absentTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noAbsentTasks")}</p>
        ) : (
          <div className="space-y-4">
            {/* Existing splits, if any — click a row to edit it below */}
            {allocationsBySource.size > 0 && (
              <div className="space-y-1.5">
                <Label>{t("currentSplits")}</Label>
                <ul className="space-y-1 rounded-md border p-2 text-sm">
                  {Array.from(allocationsBySource.entries()).map(([srcId, list]) => {
                    const srcTask = absentTasks.find((a) => a.taskId === srcId);
                    const targetNames = targets.filter((tt) =>
                      list.some((a) => a.targetTaskId === tt.taskId)
                    );
                    return (
                      <li key={srcId} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSourceTaskId(srcId);
                            seedAmounts(srcId);
                          }}
                          className={cn(
                            "min-w-0 truncate rounded text-start transition-colors hover:text-primary",
                            srcId === sourceTaskId && "text-primary"
                          )}
                        >
                          <span className="font-medium">{srcTask?.name ?? `#${srcId}`}</span>
                          <span className="text-muted-foreground">
                            {" → "}
                            {targetNames.map((tt) => tt.name).join(", ")}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingSource === srcId}
                          onClick={() => void handleDelete(srcId)}
                          className="shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive disabled:opacity-50"
                          title={t("removeSplit")}
                        >
                          {deletingSource === srcId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Source (absent task) picker */}
            <div className="space-y-1.5">
              <Label htmlFor="allocate-source">{t("sourceLabel")}</Label>
              <Select
                value={sourceTaskId != null ? String(sourceTaskId) : undefined}
                onValueChange={(v) => {
                  const id = Number(v);
                  setSourceTaskId(id);
                  seedAmounts(id);
                }}
                disabled={saving}
              >
                <SelectTrigger id="allocate-source" className="h-10">
                  <SelectValue placeholder={t("sourcePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {absentTasks.map((a) => (
                    <SelectItem key={a.taskId} value={String(a.taskId)}>
                      {t("sourceOption", { name: a.name, weight: a.weight, unallocated: a.unallocated })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Split amounts across in-play tasks */}
            {source && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("splitLabel", { weight: source.weight })}</Label>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      remaining === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {remaining === 0 ? t("remainingZero") : t("remaining", { remaining })}
                  </span>
                </div>
                {targets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noTargets")}</p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
                    {targets.map((tt) => {
                      const value = amounts[tt.taskId] ?? "";
                      const canFill = remaining > 0 || Number(value) > 0;
                      return (
                        <div key={tt.taskId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{tt.name}</span>
                          <button
                            type="button"
                            disabled={saving || remaining === 0}
                            onClick={() => fillRemaining(tt.taskId)}
                            title={t("fillRemaining")}
                            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-0"
                          >
                            {t("fill")}
                          </button>
                          <Input
                            type="number"
                            min={0}
                            max={maxFor(tt.taskId)}
                            step={1}
                            value={value}
                            onChange={(e) => setAmount(tt.taskId, e.target.value)}
                            disabled={saving || !canFill}
                            className="h-8 w-20 shrink-0 text-end"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("evenSplitHint")}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          {absentTasks.length > 0 && (
            <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
