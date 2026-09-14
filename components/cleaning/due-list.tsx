"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Check, History, Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import type { ChartLockReason, ChartVerdict, DueItem } from "@/types/cleaning.types";
import { StatusPill } from "./cleaning-ui";
import { CompleteTaskDialog } from "./complete-task-dialog";
import { HistoryDrawer } from "./history-drawer";

interface Props {
  storeId: number;
  storeCode: string | null;
  date: string;
  items: DueItem[];
  onComplete: (
    storeId: number,
    taskId: number,
    payload: { date: string; employeeIds: number[]; note?: string; photos?: File[] }
  ) => Promise<void>;
  onUncomplete: (storeId: number, taskId: number, date: string) => Promise<void>;
  /** Cleaning-specialist only — shows the quick Pass/Fail evaluate shortcut. */
  canEvaluate?: boolean;
  /** Sets this task's cleaning-chart verdict for the current evaluation
   *  period. `"empty"` clears it — sent when re-clicking the already-active
   *  verdict, per the backend's "empty deletes" rule. */
  onEvaluate?: (storeId: number, taskId: number, verdict: ChartVerdict | "empty") => Promise<void>;
  /** This task's existing chart verdict for the current period, if already graded. */
  evaluatedVerdicts?: Record<number, ChartVerdict>;
  /** Cross-referenced from the Evaluation grid's own data for this store +
   *  period (guide §1-2) — proactive knowledge of which tasks are currently
   *  completion-locked, so the row can disable/explain BEFORE a doomed
   *  click, not only after one. A task absent from this map is either
   *  editable, or the grid hasn't loaded yet — `lockInfo` below covers that
   *  gap reactively. */
  lockedTaskReasons?: Record<number, ChartLockReason>;
}

