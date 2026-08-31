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
import { dayIndexToDayOfWeek } from "@/lib/scheduling/week";
import type {
  AvailabilityRule,
  TimeOffEntry,
  TimeOffType,
} from "@/types/scheduling.types";

/**
 * Blocked availability and locally-entered leave.
 *
 * Two ownership rules decide what this hook is allowed to touch:
 *
 *   Availability with `source: "employee_profile"` is derived from the
 *   employee's HiringPizza record. The delete endpoint rejects it, so it is
 *   blocked here too rather than sending a request that will fail.
 *
 *   Time off with `origin: "humanity"` was approved in Humanity. Deleting it
 *   here would only bring it back on the next sync, so it is refused with an
 *   explanation instead.
 *
 * Locally-entered leave is deliberately NOT pushed to Humanity: approval is a
 * workflow that lives there, and pushing an unapproved entry would create a
 * record nobody signed off on. It is a scheduling hint, not an HR decision.
 */

export interface AvailabilityDraft {
  employeeId: string;
  scope: "weekly" | "date";
  /** Grid column index — converted to the API's canonical basis below. */
  dayIndex: number;
  specificDate?: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface TimeOffCreateDraft {
  employeeId: string;
  startDate: string;
  endDate: string;
  type: TimeOffType;
  label: string;
}

export interface UseAvailabilityMutationsOptions {
  storeId: string | null;
  /** 0=Sun..6=Sat, from the week payload. Needed for the day conversion. */
  weekStartDow: number;
  refetchWeek: () => void;
  onSuccess?: (message: string) => void;
  onRefused?: (message: string) => void;
}

export interface UseAvailabilityMutationsResult {
  addAvailability: (draft: AvailabilityDraft) => Promise<boolean>;
  deleteAvailability: (rule: AvailabilityRule) => Promise<boolean>;
  addTimeOff: (draft: TimeOffCreateDraft) => Promise<boolean>;
  deleteTimeOff: (entry: TimeOffEntry) => Promise<boolean>;
  isSubmitting: boolean;
  error: SchedulingError | null;
  clearError: () => void;
}

export function useAvailabilityMutations({
  storeId,
  weekStartDow,
  refetchWeek,
  onSuccess,
  onRefused,
}: UseAvailabilityMutationsOptions): UseAvailabilityMutationsResult {
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

  const addAvailability = useCallback(
    (draft: AvailabilityDraft) => {
      /**
       * THE one place this API departs from `day_index`.
       *
       * `POST /availability-overrides` takes `day_of_week` on the canonical
       * 0=Sun..6=Sat basis, while everything else in the API — and the whole
       * grid — uses the store-relative `day_index`. Getting this wrong blocks
       * the WRONG weekday, and nobody notices until someone is scheduled into
       * their unavailability.
       */
      const dayOfWeek = dayIndexToDayOfWeek(draft.dayIndex, weekStartDow);

      return run(
        () =>
          schedulingService.createAvailabilityOverride(storeId!, {
            employee_id: Number(draft.employeeId) || draft.employeeId,
            scope: draft.scope,
            ...(draft.scope === "weekly"
              ? { day_of_week: dayOfWeek }
              : { specific_date: draft.specificDate }),
            all_day: draft.allDay,
            ...(draft.allDay
              ? {}
              : { start_time: draft.startTime, end_time: draft.endTime }),
            reason: draft.reason || undefined,
          }),
        "Could not add this blocked time.",
        "Blocked time added",
      );
    },
    [run, storeId, weekStartDow],
  );

  const deleteAvailability = useCallback(
    async (rule: AvailabilityRule) => {
      // Profile-derived rows belong to HiringPizza; the endpoint rejects them,
      // so there is no point sending the request.
      if (rule.source === "employee_profile") {
        onRefused?.(
          "This comes from the employee's own availability record — change it in the hiring system.",
        );
        return false;
      }
      return run(
        () => schedulingService.deleteAvailabilityOverride(storeId!, rule.id),
        "Could not remove this blocked time.",
        "Blocked time removed",
      );
    },
    [run, storeId, onRefused],
  );

  const addTimeOff = useCallback(
    (draft: TimeOffCreateDraft) =>
      run(
        () =>
          schedulingService.createTimeOff(storeId!, {
            employee_id: Number(draft.employeeId) || draft.employeeId,
            // A date RANGE — the API expands it into one row per day itself.
            start_date: draft.startDate,
            end_date: draft.endDate,
            type: draft.type,
            label: draft.label || undefined,
          }),
        "Could not add this time off.",
        "Time off added",
      ),
    [run, storeId],
  );

  const deleteTimeOff = useCallback(
    async (entry: TimeOffEntry) => {
      if (entry.origin === "humanity") {
        onRefused?.(
          "This leave was approved in the HR system and has to be withdrawn there.",
        );
        return false;
      }
      return run(
        // Addresses the underlying leave, not the synthetic per-day id — so the
        // whole range goes, which is what the endpoint does.
        () => schedulingService.deleteTimeOff(storeId!, entry.timeOffId),
        "Could not remove this time off.",
        "Time off removed",
      );
    },
    [run, storeId, onRefused],
  );

  return {
    addAvailability,
    deleteAvailability,
    addTimeOff,
    deleteTimeOff,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
