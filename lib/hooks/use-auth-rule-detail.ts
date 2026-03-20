"use client";

import { useCallback, useEffect, useState } from "react";
import { authRuleService } from "@/lib/api/services/auth-rule.service";
import type { AuthRule } from "@/types/auth-rule.types";

interface UseAuthRuleDetailReturn {
  detail: AuthRule | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function isCanceledError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "CanceledError" ||
      error.name === "AbortError" ||
      (error as { code?: string }).code === "ERR_CANCELED")
  );
}

export function useAuthRuleDetail(ruleId: string | null): UseAuthRuleDetailReturn {
  const [detail, setDetail] = useState<AuthRule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setDetail(null);

    try {
      const response = await authRuleService.getAuthRule(id, signal);
      if (signal?.aborted) return;

      if (!response.success) {
        throw new Error(response.message || "Failed to load auth rule details.");
      }

      setDetail(response.data);
    } catch (err) {
      if (isCanceledError(err) || signal?.aborted) return;

      setError(
        err instanceof Error ? err.message : "Failed to load auth rule details."
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!ruleId) {
      setDetail(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchDetail(ruleId, controller.signal);

    return () => controller.abort();
  }, [ruleId, fetchDetail]);

  const refetch = useCallback(() => {
    if (ruleId) {
      fetchDetail(ruleId);
    }
  }, [ruleId, fetchDetail]);

  return {
    detail,
    isLoading,
    error,
    refetch,
  };
}
