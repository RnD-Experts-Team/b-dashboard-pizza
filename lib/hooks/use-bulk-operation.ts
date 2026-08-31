"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import { adaptBulkOperation } from "@/lib/scheduling/adapters";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { BulkOperation } from "@/types/scheduling.types";

/**
 * Runs an async bulk operation and polls it to completion.
 *
 * Every bulk endpoint returns 202 with a batch id and does the real work on a
 * background worker, because each item fans out into its own Humanity call.
 *
 * There is deliberately NO ROLLBACK on the backend: deleting shifts that were
 * already created, in order to undo, is more destructive than a partial week —
 * especially once employees have seen it. So `completed_with_errors` is a normal
 * terminal outcome, not a crash, and `retryFailed` re-queues only the failures.
 */

const POLL_INTERVAL_MS = 2_000;
/** Stop polling eventually rather than hammering a stuck batch forever. */
const MAX_POLL_MS = 5 * 60_000;

function isTerminal(status: BulkOperation["status"]): boolean {
  return (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "failed"
  );
}

export interface UseBulkOperationOptions {
  storeId: string | null;
  /** Called once the batch reaches a terminal state, to refresh the grid. */
  onSettled: () => void;
}

export interface UseBulkOperationResult {
  operation: BulkOperation | null;
  error: SchedulingError | null;
  isStarting: boolean;
  isRetrying: boolean;
  /**
   * Kick off a bulk operation. `start` receives the trigger call itself, so the
   * caller decides which endpoint to hit while polling stays here.
   */
  run: (
    trigger: () => Promise<unknown>,
    opts?: { fallbackMessage?: string },
  ) => Promise<void>;
  retryFailed: () => Promise<void>;
  dismiss: () => void;
}

export function useBulkOperation({
  storeId,
  onSettled,
}: UseBulkOperationOptions): UseBulkOperationResult {
  const [operation, setOperation] = useState<BulkOperation | null>(null);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const poll = useCallback(
    async (batchId: string) => {
      if (!storeId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const raw = await schedulingService.pollBulk(
          storeId,
          batchId,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        const next = adaptBulkOperation(raw);
        setOperation(next);

        if (isTerminal(next.status)) {
          clearTimers();
          // Refresh regardless of outcome: even a partial run changed the week.
          onSettledRef.current();
          return;
        }

        if (Date.now() - startedAtRef.current > MAX_POLL_MS) {
          clearTimers();
          setError(
            parseSchedulingError(
              new Error(
                "This is taking longer than expected. It may still be running — reload the week in a moment to check.",
              ),
            ),
          );
          onSettledRef.current();
          return;
        }

        timerRef.current = setTimeout(() => void poll(batchId), POLL_INTERVAL_MS);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(
          err,
          "Lost track of this operation. It may still be running.",
        );
        if (handleUnauthorized(parsed.status)) return;
        clearTimers();
        setError(parsed);
        // The batch may well have continued, so the week is still stale.
        onSettledRef.current();
      }
    },
    [storeId, clearTimers],
  );

  const run = useCallback<UseBulkOperationResult["run"]>(
    async (trigger, opts) => {
      if (!storeId) return;
      clearTimers();
      setError(null);
      setIsStarting(true);
      startedAtRef.current = Date.now();

      try {
        const raw = await trigger();
        const started = adaptBulkOperation(raw);
        setOperation(started);

        if (isTerminal(started.status)) {
          onSettledRef.current();
          return;
        }
        timerRef.current = setTimeout(
          () => void poll(started.id),
          POLL_INTERVAL_MS,
        );
      } catch (err) {
        const parsed = parseSchedulingError(
          err,
          opts?.fallbackMessage ?? "Could not start this operation.",
        );
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed);
        setOperation(null);
      } finally {
        setIsStarting(false);
      }
    },
    [storeId, clearTimers, poll],
  );

  /**
   * Re-queue only the failed items. Successful ones are left alone and the
   * failure counter is rolled back upstream, so progress stays truthful.
   */
  const retryFailed = useCallback(async () => {
    if (!storeId || !operation) return;
    setIsRetrying(true);
    setError(null);
    try {
      const raw = await schedulingService.retryFailedBulk(storeId, operation.id);
      const next = adaptBulkOperation(raw);
      setOperation(next);
      if (isTerminal(next.status)) {
        onSettledRef.current();
      } else {
        startedAtRef.current = Date.now();
        timerRef.current = setTimeout(() => void poll(next.id), POLL_INTERVAL_MS);
      }
    } catch (err) {
      const parsed = parseSchedulingError(err, "Could not retry the failed items.");
      if (handleUnauthorized(parsed.status)) return;
      setError(parsed);
    } finally {
      setIsRetrying(false);
    }
  }, [storeId, operation, poll]);

  const dismiss = useCallback(() => {
    clearTimers();
    setOperation(null);
    setError(null);
  }, [clearTimers]);

  return { operation, error, isStarting, isRetrying, run, retryFailed, dismiss };
}
