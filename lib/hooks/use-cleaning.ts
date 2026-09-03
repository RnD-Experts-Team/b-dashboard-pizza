"use client";

import { useCallback, useEffect, useState } from "react";
import { useCleaningStore } from "@/lib/store/cleaning.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { usePeriodOptions } from "@/lib/hooks/use-cleaning-periods";

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

/**
 * Track 2 — Evaluation grid state + cell mutations.
 *
 * Period keys are never computed locally (see the migration guide §4 — a
 * local ISO-week key silently diverges from the backend's accounting-calendar
 * numbering on 2026-12-29). Until the store has a `periodKey`, this resolves
 * one from `GET /cleaning/periods`' server-reported `current` and waits;
 * `gridLoading`/`gridError` reflect that resolution step too, so callers
 * don't need to special-case "no key yet" separately from "grid loading".
 */
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
    updateInspectionItemWeight,
    allocateWeight,
    deleteAllocation,
    finalizeStore,
    reopenStore,
  } = useCleaningStore();

  const effectivePeriodType = periodType || "week";
  const resolvingKey = !periodKey;
  const {
    current: resolvedCurrentKey,
    loading: periodsLoading,
    error: periodsError,
  } = usePeriodOptions(effectivePeriodType);

  useEffect(() => {
    if (periodKey || !resolvedCurrentKey) return;
    fetchGrid(effectivePeriodType, resolvedCurrentKey);
  }, [periodKey, resolvedCurrentKey, effectivePeriodType, fetchGrid]);

  return {
    grid,
    gridLoading: gridLoading || (resolvingKey && periodsLoading),
    gridError: gridError ?? (resolvingKey ? periodsError : null),
    periodType: effectivePeriodType,
    periodKey,
    fetchGrid,
    setItemCell,
    setChartCell,
    addInspectionItem,
    removeInspectionItem,
    updateInspectionItemWeight,
    allocateWeight,
    deleteAllocation,
    finalizeStore,
    reopenStore,
  };
}
