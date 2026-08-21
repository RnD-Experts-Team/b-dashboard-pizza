"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCleaningStore } from "@/lib/store/cleaning.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";

/** Local YYYY-MM-DD for "today" (no timezone shift). */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * The effective numeric store id for cleaning calls: the selected store's
 * numeric `id`, falling back to the first overview store (mirrors QA page).
 */
export function useEffectiveStoreId(): number | null {
  const { selectedStore } = useSelectedStoreStore();
  const { overviewStores } = useAuthStore();
  const raw = selectedStore?.id ?? overviewStores?.[0]?.id;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * The selected store's human-readable CODE (e.g. "03795-00003"), used to scope
 * the employee-system lookup (GET /api/v1/employees?storeIds[]=<code>).
 */
export function useEffectiveStoreCode(): string | null {
  const { selectedStore } = useSelectedStoreStore();
  const { overviewStores } = useAuthStore();
  return selectedStore?.storeId ?? overviewStores?.[0]?.storeId ?? null;
}

/** Track 1 — Due Today + task actions for the selected store. */
export function useCleaningDue() {
  const storeId = useEffectiveStoreId();
  const storeCode = useEffectiveStoreCode();
  const [date, setDate] = useState<string>(todayIso());

  const {
    dueData,
    dueLoading,
    dueError,
    fetchDue,
    completeTask,
    uncompleteTask,
  } = useCleaningStore();

  useEffect(() => {
    if (storeId != null) fetchDue(storeId, date);
  }, [storeId, date, fetchDue]);

  const refetch = useCallback(() => {
    if (storeId != null) fetchDue(storeId, date);
  }, [storeId, date, fetchDue]);

  return {
    storeId,
    storeCode,
    date,
    setDate,
    dueData,
    dueLoading,
    dueError,
    refetch,
    completeTask,
    uncompleteTask,
  };
}

/** Track 1 — Task definitions: list + create + edit + delete. */
export function useCleaningTasks() {
  const {
    tasks,
    tasksLoading,
    tasksError,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  } = useCleaningStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    tasksLoading,
    tasksError,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
}

/** Default ISO week key like `2026-W30` for the current date. */
export function currentWeekKey(): string {
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Track 2 — Evaluation grid state + cell mutations. */
export function useCleaningEvaluation() {
  const {
    grid,
    gridLoading,
    gridError,
    periodType,
    periodKey,
    fetchGrid,
    setItemCell,
    setChartCell,
    addInspectionItem,
    removeInspectionItem,
    finalizeStore,
  } = useCleaningStore();

  const defaultKey = useMemo(() => currentWeekKey(), []);

  useEffect(() => {
    const key = periodKey || defaultKey;
    fetchGrid(periodType || "week", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    grid,
    gridLoading,
    gridError,
    periodType: periodType || "week",
    periodKey: periodKey || defaultKey,
    fetchGrid,
    setItemCell,
    setChartCell,
    addInspectionItem,
    removeInspectionItem,
    finalizeStore,
  };
}
