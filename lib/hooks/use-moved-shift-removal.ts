"use client";

import { useCallback, useRef, useState } from "react";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import { parseSchedulingError } from "@/lib/scheduling/errors";
import type { RemovedShift } from "@/lib/scheduling/draft.store";

/**
 * Deletes the ORIGINALS of shifts that were moved, once their replacements have
 * been created.
 *
 * Moving a saved shift is staged like every other edit in the planned view: the
 * original is hidden, a draft stands in for it, and Save creates the draft first
 * and only then comes here. Create-then-delete is the whole point of the order —
 * if anything goes wrong the manager is left with a duplicate to tidy up, never
 * with a shift that vanished.
 *
 * One request per shift, in turn (there is no bulk delete). Outcomes:
 *   - deleted, or already gone (404): done.
 *   - 409 SHIFT_PUBLISHED: employees may already have been told about the shift.
 *     The run PAUSES and exposes `warning`; confirming deletes the rest with
 *     `confirm=true`, so the manager is asked once however many shifts moved.
 *   - anything else: that original is reported back as failed, and the caller
 *     keeps it pending so the next Save retries just those.
 */

export interface MovedRemovalResult {
  /** Originals that are gone (or were already). */
  removed: RemovedShift[];
  /** Originals still on the server, to be retried. */
  failed: RemovedShift[];
  /** The server's wording for the last failure, if any. */
  failureMessage: string | null;
}

interface Held {
  queue: RemovedShift[];
  removed: RemovedShift[];
  failed: RemovedShift[];
  message: string | null;
}

export interface UseMovedShiftRemovalOptions {
  storeId: string | null;
  /** Refetch the week once the deletes are done. */
  refetchWeek: () => void | Promise<void>;
  onFinished: (result: MovedRemovalResult) => void;
}

export interface UseMovedShiftRemovalResult {
  start: (items: RemovedShift[]) => void;
  isRunning: boolean;
  /** Non-null while paused on "this week is already published". */
  warning: { message: string; count: number } | null;
  confirmWarning: () => void;
  cancelWarning: () => void;
}

export function useMovedShiftRemoval({
  storeId,
  refetchWeek,
  onFinished,
}: UseMovedShiftRemovalOptions): UseMovedShiftRemovalResult {
  const [isRunning, setIsRunning] = useState(false);
  const [warning, setWarning] = useState<{
    message: string;
    count: number;
  } | null>(null);
  const heldRef = useRef<Held | null>(null);
  const busyRef = useRef(false);
  // Read through refs so a long run always reports to the CURRENT callbacks.
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const refetchRef = useRef(refetchWeek);
  refetchRef.current = refetchWeek;

  const finish = useCallback(async (result: MovedRemovalResult) => {
    heldRef.current = null;
    setWarning(null);
    try {
      await refetchRef.current();
    } finally {
      busyRef.current = false;
      setIsRunning(false);
    }
    onFinishedRef.current(result);
  }, []);

  const drain = useCallback(
    async (queue: RemovedShift[], carried: Held | null, confirm: boolean) => {
      if (!storeId) {
        busyRef.current = false;
        return;
      }
      const removed = [...(carried?.removed ?? [])];
      const failed = [...(carried?.failed ?? [])];
      let message = carried?.message ?? null;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        try {
          await schedulingService.deleteShift(storeId, item.shiftId, confirm);
          removed.push(item);
        } catch (err) {
          const parsed = parseSchedulingError(
            err,
            "Could not remove the original shift.",
          );
          if (handleUnauthorized(parsed.status)) {
            busyRef.current = false;
            setIsRunning(false);
            return;
          }
          // Already gone — somebody else deleted it, which is what we wanted.
          if (parsed.status === 404) {
            removed.push(item);
            continue;
          }
          if (parsed.needsConfirm && !confirm) {
            heldRef.current = { queue: queue.slice(i), removed, failed, message };
            setWarning({ message: parsed.message, count: queue.length - i });
            setIsRunning(false);
            return;
          }
          failed.push(item);
          message = parsed.message;
        }
      }

      await finish({ removed, failed, failureMessage: message });
    },
    [storeId, finish],
  );

  const start = useCallback(
    (items: RemovedShift[]) => {
      if (items.length === 0 || busyRef.current) return;
      busyRef.current = true;
      setIsRunning(true);
      void drain(items, null, false);
    },
    [drain],
  );

  const confirmWarning = useCallback(() => {
    const held = heldRef.current;
    if (!held) return;
    setWarning(null);
    setIsRunning(true);
    void drain(held.queue, held, true);
  }, [drain]);

  const cancelWarning = useCallback(() => {
    const held = heldRef.current;
    if (!held) return;
    void finish({
      removed: held.removed,
      failed: [...held.failed, ...held.queue],
      failureMessage: null,
    });
  }, [finish]);

  return { start, isRunning, warning, confirmWarning, cancelWarning };
}
