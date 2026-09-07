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
import { adaptActualShift } from "@/lib/scheduling/adapters";
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
  /**
   * Mark a planned shift as a no-show when it has no actual yet.
   *
   * `/absent` addresses an ACTUAL, and an unreviewed plan has none — so this
   * creates one from the plan and flips it, in that order, behind a single
   * refetch. It used to stop after the create and ask the user to come back and
   * repeat the action, which meant "mark no attendance" quietly did something
   * else: it recorded them as having worked the shift as planned.
   */
  markAbsentForPlan: (plannedShift: Shift, note?: string) => Promise<boolean>;
  /**
   * Accept an unlinked clock-in as the actual for a planned shift.
   *
   * The timeclock sends punches with `planned_shift_id: null`, so nothing ties
   * them to the shift they belong to. Agreeing writes a LINKED actual carrying
   * the punch's times, then removes the unlinked punch — without the second
   * step the same work would be counted twice, once through the plan and once
   * as ad-hoc coverage.
   *
   * Create-then-delete on purpose: if the delete fails you get a visible
   * duplicate, which a manager can fix. The reverse order risks losing the only
   * record of the punch.
   */
  agreeClockIn: (plannedShift: Shift, clockIn: ActualShift) => Promise<boolean>;
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

  const agreeClockIn = useCallback(
    (plannedShift: Shift, clockIn: ActualShift) =>
      run(
        async () => {
          await schedulingService.saveActualShift(storeId!, {
            employee_id:
              Number(plannedShift.employeeId) || plannedShift.employeeId,
            shift_date: plannedShift.shiftDate,
            start_time: clockIn.startTime,
            end_time: clockIn.endTime,
            label: plannedShift.label || undefined,
            shift_type: plannedShift.type || undefined,
            note: clockIn.note || undefined,
            shift_assignment_id: plannedShift.id,
            // `status` stays absent — the server compares against the plan and
            // decides `confirmed` or `modified` itself.
          });
          await schedulingService.deleteActualShift(storeId!, clockIn.id);
        },
        "Could not accept this clock-in.",
        "Clock-in accepted",
      ),
    [run, storeId],
  );

  const markAbsentForPlan = useCallback(
    (plannedShift: Shift, note?: string) =>
      run(
        async () => {
          const created = await schedulingService.saveActualShift(storeId!, {
            employee_id:
              Number(plannedShift.employeeId) || plannedShift.employeeId,
            shift_date: plannedShift.shiftDate,
            start_time: plannedShift.startTime,
            end_time: plannedShift.endTime,
            label: plannedShift.label || undefined,
            shift_type: plannedShift.type || undefined,
            shift_assignment_id: plannedShift.id,
          });
          const id = adaptActualShift(created).id;
          // Without an id the second call would address nothing, and silently
          // leaving a "worked as planned" record behind is the exact failure
          // this replaced. Say so instead.
          if (!id) {
            throw new Error(
              "Recorded the shift, but could not mark it as a no-show. Open the card and mark it from there.",
            );
          }
          await schedulingService.markActualAbsent(storeId!, id, note);
        },
        "Could not mark this as a no-show.",
        "Marked as a no-show",
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
    markAbsentForPlan,
    agreeClockIn,
    deleteActual,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
