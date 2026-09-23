"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeSyncRequestStatus } from "@/types/scheduling.types";

/**
 * The "employee is not schedulable yet" surfaces.
 *
 * An employee with `synced: false` has no counterpart in Humanity and cannot be
 * scheduled. This shows up in two places:
 *
 *   1. Preventatively, as a roster badge, with the add-shift affordance
 *      disabled. This is the good path — the manager never types a shift they
 *      cannot save.
 *   2. Reactively, as a 409 on create. That is a WAIT, not a failure: nothing
 *      was written, the sync was already requested, and the manager's input
 *      must be held so they never retype work they did not lose.
 */

/** Roster-row badge for an employee who cannot be scheduled yet. */
export function EmployeeSyncBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-sky-500/40 bg-sky-500/10 text-[9px] text-sky-700 dark:text-sky-300",
            className
          )}
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Setting up
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-60 text-xs">
        <p className="font-semibold">Not schedulable yet</p>
        <p className="mt-0.5 opacity-90">
          This employee is still being set up in the scheduling system. It
          usually takes under a minute. Shifts cannot be created for them until
          it finishes.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * In-dialog waiting state shown after a 409, while polling for the sync to land.
 *
 * `awaiting_tcp_connector` is worded differently on purpose: the employee is
 * already in the payroll system and is waiting on ITS scheduled connector, which
 * runs roughly every five minutes. There is nothing to re-request, so no manual
 * retry is offered in that state.
 */
export function EmployeeSyncWaiting({
  employeeName,
  status,
  elapsedSeconds,
  timedOut,
  lastError,
  onManualSync,
  onRetry,
  onCancel,
  isRequesting,
}: {
  employeeName: string;
  status: EmployeeSyncRequestStatus;
  elapsedSeconds: number;
  timedOut: boolean;
  lastError?: string | null;
  onManualSync: () => void;
  onRetry: () => void;
  onCancel: () => void;
  isRequesting?: boolean;
}) {
  const awaitingPayroll = status === "awaiting_tcp_connector";

  return (
    <div className="space-y-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
      <div className="flex items-start gap-2.5">
        {timedOut ? (
          <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {timedOut
              ? `Still setting up ${employeeName}`
              : awaitingPayroll
                ? `Waiting for the payroll system to publish ${employeeName}`
                : `Setting up ${employeeName}…`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {timedOut
              ? "This is taking longer than usual. Your shift details are still here — you can keep waiting, request the setup again, or try saving now."
              : awaitingPayroll
                ? "They are already in payroll and are waiting to be published to scheduling. This usually takes a few minutes."
                : "This usually takes under a minute. Your shift details are kept — it will save automatically as soon as they are ready."}
          </p>
          {lastError && (
            <p className="text-[11px] italic text-rose-600 dark:text-rose-400">
              {lastError}
            </p>
          )}
          {!timedOut && elapsedSeconds > 0 && (
            <p className="text-[10px] tabular-nums text-muted-foreground/70">
              Waiting {elapsedSeconds}s
            </p>
          )}
        </div>
      </div>

      {timedOut && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try saving now
          </Button>
          {!awaitingPayroll && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onManualSync}
              disabled={isRequesting}
            >
              {isRequesting ? "Requesting…" : "Request setup again"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
