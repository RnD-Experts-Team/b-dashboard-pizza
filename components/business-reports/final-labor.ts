"use client";

import { useMemo } from "react";
import { useSection } from "./report-context";

/**
 * FINAL labor % — the only labor figure Business Reports shows (no estimate):
 * total payroll ÷ royalty obligation × 100, added up over store-weeks, never
 * an average of weekly percentages. Payroll per store-week comes from Hiring's
 * payroll weeks model (its own small request); royalty obligation per
 * store-week from the sales section. A store-week without payroll (or without
 * royalty) is left out.
 */
export interface FinalLabor {
  /** Every loaded store-week together; null with none. */
  overall: number | null;
  /** week_start → all stores that week. */
  byWeek: Map<string, number>;
  /** store → all its weeks. */
  byStore: Map<string, number>;
  /** store → week_start → that store-week. */
  byStoreWeek: Map<string, Map<string, number>>;
  /** Over any weeks (and stores) — for buckets like a period or a quarter. */
  over: (weeks: Iterable<string>, stores?: Iterable<string>) => number | null;
}

interface StoreWeek {
  store: string;
  week: string;
  payroll: number;
  royalty: number;
}

const PERCENT = 100;

function ratio(rows: StoreWeek[]): number | null {
  const royalty = rows.reduce((sum, r) => sum + r.royalty, 0);
  return royalty > 0 ? (rows.reduce((sum, r) => sum + r.payroll, 0) / royalty) * PERCENT : null;
}

function groupBy(rows: StoreWeek[], key: (r: StoreWeek) => string): Map<string, StoreWeek[]> {
  return rows.reduce((groups, r) => groups.set(key(r), [...(groups.get(key(r)) ?? []), r]), new Map<string, StoreWeek[]>());
}

function ratioBy(rows: StoreWeek[], key: (r: StoreWeek) => string): Map<string, number> {
  const groups = groupBy(rows, key);
  return new Map(
    [...groups].flatMap(([k, group]) => {
      const value = ratio(group);
      return value === null ? [] : [[k, value] as const];
    }),
  );
}

/** null until both the payroll weeks and the sales section have loaded. */
export function useFinalLabor(): FinalLabor | null {
  const { data: payroll } = useSection("payrollWeeks");
  const { data: sales } = useSection("sales");
  return useMemo(() => {
    if (!payroll || !sales) return null;
    const rows: StoreWeek[] = Object.entries(payroll.by_store ?? {}).flatMap(([store, weeks]) =>
      Object.entries(weeks).flatMap(([week, amount]) => {
        const royalty = sales.by_store_week?.[store]?.[week]?.sales ?? 0;
        return royalty > 0 ? [{ store, week, payroll: amount, royalty }] : [];
      }),
    );
    const byStoreWeek = new Map(
      [...groupBy(rows, (r) => r.store)].map(([store, group]) => [store, ratioBy(group, (r) => r.week)] as const),
    );
    const over = (weeks: Iterable<string>, stores?: Iterable<string>) => {
      const weekSet = new Set(weeks);
      const storeSet = stores ? new Set(stores) : null;
      return ratio(rows.filter((r) => weekSet.has(r.week) && (storeSet === null || storeSet.has(r.store))));
    };
    return {
      overall: ratio(rows),
      byWeek: ratioBy(rows, (r) => r.week),
      byStore: ratioBy(rows, (r) => r.store),
      byStoreWeek,
      over,
    };
  }, [payroll, sales]);
}

/** The final labor to show; null (shown "—") when there is none — never an estimate. */
export function laborValue(final: number | null | undefined): { value: number | null; isFinal: boolean } {
  return final === null || final === undefined ? { value: null, isFinal: false } : { value: final, isFinal: true };
}
