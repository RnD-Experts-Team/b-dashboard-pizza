"use client";

import { useMemo, useState, useCallback } from "react";

export type SortDir = "asc" | "desc";

/** Extracts the comparable value for a row. Return null for "no data". */
export type SortAccessor<T> = (row: T) => string | number | null | undefined;

export interface UseTableSortResult<T, K extends string> {
  sorted: T[];
  sortKey: K;
  sortDir: SortDir;
  /** Clicking the active column flips direction; a new column starts fresh. */
  toggleSort: (key: K) => void;
}

/**
 * Minimal sorting for the two Labor Dashboard tables.
 *
 * Nulls always sort last regardless of direction — on this page a null means
 * "no data recorded", so it should never win a "highest value" sort or crowd
 * the top of an ascending one.
 */
export function useTableSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, SortAccessor<T>>,
  initialKey: K,
  initialDir: SortDir = "desc",
): UseTableSortResult<T, K> {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const toggleSort = useCallback(
    (key: K) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    const accessor = accessors[sortKey];
    if (!accessor) return rows;

    const dir = sortDir === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);

      const aMissing = av === null || av === undefined || av === "";
      const bMissing = bv === null || bv === undefined || bv === "";
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1; // nulls last, both directions
      if (bMissing) return -1;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * dir;
    });
    // `accessors` is rebuilt each render by callers; keying on sortKey/sortDir
    // and the row identity is what actually matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
