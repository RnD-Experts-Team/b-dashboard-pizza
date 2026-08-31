"use client";

import { useCallback, useState } from "react";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { ActualShift, Shift } from "@/types/scheduling.types";

/**
 * Recording what actually happened, as opposed to what was planned.
 *
 * These rows are LOCAL to OperationsPizza and are never pushed to Humanity —
 * worked time belongs to the payroll system, shifts belong to Humanity, and
 * actuals are the record of the gap between plan and reality.
 *
 * The single most important rule here: `status` is DERIVED SERVER-SIDE from the
 * times and is never sent by the client. Same times as the plan gives
 * `confirmed`, different gives `modified`, no planned counterpart gives `added`,
 * and the absent endpoint gives `absent`. The old client-side derivation was
 * both duplicated logic and subtly wrong — it compared only times, so a
 * label-only edit was reported as `confirmed` despite its own docs saying
 * otherwise. Read the status back from the response instead.
 */

export interface SaveActualInput {
  employeeId: string;
  /** Absolute date, taken from the week payload — never computed. */
  shiftDate: string;
  startTime: string;
  endTime: string;
  label?: string;
  shiftType?: string;
  note?: string;
  /**
   * The originating ASSIGNMENT id. Passing it AMENDS that assignment's existing
   * actual rather than stacking a duplicate, so this is safe to call twice.
   * Omit for ad-hoc coverage, which comes back as `status: "added"`.
   */
  assignmentId?: string;
}

export interface UseActualShiftMutationsOptions {
  storeId: string | null;
  refetchWeek: () => void;
  onSuccess?: (message: string) => void;
}

export interface UseActualShiftMutationsResult {
  /** One-click "worked exactly as planned" against the assignment id. */
  confirmAsPlanned: (plannedShift: Shift) => Promise<boolean>;
  saveActual: (input: SaveActualInput) => Promise<boolean>;
  /**
   * Edit an actual we already hold the id for.
   *
   * Needed for AD-HOC coverage: it has no planned shift behind it, so there is
   * no assignment id to amend against. Posting to the collection endpoint
   * without one would create a second row instead of editing this one.
   */
  updateActual: (
    actualId: string,
    input: Omit<SaveActualInput, "employeeId" | "shiftDate" | "assignmentId">,
  ) => Promise<boolean>;
  markAbsent: (actual: ActualShift, note?: string) => Promise<boolean>;
  deleteActual: (actual: ActualShift) => Promise<boolean>;
  isSubmitting: boolean;
  error: SchedulingError | null;
  clearError: () => void;
}

export function useActualShiftMutations({
  storeId,
  refetchWeek,
  onSuccess,
}: UseActualShiftMutationsOptions): UseActualShiftMutationsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);

  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      fallback: string,
      successMessage: string,
    ) => {
      if (!storeId) return false;
      setIsSubmitting(true);
      setError(null);
      try {
        await action();
        refetchWeek();
        onSuccess?.(successMessage);
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(err, fallback);
        if (handleUnauthorized(parsed.status)) return false;
        setError(parsed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [storeId, refetchWeek, onSuccess],
  );

  const confirmAsPlanned = useCallback(
    (plannedShift: Shift) =>
      run(
        () => schedulingService.confirmActual(storeId!, plannedShift.id),
        "Could not confirm this shift.",
        "Marked as worked as planned",
      ),
    [run, storeId],
  );

  const saveActual = useCallback(
    (input: SaveActualInput) =>
      run(
        () =>
          schedulingService.saveActualShift(storeId!, {
            employee_id: Number(input.employeeId) || input.employeeId,
            shift_date: input.shiftDate,
            start_time: input.startTime,
            end_time: input.endTime,
            label: input.label || undefined,
            shift_type: input.shiftType || undefined,
            note: input.note || undefined,
            // Present means amend; absent means ad-hoc coverage.
            shift_assignment_id: input.assignmentId,
            // `status` is deliberately absent — the server derives it.
          }),
        "Could not save the actual time.",
        input.assignmentId ? "Actual time saved" : "Coverage added",
      ),
    [run, storeId],
  );

  const updateActual = useCallback<UseActualShiftMutationsResult["updateActual"]>(
    (actualId, input) =>
      run(
        () =>
          schedulingService.updateActualShift(storeId!, actualId, {
            start_time: input.startTime,
            end_time: input.endTime,
            label: input.label || undefined,
            shift_type: input.shiftType || undefined,
            note: input.note || undefined,
            // `status` stays absent — the server re-derives it from the times.
          }),
        "Could not update this entry.",
        "Coverage updated",
      ),
    [run, storeId],
  );

  const markAbsent = useCallback(
    (actual: ActualShift, note?: string) =>
      run(
        () => schedulingService.markActualAbsent(storeId!, actual.id, note),
        "Could not mark this as a no-show.",
        "Marked as no attendance",
      ),
    [run, storeId],
  );

  const deleteActual = useCallback(
    (actual: ActualShift) =>
      run(
        () => schedulingService.deleteActualShift(storeId!, actual.id),
        "Could not remove this entry.",
        // Deleting a linked actual reverts the planned shift to un-reviewed;
        // deleting a standalone one removes the coverage entirely.
        actual.plannedShiftId
          ? "Reverted to planned schedule"
          : "Coverage removed",
      ),
    [run, storeId],
  );

  return {
    confirmAsPlanned,
    saveActual,
    updateActual,
    markAbsent,
    deleteActual,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
