"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useWorkbooksStore } from "@/lib/store/workbooks.store";
import type { ColumnTypeOption, VisibilityOption } from "@/types/workbooks.types";

/**
 * The tag list and column-type list from GET /workbook-options — fetched once
 * per session and shared by every picker. Labels always come from here; the
 * UI never hard-codes the tag strings or their wording.
 */
export function useWorkbookOptions() {
  const options = useWorkbooksStore((s) => s.options);
  const error = useWorkbooksStore((s) => s.optionsError);
  const loadOptions = useWorkbooksStore((s) => s.loadOptions);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const reload = useCallback(() => loadOptions(true), [loadOptions]);

  const visibilityByValue = useMemo(() => {
    const map = new Map<string, VisibilityOption>();
    options?.visibilities.forEach((v) => map.set(v.value, v));
    return map;
  }, [options]);

  const columnTypeByValue = useMemo(() => {
    const map = new Map<string, ColumnTypeOption>();
    options?.columnTypes.forEach((c) => map.set(c.value, c));
    return map;
  }, [options]);

  return {
    options,
    visibilities: options?.visibilities ?? [],
    columnTypes: options?.columnTypes ?? [],
    visibilityByValue,
    columnTypeByValue,
    loading: !options && !error,
    error,
    reload,
  };
}
