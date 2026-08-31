"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { schedulingService } from "@/lib/api/services/scheduling.service";
import { adaptEmployeeSyncStatus } from "@/lib/scheduling/adapters";
import { parseSchedulingError } from "@/lib/scheduling/errors";
import type { EmployeeSyncRequestStatus } from "@/types/scheduling.types";

/**
 * The resumable wait behind `409 EMPLOYEE_NOT_SYNCED`.
 *
 * That response is NOT a failure. Nothing was written, and the sync has already
 * been requested over the message bus — so the correct behaviour is to hold the
 * manager's typed input, poll until the employee exists in Humanity, and replay
 * their original request automatically. Anything that looks like an error here
 * trains managers to retype work they never lost.
 *
 * `awaiting_tcp_connector` is a distinct state: the employee is already in the
 * payroll system and is waiting on ITS connector, which runs on its own schedule
 * (roughly every five minutes). There is nothing to re-request, so the manual
 * sync endpoint correctly no-ops and this hook does not offer it.
 */

/** Give up polling after this long and hand control back to the user. */
const MAX_WAIT_MS = 120_000;
const DEFAULT_POLL_SECONDS = 5;
/** Manual sync calls within this window are de-duplicated upstream anyway. */
const MANUAL_SYNC_COOLDOWN_MS = 60_000;

export interface EmployeeSyncWait {
  employeeId: string;
  employeeName: string;
  status: EmployeeSyncRequestStatus;
  elapsedSeconds: number;
  /** True once MAX_WAIT_MS has passed without the sync landing. */
  timedOut: boolean;
  lastError: string | null;
}

export interface UseEmployeeSyncOptions {
  storeId: string | null;
  /** Called once the employee becomes schedulable — replay the original write here. */
  onSynced: (employeeId: string) => void;
}

export interface UseEmployeeSyncResult {
  wait: EmployeeSyncWait | null;
  /** Begin waiting on an employee, from a 409's error payload. */
  begin: (info: {
    employeeId: string;
    employeeName: string;
    status?: EmployeeSyncRequestStatus | null;
    retryAfterSeconds?: number | null;
    lastError?: string | null;
  }) => void;
  /** Abandon the wait (the manager cancelled, or the dialog closed). */
  cancel: () => void;
  /** Ask HiringPizza to try again. No-ops upstream while awaiting the connector. */
  requestManualSync: () => Promise<void>;
  isRequestingSync: boolean;
}

export function useEmployeeSync({
  storeId,
  onSynced,
}: UseEmployeeSyncOptions): UseEmployeeSyncResult {
  const [wait, setWait] = useState<EmployeeSyncWait | null>(null);
  const [isRequestingSync, setIsRequestingSync] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastManualSyncRef = useRef<number>(0);
  const pollSecondsRef = useRef<number>(DEFAULT_POLL_SECONDS);
  /** Kept in a ref so the poll loop never closes over a stale callback. */
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    setWait(null);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  /** One poll, then either resolve, schedule the next, or time out. */
  const poll = useCallback(
    async (employeeId: string) => {
      if (!storeId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const raw = await schedulingService.getEmployeeSyncStatus(
          storeId,
          employeeId,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        const status = adaptEmployeeSyncStatus(raw);

        if (status.synced) {
          clearTimers();
          setWait(null);
          onSyncedRef.current(employeeId);
          return;
        }

        const elapsed = Date.now() - startedAtRef.current;
        const timedOut = elapsed >= MAX_WAIT_MS;

        setWait((prev) =>
          prev && prev.employeeId === employeeId
            ? {
                ...prev,
                status: status.syncRequest?.status ?? prev.status,
                elapsedSeconds: Math.round(elapsed / 1000),
                timedOut,
                lastError: status.syncRequest?.lastError ?? null,
              }
            : prev,
        );

        if (!timedOut) {
          timerRef.current = setTimeout(
            () => void poll(employeeId),
            pollSecondsRef.current * 1000,
          );
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        // A failed poll is not a failed sync — keep waiting until the cap, but
        // surface the reason so the manager is not staring at a silent spinner.
        const parsed = parseSchedulingError(err, "Could not check setup status.");
        const elapsed = Date.now() - startedAtRef.current;
        const timedOut = elapsed >= MAX_WAIT_MS;

        setWait((prev) =>
          prev && prev.employeeId === employeeId
            ? {
                ...prev,
                elapsedSeconds: Math.round(elapsed / 1000),
                timedOut,
                lastError: parsed.message,
              }
            : prev,
        );

        if (!timedOut) {
          timerRef.current = setTimeout(
            () => void poll(employeeId),
            pollSecondsRef.current * 1000,
          );
        }
      }
    },
    [storeId, clearTimers],
  );

  const begin = useCallback<UseEmployeeSyncResult["begin"]>(
    ({ employeeId, employeeName, status, retryAfterSeconds, lastError }) => {
      clearTimers();
      startedAtRef.current = Date.now();
      pollSecondsRef.current = retryAfterSeconds ?? DEFAULT_POLL_SECONDS;
      setWait({
        employeeId,
        employeeName,
        status: status ?? "requested",
        elapsedSeconds: 0,
        timedOut: false,
        lastError: lastError ?? null,
      });
      timerRef.current = setTimeout(
        () => void poll(employeeId),
        pollSecondsRef.current * 1000,
      );
    },
    [clearTimers, poll],
  );

  const requestManualSync = useCallback(async () => {
    if (!storeId || !wait) return;
    // Upstream de-duplicates within 60s, so a double-click is harmless — but
    // there is no point spending the request either.
    if (Date.now() - lastManualSyncRef.current < MANUAL_SYNC_COOLDOWN_MS) return;

    setIsRequestingSync(true);
    lastManualSyncRef.current = Date.now();
    try {
      await schedulingService.requestEmployeeSync(storeId, wait.employeeId);
      // Restart the clock so the manager gets another full window.
      startedAtRef.current = Date.now();
      setWait((prev) =>
        prev ? { ...prev, timedOut: false, elapsedSeconds: 0, lastError: null } : prev,
      );
      timerRef.current = setTimeout(
        () => void poll(wait.employeeId),
        pollSecondsRef.current * 1000,
      );
    } catch (err) {
      const parsed = parseSchedulingError(err, "Could not request setup.");
      setWait((prev) => (prev ? { ...prev, lastError: parsed.message } : prev));
    } finally {
      setIsRequestingSync(false);
    }
  }, [storeId, wait, poll]);

  return { wait, begin, cancel, requestManualSync, isRequestingSync };
}
