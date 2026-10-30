"use client";

/**
 * Stock counts: the list (Storage → Stock counts) and the count sheet
 * (`/dashboard/storage/counts/[id]`).
 *
 * The sheet keeps what was typed per part (`edits`) on top of the saved
 * lines, recomputes the sticky bar on every keystroke (lib/storage/stock-count),
 * and saves only the lines that changed. Apply writes ONE stock_count
 * movement; confirm first with `corrections`.
 */

import { useCallback, useMemo, useState } from "react";
import { storageService } from "@/lib/api/services/storage.service";
import { keyOf, useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import {
  changedCountLines,
  correctionsOf,
  countLineView,
  countTotals,
  type CountEdits,
} from "@/lib/storage/stock-count";
import type { StockCountFilters } from "@/types/maintenance-v2";

export function useStockCounts(filters: StockCountFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("stock-counts", filters) : null, (signal) =>
    storageService.listStockCounts(filters, signal),
  );
  return { ...res, counts: res.data ?? [] };
}

export function useStockCount(id: number | null) {
  const res = useMaintenanceResource(id ? `stock-count:${id}` : null, (signal) => storageService.getStockCount(id as number, signal));
  const [edits, setEdits] = useState<CountEdits>({});

  const lines = useMemo(() => res.data?.lines ?? [], [res.data]);
  const views = useMemo(() => lines.map((line) => countLineView(line, edits)), [lines, edits]);
  const totals = useMemo(() => countTotals(views), [views]);
  const corrections = useMemo(() => correctionsOf(views), [views]);
  const changed = useMemo(() => changedCountLines(lines, edits), [lines, edits]);

  const setCounted = useCallback((partId: number, value: string) => setEdits((prev) => ({ ...prev, [partId]: value })), []);

  const save = useMaintenanceMutation(async (notes?: string | null) => {
    if (!id) throw new Error("No count.");
    const next = await storageService.saveStockCount(id, { lines: changed, notes });
    res.setData(next);
    setEdits({});
    return next;
  });

  const apply = useMaintenanceMutation(async () => {
    if (!id) throw new Error("No count.");
    // Unsaved typing goes in first, so what is applied is what is on screen.
    if (changed.length) await storageService.saveStockCount(id, { lines: changed });
    const next = await storageService.applyStockCount(id);
    res.setData(next);
    setEdits({});
    return next;
  });

  /**
   * Puts a part that is not on the sheet onto it (expected = its balance there
   * now, counted = what was typed, or null). Unsaved typing goes in with it,
   * so nothing on screen is lost when the sheet comes back.
   */
  const addPart = useMaintenanceMutation(async (partId: number, counted: number | null = null) => {
    if (!id) throw new Error("No count.");
    const next = await storageService.saveStockCount(id, { lines: [...changed, { partId, counted }] });
    res.setData(next);
    setEdits({});
    return next;
  });

  const remove = useMaintenanceMutation(async () => {
    if (!id) throw new Error("No count.");
    return storageService.deleteStockCount(id);
  });

  return {
    ...res,
    count: res.data,
    edits,
    setCounted,
    views,
    totals,
    corrections,
    hasUnsavedChanges: changed.length > 0,
    save,
    apply,
    addPart,
    remove,
  };
}
