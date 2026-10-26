"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { EmployeeSkills } from "@/types/skills.types";

/**
 * One employee's ratings on every skill (OperationsPizza).
 *
 * `storeId` is the store CODE the profile page carries; the rating itself is
 * the employee's, so any of their stores reads the same one. Saving a rating
 * a minor shouldn't hold is never refused — the row comes back with `alert`.
 */
export interface UseEmployeeSkillsResult {
  data: EmployeeSkills | null;
  isLoading: boolean;
  error: SchedulingError | null;
  refetch: () => void;
  /** Throws a `SchedulingError` so the row can show it inline. */
  rate: (skillId: string, rating: number, notes: string | null) => Promise<void>;
  remove: (skillId: string) => Promise<void>;
}

export function useEmployeeSkills(
  storeId: string | null,
  employeeId: string | null,
): UseEmployeeSkillsResult {
  const [data, setData] = useState<EmployeeSkills | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!storeId || !employeeId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await schedulingService.getEmployeeSkills(storeId, employeeId, controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load this employee's skills.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();

    return () => controller.abort();
  }, [storeId, employeeId, revision]);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  const rate = useCallback(
    async (skillId: string, rating: number, notes: string | null) => {
      if (!storeId || !employeeId) return;
      try {
        const row = await schedulingService.rateEmployeeSkill(storeId, employeeId, skillId, { rating, notes });
        setData((current) =>
          current && {
            ...current,
            skills: current.skills.map((s) => (s.skill.id === skillId ? row : s)),
          },
        );
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not save the rating.");
        handleUnauthorized(parsed.status);
        throw parsed;
      }
    },
    [storeId, employeeId],
  );

  const remove = useCallback(
    async (skillId: string) => {
      if (!storeId || !employeeId) return;
      try {
        await schedulingService.deleteEmployeeSkill(storeId, employeeId, skillId);
        setData((current) =>
          current && {
            ...current,
            skills: current.skills.map((s) =>
              s.skill.id === skillId ? { ...s, rating: null, notes: null, updated_at: null, alert: false } : s,
            ),
          },
        );
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not remove the rating.");
        handleUnauthorized(parsed.status);
        throw parsed;
      }
    },
    [storeId, employeeId],
  );

  return { data, isLoading, error, refetch, rate, remove };
}
