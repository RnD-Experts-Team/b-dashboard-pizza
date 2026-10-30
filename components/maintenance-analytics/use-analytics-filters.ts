"use client";

import { useMemo } from "react";
import { presetDays, type RangePreset } from "@/lib/maintenance-tickets/local-range";
import { useQueryParams } from "@/components/maintenance-technicians/use-query-params";
import { useStoreNumberOptions } from "@/components/maintenance-technicians/use-store-options";

export type AnalyticsTab = "overview" | "finances" | "coverage";
export const ANALYTICS_TABS: readonly AnalyticsTab[] = ["overview", "finances", "coverage"];

/** The range a fresh page opens on. */
export const DEFAULT_PRESET: RangePreset = "thisMonth";

/**
 * A calendar day "2026-10-05": four digits, dash, two, dash, two. "2026-10-05" matches; "2026-1-5", "10/05/2026" do not.
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&flags=gm&testString=2026-10-05%0A2026-1-5%0A10%2F05%2F2026
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const STORE_SEPARATOR = ",";

/**
 * The analytics page's shared filters, all in the URL (rule 9):
 *   ?tab=finances&from=2026-10-01&to=2026-10-31&stores=03795-00001,03795-00002&category=3
 * No `stores` = every store. Each tab reads what it needs:
 *   overview  — the days (as the viewer's local midnights) and the stores (the API requires a list)
 *   finances  — the days as dates, stores (none = all), category
 *   coverage  — stores, category (not dates: coverage is as of now)
 */
export function useAnalyticsFilters() {
  const { get, set } = useQueryParams();
  const storeOptions = useStoreNumberOptions();
  const fallback = useMemo(() => presetDays(DEFAULT_PRESET), []);

  const rawTab = get("tab");
  const tab: AnalyticsTab = ANALYTICS_TABS.includes(rawTab as AnalyticsTab) ? (rawTab as AnalyticsTab) : "overview";

  const from = ISO_DAY.test(get("from")) ? get("from") : fallback.startDate;
  const rawTo = ISO_DAY.test(get("to")) ? get("to") : fallback.endDate;
  const to = rawTo < from ? from : rawTo;

  const storesParam = get("stores");
  const stores = useMemo(() => (storesParam ? storesParam.split(STORE_SEPARATOR).filter(Boolean) : []), [storesParam]);
  const categoryId = Number(get("category")) || null;

  return {
    tab,
    from,
    to,
    /** Store numbers; empty = all stores. */
    stores,
    categoryId,
    storeOptions,
    setTab: (next: AnalyticsTab) => set({ tab: next === "overview" ? null : next }, { push: true }),
    setRange: (start: string, end: string) => set({ from: start, to: end }),
    setStores: (next: string[] | "all") => set({ stores: next === "all" ? null : next.join(STORE_SEPARATOR) }),
    setCategory: (id: number | null) => set({ category: id ? String(id) : null }),
    get,
    set,
  };
}

export type AnalyticsFilters = ReturnType<typeof useAnalyticsFilters>;
