"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useReport } from "@/components/business-reports/report-context";
import { fmtDay, weekLabel } from "@/components/business-reports/report-format";
import type { ReportWeek } from "@/types/business-reports.types";

/**
 * Small pieces shared by the Business Reports Operations, Finance and Quality
 * cards: per-store rows, "click a row to focus the store", week labels, the
 * pp-delta chip and the score colour bands V1 uses.
 */

export const PERCENT = 100;
export const NO_VALUE = "—";

/** Rows a card body lists before pointing at its dialog for the rest. */
export const CARD_LIST_LIMIT = 12;

const SCORE_GOOD = 80;
const SCORE_FAIR = 50;
const PP_EPSILON = 0.05;

/** V1's three-band score colour (HNR+, Cleaning Review). */
export function scoreColor(score: number): string {
  if (score >= SCORE_GOOD) return "text-emerald-600 dark:text-emerald-400";
  if (score >= SCORE_FAIR) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** "3 records" / "1 record". */
export function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

/** Mean of the values that are present, or null when none are. */
export function meanOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

/** Point change (curr − prev) as "+1.5pp", sign-coloured; "—" without a previous week. */
export function PpDelta({ curr, prev }: { curr: number; prev?: number | null }) {
  if (prev === undefined || prev === null) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  const d = curr - prev;
  if (Math.abs(d) < PP_EPSILON) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      )}
    >
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}pp
    </span>
  );
}

export interface StoreRow<T> {
  store: string;
  name: string;
  data: T;
}

/** A `by_store` block as table rows with display names. */
export function useStoreRows<T>(byStore: Record<string, T> | undefined | null): StoreRow<T>[] {
  const { storeName } = useReport();
  return useMemo(
    () => Object.entries(byStore ?? {}).map(([store, data]) => ({ store, name: storeName(store), data })),
    [byStore, storeName],
  );
}

/** With several stores loaded, a per-store row click reloads the page for that store. */
export function useStoreFocus<T extends { store: string }>(): {
  onRowClick?: (row: T) => void;
  footerNote?: string;
} {
  const { params, focusStore } = useReport();
  const many = params.stores.length > 1;
  return useMemo(
    () =>
      many
        ? { onRowClick: (row: T) => focusStore(row.store), footerNote: "click a row to focus the store" }
        : {},
    [many, focusStore],
  );
}

/** week_start → "Wk 43 · Oct 21", from the section's `meta.weeks`. */
export function useWeekLabels(weeks: ReportWeek[] | undefined): (weekStart: string) => string {
  return useMemo(() => {
    const labels = new Map((weeks ?? []).map((w) => [w.week_start, weekLabel(w)]));
    return (weekStart: string) => labels.get(weekStart) ?? fmtDay(weekStart);
  }, [weeks]);
}
