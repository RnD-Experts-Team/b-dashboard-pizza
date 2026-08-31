"use client";

import { useCallback, useRef, useState } from "react";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import { useEmployeeSync } from "@/lib/hooks/use-employee-sync";
import type { ScheduleWarningCode } from "@/components/scheduling/schedule-warning-dialog";
import type { SetupErrorCode } from "@/components/scheduling/schedule-setup-error";

/**
 * Single-shift create / update / delete, with the full refusal branch tree.
 *
 * Every write in this system exists because a write to Humanity succeeded, which
 * makes the failure semantics unusually clean: a refused create changed NOTHING
 * anywhere, so retrying is always safe and the manager's input is never lost.
 *
 * The branches, and why each is shaped the way it is:
 *
 *   409 SHIFT_CONFLICT / EMPLOYEE_UNAVAILABLE / EMPLOYEE_ON_TIME_OFF
 *     Warnings the manager is allowed to override. The retry must resend the
 *     IDENTICAL payload plus `force`, so the payload is stashed rather than
 *     rebuilt from the dialog — rebuilding risks a different value sneaking in
 *     between the warning and the confirmation.
 *
 *   409 EMPLOYEE_NOT_SYNCED
 *     A wait, not a failure. Handed to `useEmployeeSync`, which polls and then
 *     replays this exact request.
 *
 *   409 SHIFT_PUBLISHED (delete)
 *     Employees may already have been notified. Confirm, then retry with
 *     `confirm=true`.
 *
 *   404 EMPLOYEE_NOT_IN_STORE
 *     A stale roster. Refetch silently and retry once — the manager did nothing
 *     wrong and does not need to see this.
 *
 *   422 STORE_NOT_MAPPED / POSITION_NOT_MAPPED
 *     Configuration, not user error. Escalated to the setup panel; retrying
 *     would never succeed.
 *
 *   502 HUMANITY_WRITE_FAILED
 *     Nothing was saved. On a DELETE this matters most: the shift is still live
 *     for the employee, so the caller must refetch rather than optimistically
 *     removing the card.
 */

type WriteKind = "create" | "update" | "delete";

interface PendingWrite {
  kind: WriteKind;
  /** Stashed verbatim so a `force` retry is byte-identical plus the flag. */
  payload: Record<string, unknown>;
  /** The SHIFT id (not the assignment id) for update and delete. */
  shiftId?: string;
  employeeId?: string;
  /** Human summary shown in the confirm modal, e.g. "Marco Rossi, Tue 9:00 AM – 5:00 PM". */
  detail?: string;
  /** Guards the EMPLOYEE_NOT_IN_STORE silent retry so it can only happen once. */
  staleRosterRetried?: boolean;
}

export interface ShiftWarning {
  code: ScheduleWarningCode;
  message: string;
  detail?: string;
}

export interface UseShiftMutationsOptions {
  storeId: string | null;
  /**
   * Refetch the whole week. Called after every successful write — it is one
   * request, and it is the only way `conflicts`, `stats` and `syncStatus` stay
   * truthful together.
   */
  refetchWeek: () => void;
  /** Raised when the store itself turns out not to be configured. */
  onSetupError: (code: SetupErrorCode, message: string) => void;
  onSuccess?: (kind: WriteKind) => void;
}

export interface UseShiftMutationsResult {
  createShift: (
    payload: Record<string, unknown>,
    meta?: { employeeId?: string; detail?: string },
  ) => Promise<boolean>;
  updateShift: (
    shiftId: string,
    payload: Record<string, unknown>,
    meta?: { employeeId?: string; detail?: string },
  ) => Promise<boolean>;
  deleteShift: (
    shiftId: string,
    meta?: { detail?: string },
  ) => Promise<boolean>;
  isSubmitting: boolean;
  error: SchedulingError | null;
  clearError: () => void;
  /** Non-null while an overridable refusal is awaiting the manager's decision. */
  warning: ShiftWarning | null;
  confirmWarning: () => void;
  cancelWarning: () => void;
  /** Non-null while waiting for an employee to become schedulable. */
  syncWait: ReturnType<typeof useEmployeeSync>["wait"];
  /**
   * Resend the held write immediately, without waiting for the poll.
   * Offered after the sync wait times out — the employee may in fact be ready.
   */
  retryPending: () => void;
  cancelSyncWait: () => void;
  requestManualSync: () => Promise<void>;
  isRequestingSync: boolean;
}

