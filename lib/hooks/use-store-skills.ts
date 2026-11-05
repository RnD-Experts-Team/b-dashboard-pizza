"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { handleUnauthorized, schedulingService } from "@/lib/api/services/scheduling.service";
import { parseSchedulingError } from "@/lib/scheduling/errors";
import type { StoreSkillsOverview } from "@/types/skills.types";

/**
 * One store's employees × skills ratings (read-only), for the Labor
 * dashboard. `storeId` is the store NUMBER ("03795-00021"); null fetches
 * nothing. Editing stays on the Skills page (`useSkillsOverview`).
 */
export function useStoreSkills(storeId: string | null) {
  const [data, setData] = useState<StoreSkillsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!storeId) {
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setData(null);

    const load = async () => {
      try {
        const result = await schedulingService.getSkillsOverview([storeId], controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load employee skills.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();

    return () => controller.abort();
  }, [storeId, revision]);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  return { data, isLoading, error, refetch };
}
