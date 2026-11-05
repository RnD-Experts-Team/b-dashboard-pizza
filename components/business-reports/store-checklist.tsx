"use client";

import { useMemo } from "react";
import { StoreMultiSelect, type StoreOption } from "./store-multi-select";
import { useReport } from "./report-context";

/**
 * The per-store filter every card and dialog uses: a checklist of the loaded
 * stores, labelled by store number first ("03795-00043 · Name").
 * `value` [] means every store (nothing narrowed).
 */
export function StoreChecklist({
  value,
  onChange,
  stores,
  className,
}: {
  value: string[];
  onChange: (stores: string[]) => void;
  /** The stores to offer; defaults to every loaded store. */
  stores?: string[];
  className?: string;
}) {
  const { params, storeName } = useReport();
  const offered = stores ?? params.stores;
  const options: StoreOption[] = useMemo(
    () => offered.map((code) => ({ id: code, name: storeName(code) })),
    [offered, storeName],
  );

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <StoreMultiSelect
        options={options}
        value={value.length === 0 ? "all" : value}
        onChange={(next) => onChange(next === "all" || next.length === offered.length ? [] : next)}
        className={className ?? "h-8 w-52 text-xs"}
      />
    </div>
  );
}

/** Rows kept by a StoreChecklist value ([] = all). */
export function inStores<T>(rows: T[], selected: string[], storeOf: (row: T) => string): T[] {
  if (selected.length === 0) return rows;
  const set = new Set(selected);
  return rows.filter((r) => set.has(storeOf(r)));
}
