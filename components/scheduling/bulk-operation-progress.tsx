"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import type { BulkOperation, BulkOperationType } from "@/types/scheduling.types";

/**
 * Progress and outcome for an async bulk operation.
 *
 * There is deliberately NO ROLLBACK on the backend: deleting shifts that were
 * already created, in order to undo, is more destructive than a partial week —
 * especially once employees have seen it. So `completed_with_errors` is a NORMAL
 * OUTCOME, not a crash, and is presented as "65 of 68 created — 3 need
 * attention" with the failures listed and a retry that re-queues only those.
 */

const TITLES: Record<BulkOperationType, string> = {
  bulk_create: "Creating shifts",
  copy_week: "Copying the previous week",
  apply_template: "Applying template",
  clear_week: "Clearing the week",
  publish_week: "Publishing the week",
  unpublish_week: "Unpublishing the week",
  restore_published: "Restoring published schedule",
  recurring_expand: "Expanding recurring shifts",
  retry_failed: "Retrying failed shifts",
};

function isTerminal(status: BulkOperation["status"]) {
  return (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "failed"
  );
}

interface BulkOperationProgressProps {
  /** `null` closes the dialog. */
  operation: BulkOperation | null;
  onRetryFailed: () => void;
  onClose: () => void;
  isRetrying?: boolean;
}

export function BulkOperationProgress({
  operation,
  onRetryFailed,
  onClose,
  isRetrying = false,
}: BulkOperationProgressProps) {
  if (!operation) return null;

  const { status, total, succeeded, failed, progressPercent, items } = operation;
  const terminal = isTerminal(status);
  const hasFailures = failed > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Don't let a click-away hide work that is still running.
        if (!open && terminal) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!terminal && (
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
            )}
            {status === "completed" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            {status === "completed_with_errors" && (
              <TriangleAlert className="h-4 w-4 text-amber-500" />
            )}
            {status === "failed" && <XCircle className="h-4 w-4 text-rose-500" />}
            {TITLES[operation.type] ?? "Working"}
          </DialogTitle>
          <DialogDescription>
            {!terminal &&
              "This runs in the background — each shift is sent to the scheduling system in turn."}
            {status === "completed" &&
              `All ${succeeded} shift${succeeded !== 1 ? "s" : ""} went through.`}
            {status === "completed_with_errors" &&
              `${succeeded} of ${total} shift${total !== 1 ? "s" : ""} went through — ${failed} need${failed === 1 ? "s" : ""} attention.`}
            {status === "failed" &&
              (operation.error ??
                "This operation could not be completed. Nothing further was changed.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>{progressPercent}%</span>
              <span>
                {succeeded} done
                {hasFailures && ` · ${failed} failed`}
                {total > 0 && ` · ${total} total`}
              </span>
            </div>
          </div>

          {/* Only failures are ever returned, so this list is always actionable. */}
          {items.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Needs attention</p>
              <ScrollArea className="max-h-56 rounded-md border">
                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={`${item.sequence}-${item.employeeId ?? "na"}`}
                      className="space-y-0.5 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">
                          {item.employeeName ?? `Employee ${item.employeeId ?? "?"}`}
                        </span>
                        {item.errorCode && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-rose-500/40 bg-rose-500/10 text-[9px] text-rose-700 dark:text-rose-300"
                          >
                            {item.errorCode}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {item.shiftDate}
                        {item.startTime && item.endTime && (
                          <>
                            {" · "}
                            {formatTime(item.startTime)} – {formatTime(item.endTime)}
                          </>
                        )}
                      </p>
                      {item.errorMessage && (
                        <p className="text-[11px] italic text-rose-600 dark:text-rose-400">
                          {item.errorMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className={cn(hasFailures && terminal && "sm:justify-between")}>
          {hasFailures && terminal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryFailed}
              disabled={isRetrying}
            >
              {isRetrying ? "Retrying…" : `Retry ${failed} failed`}
            </Button>
          )}
          <Button size="sm" onClick={onClose} disabled={!terminal}>
            {terminal ? "Close" : "Working…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