export function useShiftMutations({
  storeId,
  refetchWeek,
  onSetupError,
  onSuccess,
}: UseShiftMutationsOptions): UseShiftMutationsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [warning, setWarning] = useState<ShiftWarning | null>(null);
  const pendingRef = useRef<PendingWrite | null>(null);
  /**
   * Filled in below, once `useEmployeeSync` exists. Held in a ref because
   * `send` needs to start a sync wait, and the sync hook needs `send` to
   * replay the write — a genuine cycle that has to be broken somewhere.
   */
  const syncRef = useRef<ReturnType<typeof useEmployeeSync> | null>(null);

  /**
   * Send one write. `extra` carries `force` or the confirm flag on a retry.
   * Returns true when the schedule actually changed.
   */
  const send = useCallback(
    async (write: PendingWrite, extra: { force?: boolean; confirm?: boolean } = {}) => {
      if (!storeId) return false;
      setIsSubmitting(true);
      setError(null);

      try {
        if (write.kind === "delete") {
          await schedulingService.deleteShift(
            storeId,
            write.shiftId!,
            extra.confirm ?? false,
          );
        } else if (write.kind === "update") {
          await schedulingService.updateShift(storeId, write.shiftId!, {
            ...write.payload,
            ...(extra.force ? { force: true } : {}),
          });
        } else {
          await schedulingService.createShift(storeId, {
            ...write.payload,
            ...(extra.force ? { force: true } : {}),
          });
        }

        pendingRef.current = null;
        setWarning(null);
        refetchWeek();
        onSuccess?.(write.kind);
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(
          err,
          write.kind === "delete"
            ? "Could not delete this shift."
            : "Could not save this shift.",
        );

        if (handleUnauthorized(parsed.status)) return false;

        // Hold the request so a confirm/force/replay can resend it unchanged.
        pendingRef.current = write;

        if (parsed.isSetup) {
          onSetupError(parsed.code as SetupErrorCode, parsed.message);
          return false;
        }

        if (parsed.code === "EMPLOYEE_NOT_SYNCED" && parsed.sync) {
          syncRef.current?.begin({
            employeeId: parsed.sync.employeeId ?? write.employeeId ?? "",
            employeeName: parsed.sync.employeeName ?? "this employee",
            status: parsed.sync.status,
            retryAfterSeconds: parsed.sync.retryAfterSeconds,
            lastError: parsed.sync.lastError,
          });
          return false;
        }

        if (parsed.isForceable || parsed.needsConfirm) {
          setWarning({
            code: parsed.code as ScheduleWarningCode,
            message: parsed.message,
            detail: write.detail,
          });
          return false;
        }

        if (parsed.code === "EMPLOYEE_NOT_IN_STORE" && !write.staleRosterRetried) {
          // The roster we rendered is out of date. Refresh and try once more
          // without bothering the manager about it.
          refetchWeek();
          return await send({ ...write, staleRosterRetried: true }, extra);
        }

        // Everything else — including 502, where nothing was saved. The caller
        // refetches so a delete that did not happen cannot leave a phantom gap.
        setError(parsed);
        if (write.kind === "delete") refetchWeek();
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [storeId, refetchWeek, onSetupError, onSuccess],
  );

  /** Replay the held request once the employee becomes schedulable. */
  const replayAfterSync = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) void send(pending);
  }, [send]);

  const sync = useEmployeeSync({ storeId, onSynced: replayAfterSync });
  syncRef.current = sync;

  const createShift = useCallback<UseShiftMutationsResult["createShift"]>(
    (payload, meta) =>
      send({ kind: "create", payload, employeeId: meta?.employeeId, detail: meta?.detail }),
    [send],
  );

  const updateShift = useCallback<UseShiftMutationsResult["updateShift"]>(
    (shiftId, payload, meta) =>
      send({
        kind: "update",
        shiftId,
        payload,
        employeeId: meta?.employeeId,
        detail: meta?.detail,
      }),
    [send],
  );

  const deleteShift = useCallback<UseShiftMutationsResult["deleteShift"]>(
    (shiftId, meta) =>
      send({ kind: "delete", shiftId, payload: {}, detail: meta?.detail }),
    [send],
  );

  const confirmWarning = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) {
      setWarning(null);
      return;
    }
    // SHIFT_PUBLISHED needs `confirm`; the other three need `force`.
    const extra =
      warning?.code === "SHIFT_PUBLISHED" ? { confirm: true } : { force: true };
    void send(pending, extra);
  }, [send, warning?.code]);

  const cancelWarning = useCallback(() => {
    pendingRef.current = null;
    setWarning(null);
  }, []);

  const retryPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) void send(pending);
  }, [send]);

  const cancelSyncWait = useCallback(() => {
    pendingRef.current = null;
    sync.cancel();
  }, [sync]);

  return {
    createShift,
    updateShift,
    deleteShift,
    isSubmitting,
    error,
    clearError: () => setError(null),
    warning,
    confirmWarning,
    cancelWarning,
    syncWait: sync.wait,
    retryPending,
    cancelSyncWait,
    requestManualSync: sync.requestManualSync,
    isRequestingSync: sync.isRequestingSync,
  };
}
