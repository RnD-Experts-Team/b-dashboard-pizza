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
import type { SkillsOverviewEmployee, StoreSkillsOverview } from "@/types/skills.types";

/**
 * Every active employee of the given stores (store CODES) against every skill.
 * `null` fetches nothing — pass it while the stores aren't known or allowed.
 *
 * `rate` / `remove` write through the employee's own store and patch the row
 * in place, so the table and the stats move without a refetch. They throw a
 * `SchedulingError` for the editor to show.
 */
export function useSkillsOverview(storeIds: string[] | null) {
  const [data, setData] = useState<StoreSkillsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // A stable key, so a new array with the same stores doesn't refetch.
  const storesKey = storeIds === null ? null : [...storeIds].sort().join(",");

  useEffect(() => {
    if (storesKey === null || storesKey === "") {
      setData(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await schedulingService.getSkillsOverview(storesKey.split(","), controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load employee skills.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();

    return () => controller.abort();
  }, [storesKey, revision]);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  const patch = useCallback(
    (employeeId: string, change: (row: SkillsOverviewEmployee) => SkillsOverviewEmployee) =>
      setData((current) =>
        current && {
          ...current,
          employees: current.employees.map((e) => (e.id === employeeId ? change(e) : e)),
        },
      ),
    [],
  );

  const rate = useCallback(
    async (storeCode: string, employeeId: string, skillId: string, rating: number, notes: string | null) => {
      try {
        const row = await schedulingService.rateEmployeeSkill(storeCode, employeeId, skillId, { rating, notes });
        patch(employeeId, (e) => ({
          ...e,
          ratings: { ...e.ratings, [skillId]: { rating: row.rating ?? rating, notes: row.notes } },
          alert_skill_ids: row.alert
            ? Array.from(new Set([...e.alert_skill_ids, skillId]))
            : e.alert_skill_ids.filter((id) => id !== skillId),
        }));
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not save the rating.");
        handleUnauthorized(parsed.status);
        throw parsed;
      }
    },
    [patch],
  );

  const remove = useCallback(
    async (storeCode: string, employeeId: string, skillId: string) => {
      try {
        await schedulingService.deleteEmployeeSkill(storeCode, employeeId, skillId);
        patch(employeeId, (e) => {
          const ratings = { ...e.ratings };
          delete ratings[skillId];
          return { ...e, ratings, alert_skill_ids: e.alert_skill_ids.filter((id) => id !== skillId) };
        });
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not remove the rating.");
        handleUnauthorized(parsed.status);
        throw parsed;
      }
    },
    [patch],
  );

  return { data, isLoading, error, refetch, rate, remove };
}
