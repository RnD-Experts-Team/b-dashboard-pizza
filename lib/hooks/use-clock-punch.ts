"use client";

import { useCallback, useState } from "react";
import {
  schedulingService,
  handleUnauthorized,
} from "@/lib/api/services/scheduling.service";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";

/**
 * Punching people in and out.
 *
 * Separate from `useActualShiftMutations` because these write to TCP directly
 * rather than to our own actual-shift rows, and they fail in ways the schedule
 * writes do not: the store may be outside the write rollout, the person may
 * have no TCP id yet, and the vendor's daily quota is shared across the whole
 * account.
 *
 * ⚠️ `STORE_NOT_ALLOWLISTED` is in `SETUP_ERROR_CODES`, which the schedule
 * hooks route to a full-page panel that replaces the grid. That is right when
 * the schedule itself cannot be written and wrong here: reading the week still
 * works perfectly, and only the punch buttons are unavailable. So this hook
 * keeps its own error and never calls `onSetupError`.
 */

/**
 * Refusals that mean our picture of who is on the clock is wrong.
 *
 * `ALREADY_CLOCKED_IN` and `NOT_CLOCKED_IN` are the typed pair; the vendor
 * also refuses a clock-out outright when its own records disagree, which
 * arrives as a write failure rather than a state error.
 */
const CONTRADICTS_THE_BOARD: ReadonlySet<string> = new Set([
  "ALREADY_CLOCKED_IN",
  "NOT_CLOCKED_IN",
  "TCP_WRITE_FAILED",
]);

interface UseClockPunchOptions {
  storeId: string | null;
  /** Called after a punch lands, so the board and the week can catch up. */
  onPunched?: () => void;
  onSuccess?: (message: string) => void;
}

interface UseClockPunchResult {
  clockIn: (employeeId: string, employeeName: string) => Promise<boolean>;
  clockOut: (employeeId: string, employeeName: string) => Promise<boolean>;
  /** The employee id currently being punched, so one row can show a spinner. */
  pendingEmployeeId: string | null;
  error: SchedulingError | null;
  clearError: () => void;
  /** True once the store has refused a punch as not rolled out. */
  storeNotEnabled: boolean;
  /**
   * Employees the time clock has no record of.
   *
   * Nothing can be attributed to them until somebody links them, so offering
   * the button again would just fail again. Learned from the refusal rather
   * than pre-checked: `clock-status` would be one request per person on the
   * roster, every time the board opens, to answer a question that almost
   * always comes back fine.
   */
  unlinkedEmployeeIds: ReadonlySet<string>;
}

export function useClockPunch({
  storeId,
  onPunched,
  onSuccess,
}: UseClockPunchOptions): UseClockPunchResult {
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<SchedulingError | null>(null);
  const [storeNotEnabled, setStoreNotEnabled] = useState(false);
  const [unlinkedEmployeeIds, setUnlinkedEmployeeIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const punch = useCallback(
    async (
      employeeId: string,
      action: () => Promise<unknown>,
      fallback: string,
      success: string,
    ) => {
      if (!storeId) return false;
      setPendingEmployeeId(employeeId);
      setError(null);
      try {
        await action();
        onSuccess?.(success);
        onPunched?.();
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(err, fallback);
        if (handleUnauthorized(parsed.status)) return false;
        // Handled here rather than escalated: the rest of the page is fine.
        if (parsed.code === "STORE_NOT_ALLOWLISTED") setStoreNotEnabled(true);
        if (parsed.code === "EMPLOYEE_NOT_IN_TCP") {
          setUnlinkedEmployeeIds((prev) => new Set([...prev, employeeId]));
        }
        /*
         * The time clock has just contradicted what the board is showing:
         * somebody it lists as on the clock is not, or vice versa. Pull the
         * board again so the row stops offering an action that cannot work —
         * otherwise the only feedback is the same error on every press.
         */
        if (CONTRADICTS_THE_BOARD.has(parsed.code ?? "")) onPunched?.();
        setError(parsed);
        return false;
      } finally {
        setPendingEmployeeId(null);
      }
    },
    [storeId, onPunched, onSuccess],
  );

  const clockIn = useCallback(
    (employeeId: string, employeeName: string) =>
      punch(
        employeeId,
        () => schedulingService.clockIn(storeId!, employeeId),
        `Could not clock ${employeeName} in.`,
        `${employeeName} clocked in`,
      ),
    [punch, storeId],
  );

  const clockOut = useCallback(
    (employeeId: string, employeeName: string) =>
      punch(
        employeeId,
        () => schedulingService.clockOut(storeId!, employeeId),
        `Could not clock ${employeeName} out.`,
        `${employeeName} clocked out`,
      ),
    [punch, storeId],
  );

  return {
    clockIn,
    clockOut,
    pendingEmployeeId,
    error,
    clearError: () => setError(null),
    storeNotEnabled,
    unlinkedEmployeeIds,
  };
}