export function DueList({
  storeId,
  storeCode,
  date,
  items,
  onComplete,
  onUncomplete,
  canEvaluate,
  onEvaluate,
  evaluatedVerdicts,
  lockedTaskReasons,
}: Props) {
  const t = useTranslations("cleaningChart");
  const [completeItem, setCompleteItem] = useState<DueItem | null>(null);
  const [historyItem, setHistoryItem] = useState<DueItem | null>(null);
  const [undoTarget, setUndoTarget] = useState<DueItem | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);
  const [evaluating, setEvaluating] = useState<number | null>(null);
  // Merged into `evaluatedVerdicts` so a just-clicked verdict shows instantly,
  // without waiting on the evaluation grid to refetch. Stores "empty" as its
  // own entry (rather than deleting the key) so a just-cleared verdict
  // overrides the still-stale `evaluatedVerdicts` value instead of falling
  // back to it.
  const [localVerdicts, setLocalVerdicts] = useState<Record<number, ChartVerdict | "empty">>({});
  const verdictFor = (taskId: number): ChartVerdict | undefined => {
    const local = localVerdicts[taskId];
    if (local !== undefined) return local === "empty" ? undefined : local;
    return evaluatedVerdicts?.[taskId];
  };
  /**
   * This list has no completion-lock data up front (`GET /cleaning/due`
   * doesn't carry `evaluable`/`completion_*` — that's Evaluation-grid-only,
   * guide §1-2). So a lock can only be learned reactively, from the 422 any
   * verdict attempt gets back — pass, fail, and clear are ALL refused on a
   * locked cell (guide §2, no restricted cycle anymore). Once learned, keep
   * it around so the row shows *why* instead of just letting every click
   * fail silently-but-toasted, and so both buttons stay disabled instead of
   * an infinite retry loop.
   */
  const [lockInfo, setLockInfo] = useState<
    Record<number, { reason: "period_not_finished" | "not_completed" | "partially_completed" }>
  >({});
  // `items` is a fresh array every time the parent refetches the due list —
  // including right after `onComplete` resolves. A `lockInfo` entry learned
  // BEFORE that refetch might now be stale (the completion that would
  // unlock it may be exactly what just landed), and since the buttons stay
  // disabled while an entry exists, a stale one is a permanent dead end —
  // nothing else ever gives the row a chance to find out it unlocked. Clear
  // the cache on every refetch so the next click re-checks with the server
  // instead of trusting a possibly-outdated "it was locked" memory.
  useEffect(() => {
    setLockInfo({});
    // Optimistic verdicts are period-scoped, and changing the date can move
    // the row into a different week — keeping them would show one week's
    // verdict against another week's cell.
    setLocalVerdicts({});
  }, [items]);
  // Safety net: `canEvaluate` is a client-side guess based on cached auth-rule
  // data (see canEvaluateCleaning) and can be stale or wrong relative to the
  // backend's actual authorization. If the server ever comes back 403 on this
  // action, that's the authoritative answer — hide the control immediately
  // instead of leaving a forbidden button clickable for the rest of the visit.
  const [evaluateForbidden, setEvaluateForbidden] = useState(false);

  /** Quick chart toggle — no dialog, matching the grid's chart chips.
   *  Re-clicking the already-active verdict passes "empty" to clear it. */
  const evaluate = async (item: DueItem, verdict: ChartVerdict | "empty") => {
    if (!onEvaluate) return;
    setEvaluating(item.taskId);
    try {
      await onEvaluate(storeId, item.taskId, verdict);
      setLocalVerdicts((prev) => ({ ...prev, [item.taskId]: verdict }));
      // A successful write means the server accepted it — whatever lock we'd
      // learned about no longer applies (either it wasn't locked, or this
      // was the Fail/N-A path locked cells still allow).
      setLockInfo((prev) => {
        if (!(item.taskId in prev)) return prev;
        const next = { ...prev };
        delete next[item.taskId];
        return next;
      });
      toast.success(
        verdict === "empty"
          ? t("due.toasts.evaluateCleared", { label: item.label })
          : t("due.toasts.evaluated", { label: item.label })
      );
    } catch (err) {
      if (err instanceof CleaningError && err.code === "FORBIDDEN") {
        setEvaluateForbidden(true);
        toast.error(t("due.toasts.evaluateForbidden"));
      } else if (
        err instanceof CleaningError &&
        (err.reason === "not_completed" ||
          err.reason === "partially_completed" ||
          err.reason === "period_not_finished")
      ) {
        // Guide §2.1: the message already names the task and says what to do
        // instead — surface it, and remember which of the two lock families
        // this is so the row keeps showing it after the toast fades, instead
        // of leaving a mystery (and instead of retrying a click that's
        // refused for EVERY verdict now, not just Pass).
        setLockInfo((prev) => ({
          ...prev,
          [item.taskId]: {
            reason: err.reason as "period_not_finished" | "not_completed" | "partially_completed",
          },
        }));
        toast.error(err.message);
      } else {
        toast.error(err instanceof CleaningError ? err.message : t("due.toasts.evaluateFailed"));
      }
    } finally {
      setEvaluating(null);
    }
  };

  /**
   * History is offered whenever the task was ever completed. `has_history`
   * comes straight off the due item now — no per-task /history probe needed
   * (that endpoint is the heaviest call in the module; it walks the
   * recurrence rule to derive misses, so it's only called on demand when the
   * user actually opens the History drawer, not to test whether it exists).
   */
  const showHistory = (item: DueItem) => item.hasHistory;

  const confirmUndo = async () => {
    const item = undoTarget;
    if (!item) return;
    setUndoing(item.taskId);
    try {
      await onUncomplete(storeId, item.taskId, date);
      // onUncomplete refetches the due list, so hasHistory reflects the
      // server's view again (unset once no completion remains at all).
      toast.success(t("due.toasts.reverted", { label: item.label }));
      setUndoTarget(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("due.toasts.undoFailed"));
    } finally {
      setUndoing(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("due.table.task")}</TableHead>
              <TableHead>{t("due.table.status")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("due.table.frequency")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("due.table.period")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("due.table.weight")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("due.table.doneBy")}</TableHead>
              <TableHead className="text-end">{t("due.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  {t("due.table.empty", { date })}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const verdict = verdictFor(item.taskId);
                // Proactive (from the Evaluation grid's own data for this
                // period) wins whenever it's available; the reactive 422-
                // learned entry is only a fallback for when the grid hasn't
                // loaded yet.
                const lockReason = lockedTaskReasons?.[item.taskId] ?? lockInfo[item.taskId]?.reason;
                const lock = lockReason ? { reason: lockReason } : undefined;
                return (
                <TableRow key={item.taskId}>
                  <TableCell className="max-w-[280px]">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{item.label}</span>
                      {item.hasPhoto && (
                        <Camera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {item.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {/* compact meta on small screens where columns are hidden */}
                    <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                      {t("due.table.meta", {
                        freq: t(`frequency.${item.frequency}`),
                        from: item.period[0],
                        to: item.period[1],
                      })}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={item.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="font-normal">
                      {t(`frequency.${item.frequency}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                    {item.period[0]} → {item.period[1]}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{item.weight}</TableCell>
                  <TableCell className="hidden max-w-[160px] truncate text-sm text-muted-foreground lg:table-cell">
                    {item.doneBy.length > 0 ? item.doneBy.join(", ") : t("due.table.noDoneBy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {showHistory(item) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setHistoryItem(item)}
                          title={t("due.viewHistory")}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      {item.status === "done" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUndoTarget(item)}
                          disabled={undoing === item.taskId}
                        >
                          <Undo2 className="me-1.5 h-4 w-4" />
                          {t("due.undo")}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setCompleteItem(item)}>
                          {t("due.complete")}
                        </Button>
                      )}

                      {/* Evaluate — cleaning-specialist only, always last so the
                          row reads left-to-right as "handle it, then grade it". */}
                      {canEvaluate && !evaluateForbidden && onEvaluate && (
                        <div className="ms-1 flex items-center gap-1.5 border-s ps-2">
                          {/* Learned reactively from a 422 (this endpoint has
                              no completion data up front) — once known, stop
                              offering verdict clicks that will just 422
                              again (guide §2: locked means no verdict at
                              all, not just Pass), and show why instead of
                              only a toast that's already faded. Amber =
                              period still open, nothing failed yet; red =
                              deadline passed, auto-failed. */}
                          {lock && (
                            <span
                              className={cn(
                                "text-[10px] font-medium",
                                lock.reason === "period_not_finished"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                              )}
                              title={t(
                                lock.reason === "period_not_finished"
                                  ? "due.lockedExplainPending"
                                  : "due.lockedExplainBlocked"
                              )}
                            >
                              {t(
                                lock.reason === "period_not_finished"
                                  ? "due.lockedShortPending"
                                  : "due.lockedShortBlocked"
                              )}
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={evaluating === item.taskId || lock != null}
                            title={
                              lock
                                ? t(
                                    lock.reason === "period_not_finished"
                                      ? "due.lockedExplainPending"
                                      : "due.lockedExplainBlocked"
                                  )
                                : t("due.evaluatePass")
                            }
                            onClick={() => void evaluate(item, verdict === "pass" ? "empty" : "pass")}
                            className={cn(
                              "h-8 w-8",
                              verdict === "pass"
                                ? "border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400"
                                : "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={evaluating === item.taskId || lock != null}
                            title={
                              lock
                                ? t(
                                    lock.reason === "period_not_finished"
                                      ? "due.lockedExplainPending"
                                      : "due.lockedExplainBlocked"
                                  )
                                : t("due.evaluateFail")
                            }
                            onClick={() => void evaluate(item, verdict === "fail" ? "empty" : "fail")}
                            className={cn(
                              "h-8 w-8",
                              verdict === "fail"
                                ? "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400"
                                : "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {completeItem && (
        <CompleteTaskDialog
          open={!!completeItem}
          onOpenChange={(o) => !o && setCompleteItem(null)}
          storeId={storeId}
          storeCode={storeCode}
          date={date}
          item={completeItem}
          onComplete={(payload) => onComplete(storeId, completeItem.taskId, payload)}
        />
      )}

      {historyItem && (
        <HistoryDrawer
          open={!!historyItem}
          onOpenChange={(o) => !o && setHistoryItem(null)}
          storeId={storeId}
          taskId={historyItem.taskId}
          taskLabel={historyItem.label}
        />
      )}

      {/* Confirm undo */}
      <AlertDialog open={undoTarget != null} onOpenChange={(o) => !o && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("due.undoDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("due.undoDialog.description", { label: undoTarget?.label ?? "", date })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoing != null}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={undoing != null}
              onClick={(e) => {
                e.preventDefault();
                void confirmUndo();
              }}
            >
              {undoing != null && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {t("due.undo")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
