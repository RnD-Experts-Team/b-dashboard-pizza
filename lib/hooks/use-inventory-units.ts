"use client";

import { useCallback, useEffect } from "react";
import { useUnitsStore } from "@/lib/store/inventory-units.store";
import type { ListParams } from "@/types/inventory.types";

/**
 * Units list + mutations. Auto-fetches on mount and exposes page/refresh helpers.
 */
export function useUnits(initialParams?: ListParams) {
  const {
    units,
    pagination,
    isLoading,
    isSaving,
    isDeleting,
    error,
    saveError,
    deleteError,
    fetchUnits,
    createUnit,
    updateUnit,
    deleteUnit,
    clearErrors,
  } = useUnitsStore();

  useEffect(() => {
    fetchUnits(initialParams);
  }, [fetchUnits, initialParams]);

  const refetch = useCallback(
    (params?: ListParams) => fetchUnits({ ...initialParams, ...params }),
    [fetchUnits, initialParams]
  );

  const handlePageChange = useCallback(
    (page: number) => fetchUnits({ ...initialParams, page }),
    [fetchUnits, initialParams]
  );

  return {
    units,
    pagination,
    isLoading,
    isSaving,
    isDeleting,
    error,
    saveError,
    deleteError,
    refetch,
    handlePageChange,
    createUnit,
    updateUnit,
    deleteUnit,
    clearErrors,
  };
}

/**
 * Lightweight units list for dropdowns (e.g. the item form unit selectors).
 * Fetches up to 200 units once if the store is empty.
 */
export function useUnitOptions() {
  const { units, isLoading, fetchUnits } = useUnitsStore();

  useEffect(() => {
    if (units.length === 0) fetchUnits({ perPage: 200 });
  }, [units.length, fetchUnits]);

  return { units, isLoading };
}
