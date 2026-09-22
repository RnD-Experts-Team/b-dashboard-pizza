"use client";

import { useMemo } from "react";
import { Loader2, LogIn, LogOut, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import { formatMinutes } from "@/lib/scheduling/utils";
import { useOnTheClock } from "@/lib/hooks/use-on-the-clock";
import { useClockPunch } from "@/lib/hooks/use-clock-punch";
import { ScheduleErrorAlert } from "./schedule-error-alert";
import { DataFreshness } from "./data-freshness";
import type { ScheduleEmployee } from "@/types/scheduling.types";

/**
 * Who is working right now, and the buttons to change that.
 *
 * Punches reach us from three places — this app, a physical clock in the
 * store, and TCP's own web app — and until the backend added this endpoint
 * only the first was visible. A manager asking "who is actually here" had to
 * take the schedule's word for it.
 *
 * A dialog rather than a panel on the page: it polls while it is open, and
 * the week grid is the thing people came for.
 */

interface OnTheClockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  /** This week's roster, so people NOT on the clock can be punched in. */
  employees: ScheduleEmployee[];
  /** Pull the week again once somebody punches — a clock-in creates a shift. */
  onPunched: () => void;
  onSuccess: (message: string) => void;
}

/** "2026-08-06 15:00:00" → "3:00 PM". Sliced, never parsed — local wall clock. */
function punchClock(stamp: string): string {
  return formatTime(stamp.slice(11, 16));
}

/**
 * The backend's `tcp.rollup.max_shift_hours`, past which a shift stops
 * accruing and raises needs_attention. Mirrored rather than sent, so a change
 * there needs a change here — but the alternative is a screen that counts
 * hours nobody is being paid for.
 */
const MAX_SHIFT_MINUTES = 16 * 60;

/** Somebody forgot to clock out, rather than somebody working a long day. */
function isStale(minutesSoFar: number): boolean {
  return minutesSoFar > MAX_SHIFT_MINUTES;
}

export function OnTheClockDialog({
  open,
  onOpenChange,
  storeId,
  employees,
  onPunched,
  onSuccess,
}: OnTheClockDialogProps) {
  const board = useOnTheClock({ storeId, enabled: open });
  const punch = useClockPunch({
    storeId,
    onPunched: () => {
      board.refresh();
      onPunched();
    },
    onSuccess,
  });

  const onClockIds = useMemo(
    () => new Set(board.entries.map((e) => e.employeeId)),
    [board.entries],
  );

  const offClock = useMemo(
    () => employees.filter((e) => !onClockIds.has(e.id)),
    [employees, onClockIds],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>On the clock</DialogTitle>
          <DialogDescription>
            Everyone punched in at this store right now, however they punched —
            here, a clock in the store, or the time-clock system itself.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <DataFreshness
            lastFetchedAt={board.lastFetchedAt}
            isRefreshing={board.isRefreshing || board.isLoading}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={board.refresh}
            disabled={board.isLoading || board.isRefreshing}
          >
            {board.isRefreshing || board.isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>

        {board.error && (
          <ScheduleErrorAlert
            error={board.error}
            title="Couldn't check the clock"
            onRetry={board.refresh}
            compact
          />
        )}

        {punch.error && (
          <ScheduleErrorAlert
            error={punch.error}
            title="Couldn't record that punch"
            onDismiss={punch.clearError}
            compact
          />
        )}

        {/*
          A plain overflow container, not `ScrollArea`.

          Radix's viewport is `height: 100%`, which does not clamp against a
          parent sized by `flex-1` — the root measured 368px while the viewport
          inside it measured 1614px, so the list simply overflowed the dialog
          and the bottom rows could not be reached. The published-schedules
          dialog already uses this shape for the same reason.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 pe-1">
            {/* ── On the clock ──────────────────────────────────────── */}
            <div className="space-y-1.5">
              {board.isLoading ? (
                <>
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </>
              ) : board.entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                  <Users className="h-5 w-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    Nobody is on the clock.
                  </p>
                </div>
              ) : (
                board.entries.map((e) => (
                  <div
                    key={e.employeeId}
                    className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-2"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isStale(e.minutesSoFar)
                          ? "bg-amber-500"
                          : "animate-pulse bg-emerald-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.employeeName}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] tabular-nums",
                          isStale(e.minutesSoFar)
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {/*
                          `timeIn` to display and `minutesSoFar` for the
                          elapsed figure. `since` is the only UTC value in the
                          API and is not for reading off a screen.
                        */}
                        since {e.segment ? punchClock(e.segment.timeIn) : "—"} ·{" "}
                        {/*
                          Past the cap the hours have stopped accruing, so the
                          running total is no longer what anyone will be paid.
                          Showing "21h 47m so far" invites reading it as a
                          timesheet figure; this is a forgotten punch.
                        */}
                        {isStale(e.minutesSoFar)
                          ? "never clocked out"
                          : `${formatMinutes(e.minutesSoFar)} so far`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 text-xs"
                      disabled={
                        punch.pendingEmployeeId === e.employeeId ||
                        punch.storeNotEnabled
                      }
                      onClick={() =>
                        void punch.clockOut(e.employeeId, e.employeeName)
                      }
                    >
                      {punch.pendingEmployeeId === e.employeeId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LogOut className="h-3 w-3" />
                      )}
                      Clock out
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* ── Everybody else ────────────────────────────────────── */}
            {offClock.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Not on the clock
                </p>
                {offClock.map((emp) => {
                  // Not "clocked out" — the time clock has no record of them
                  // at all, so no hours can be attributed either way.
                  const unlinked = punch.unlinkedEmployeeIds.has(emp.id);
                  return (
                  <div
                    key={emp.id}
                    className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{emp.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {unlinked ? "Not set up for clocking" : emp.role}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-7 shrink-0 gap-1.5 text-xs")}
                      disabled={
                        punch.pendingEmployeeId === emp.id ||
                        punch.storeNotEnabled ||
                        unlinked
                      }
                      onClick={() => void punch.clockIn(emp.id, emp.name)}
                    >
                      {punch.pendingEmployeeId === emp.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LogIn className="h-3 w-3" />
                      )}
                      Clock in
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
