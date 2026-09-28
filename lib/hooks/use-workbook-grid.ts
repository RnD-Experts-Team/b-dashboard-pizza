"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useWorkbookGridStore } from "@/lib/store/workbook-grid.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { sortColumns } from "@/lib/workbooks/cells";
import { activeFilterCount, isManualOrder } from "@/lib/workbooks/grid-url";
import type { RowsQuery } from "@/types/workbooks.types";

/**
 * One workbook's grid. The page owns the query (it lives in the URL); this
 * hook fetches whenever the workbook id or the query changes.
 */
export function useWorkbookGrid(workbookId: number, query: RowsQuery) {
  const { selectedStore } = useSelectedStoreStore();
  const storeCode = selectedStore?.storeId ?? null;

  const state = useWorkbookGridStore();
  const { open, fetchRows, fetchWorkbook, reset } = state;

  // Serialised so a new-but-equal object from the URL doesn't refetch.
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!Number.isFinite(workbookId)) return;
    void open(workbookId, JSON.parse(queryKey) as RowsQuery);
  }, [workbookId, queryKey, open]);

  useEffect(() => () => reset(), [reset]);

  const columns = useMemo(() => sortColumns(state.workbook?.columns ?? []), [state.workbook?.columns]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchWorkbook(), fetchRows()]);
  }, [fetchWorkbook, fetchRows]);

  return {
    ...state,
    columns,
    storeCode,
    filterCount: activeFilterCount(query),
    manualOrder: isManualOrder(query),
    refetch,
  };
}
