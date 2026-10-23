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
import type { StoreSkillsOverview } from "@/types/skills.types";

/** Every active employee of one store (by store CODE) against every skill. */
export function useStoreSkillsOverview(storeId: string | null) {
  const [data, setData] = useState<StoreSkillsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!storeId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await schedulingService.getSkillsOverview(storeId, controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load the store's skills.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed);
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
