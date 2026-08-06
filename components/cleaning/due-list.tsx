"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, History, Loader2, Undo2 } from "lucide-react";
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
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type { DueItem } from "@/types/cleaning.types";
import { StatusPill } from "./cleaning-ui";
import { CompleteTaskDialog } from "./complete-task-dialog";
import { HistoryDrawer } from "./history-drawer";

/**
 * A completion recorded for THIS period — the only history `/due` can prove on
 * its own. Deliberately does NOT treat "overdue" or `hasPhoto` as proof: an
 * overdue task may never have been completed at all, and photo metadata can
 * outlive a reverted completion. Everything else is verified against the
 * history endpoint (see the effect below).
 */
function hasCompletionThisPeriod(item: DueItem): boolean {
  return item.status === "done" || item.completionId != null;
}

interface Props {
  storeId: number;
  storeCode: string | null;
  date: string;
  items: DueItem[];
  onComplete: (
    storeId: number,
    taskId: number,
    payload: { date: string; employeeIds: number[]; note?: string; photo?: File | null }
  ) => Promise<void>;
  onUncomplete: (storeId: number, taskId: number, date: string) => Promise<void>;
}

export function DueList({
  storeId,
  storeCode,
  date,
  items,
  onComplete,
  onUncomplete,
}: Props) {
  const t = useTranslations("cleaningChart");
  const [completeItem, setCompleteItem] = useState<DueItem | null>(null);
  const [historyItem, setHistoryItem] = useState<DueItem | null>(null);
  const [undoTarget, setUndoTarget] = useState<DueItem | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);

  /**
   * Whether a task has completion history in EARLIER periods. `/due` only
   * describes the current period, so tasks with nothing recorded *now* are
   * verified against the history endpoint — that's what keeps a brand-new
   * task from showing an empty History drawer.
   */
  const [pastHistory, setPastHistory] = useState<Record<string, boolean>>({});
  /**
   * Cache the in-flight PROMISE (not a "checked" flag). If the effect re-runs —
   * React StrictMode double-invokes it in dev — the re-run re-subscribes to the
   * SAME request instead of skipping it, so the result is never silently
   * dropped by the first invocation's `alive = false` cleanup. Caching a plain
   * "checked" boolean instead loses that guarantee and makes the button's
   * visibility flaky (each row's outcome then depends on whichever effect
   * invocation happened to still be "alive" when the request resolved).
   */
  const cacheRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const historyKey = (taskId: number) => `${storeId}:${taskId}`;

  useEffect(() => {
    // Tasks completed this period already prove history exists — skip those.
    const toCheck = items.filter((i) => !hasCompletionThisPeriod(i));
    if (toCheck.length === 0) return;

    let alive = true;
    for (const item of toCheck) {
      const key = historyKey(item.taskId);
      let request = cacheRef.current.get(key);
      if (!request) {
        request = cleaningService
          .getHistory(storeId, item.taskId)
          .then((rows) => rows.length > 0)
          .catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn(`[cleaning] history check failed for task ${item.taskId}:`, err);
            }
            return false;
          });
        cacheRef.current.set(key, request);
      }
      request.then((has) => {
        if (!alive) return;
        setPastHistory((prev) => (prev[key] === has ? prev : { ...prev, [key]: has }));
      });
    }

    return () => {
      alive = false;
    };
  }, [items, storeId]);

  /** History is offered only when we know a completion actually exists. */
  const showHistory = (item: DueItem) =>
    hasCompletionThisPeriod(item) || pastHistory[historyKey(item.taskId)] === true;

  const confirmUndo = async () => {
    const item = undoTarget;
    if (!item) return;
    setUndoing(item.taskId);
    try {
      await onUncomplete(storeId, item.taskId, date);
      // That completion is gone — re-check whether any earlier history remains,
      // so a task whose only record was just reverted stops offering History.
      const key = historyKey(item.taskId);
      cacheRef.current.delete(key);
      setPastHistory((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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
              items.map((item) => (
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
                    <div className="flex items-center justify-end gap-2">
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
