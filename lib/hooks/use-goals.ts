"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { goalsService, GoalsError } from "@/lib/api/services/goals.service";
import type {
  GoalsListResponse,
  Goal,
  GoalMetric,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateGoalMetricPayload,
} from "@/types/goal.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cancel / abort helper                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useGoalsList — fetch all goals for a store                              */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseGoalsListReturn {
  data: GoalsListResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useGoalsList(storeId: string | undefined): UseGoalsListReturn {
  const [data, setData] = useState<GoalsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchGoals = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (!storeId) return;
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const result = await goalsService.getGoals(storeId, signal);
        if (signal?.aborted) return;
        setData(result);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof GoalsError) setError(err.message);
        else setError(err instanceof Error ? err.message : "Failed to load goals.");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [storeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchGoals(controller.signal);
    return () => controller.abort();
  }, [fetchGoals]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    fetchGoals(controller.signal, true);
  }, [fetchGoals]);

  return { data, isLoading, isRefreshing, error, refetch, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCreateGoal                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCreateGoalReturn {
  createGoal: (storeId: string, payload: CreateGoalPayload) => Promise<Goal>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateGoal(): UseCreateGoalReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const createGoal = useCallback(async (storeId: string, payload: CreateGoalPayload): Promise<Goal> => {
    setIsCreating(true);
    setError(null);
    try {
      return await goalsService.createGoal(storeId, payload);
    } catch (err) {
      const message = err instanceof GoalsError ? err.message : err instanceof Error ? err.message : "Failed to create goal.";
      setError(message);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createGoal, isCreating, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useUpdateGoal                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseUpdateGoalReturn {
  updateGoal: (storeId: string, goalId: number, payload: UpdateGoalPayload) => Promise<Goal>;
  isUpdating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useUpdateGoal(): UseUpdateGoalReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const updateGoal = useCallback(async (storeId: string, goalId: number, payload: UpdateGoalPayload): Promise<Goal> => {
    setIsUpdating(true);
    setError(null);
    try {
      return await goalsService.updateGoal(storeId, goalId, payload);
    } catch (err) {
      const message = err instanceof GoalsError ? err.message : err instanceof Error ? err.message : "Failed to update goal.";
      setError(message);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { updateGoal, isUpdating, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeleteGoal                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeleteGoalReturn {
  deleteGoal: (storeId: string, goalId: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteGoal(): UseDeleteGoalReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const deleteGoal = useCallback(async (storeId: string, goalId: number): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await goalsService.deleteGoal(storeId, goalId);
    } catch (err) {
      const message = err instanceof GoalsError ? err.message : err instanceof Error ? err.message : "Failed to delete goal.";
      setError(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteGoal, isDeleting, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useGoalMetricsList                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseGoalMetricsListReturn {
  metrics: GoalMetric[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useGoalMetricsList(): UseGoalMetricsListReturn {
  const [metrics, setMetrics] = useState<GoalMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchMetrics = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const result = await goalsService.getGoalMetrics(signal);
      if (signal?.aborted) return;
      setMetrics(result);
    } catch (err) {
      if (isCanceledError(err) || signal?.aborted) return;
      if (err instanceof GoalsError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Failed to load goal metrics.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchMetrics(controller.signal);
    return () => controller.abort();
  }, [fetchMetrics]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    fetchMetrics(controller.signal, true);
  }, [fetchMetrics]);

  return { metrics, isLoading, isRefreshing, error, refetch, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCreateGoalMetric                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCreateGoalMetricReturn {
  createGoalMetric: (payload: CreateGoalMetricPayload) => Promise<GoalMetric>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateGoalMetric(): UseCreateGoalMetricReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const createGoalMetric = useCallback(async (payload: CreateGoalMetricPayload): Promise<GoalMetric> => {
    setIsCreating(true);
    setError(null);
    try {
      return await goalsService.createGoalMetric(payload);
    } catch (err) {
      const message = err instanceof GoalsError ? err.message : err instanceof Error ? err.message : "Failed to create goal metric.";
      setError(message);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createGoalMetric, isCreating, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeleteGoalMetric                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeleteGoalMetricReturn {
  deleteGoalMetric: (goalMetricId: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteGoalMetric(): UseDeleteGoalMetricReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const deleteGoalMetric = useCallback(async (goalMetricId: number): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await goalsService.deleteGoalMetric(goalMetricId);
    } catch (err) {
      const message = err instanceof GoalsError ? err.message : err instanceof Error ? err.message : "Failed to delete goal metric.";
      setError(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteGoalMetric, isDeleting, error, clearError };
}
