"use client";

import { useMemo } from "react";
import { useSection } from "./report-context";

/**
 * FINAL labor % (Hiring's weekly labor, what V1's "Final" view shows) — the
 * labor figure every Business Reports card uses wherever it exists. The
 * derived one (labor cost ÷ sales from the Data service) is only a fallback
 * for a week/store Hiring has no final value for, or while it is loading.
 */
export interface FinalLabor {
  /** Mean of the range's weeks (combined across stores); null with none. */
  overall: number | null;
  /** week_start → combined final labor %. */
  byWeek: Map<string, number>;
  /** store → mean of its weeks. */
  byStore: Map<string, number>;
  /** store → week_start → final labor %. */
  byStoreWeek: Map<string, Map<string, number>>;
}

type Entry = { week_start: string; labor: number | null };

function weekMap(entries: Entry[] | undefined): Map<string, number> {
  return new Map(
    (entries ?? []).flatMap((e) => (e.labor === null || e.labor === undefined ? [] : [[e.week_start, e.labor] as const])),
  );
}

function mean(values: Iterable<number>): number | null {
  const list = [...values];
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

/** null until the Hiring labor report has loaded (callers fall back to derived labor). */
export function useFinalLabor(): FinalLabor | null {
  const { data } = useSection("labor");
  return useMemo(() => {
    if (!data) return null;
    const byStoreWeek = new Map(
      Object.entries(data.by_store ?? {}).map(([store, block]) => [store, weekMap(block.final_labor)]),
    );
    const byStore = new Map(
      [...byStoreWeek].flatMap(([store, weeks]) => {
        const m = mean(weeks.values());
        return m === null ? [] : [[store, m] as const];
      }),
    );
    const byWeek = weekMap(data.combined?.final_labor);
    return { overall: mean(byWeek.values()), byWeek, byStore, byStoreWeek };
  }, [data]);
}

/** Final labor when there is one, else the derived figure. */
export function preferFinal(final: number | null | undefined, derived: number): { value: number; isFinal: boolean } {
  return final === null || final === undefined ? { value: derived, isFinal: false } : { value: final, isFinal: true };
}
