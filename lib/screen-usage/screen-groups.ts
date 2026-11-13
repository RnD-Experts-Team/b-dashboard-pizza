/**
 * Screen Project monitoring: one screen over every store. The report has a row per
 * station, and a station belongs to one store; stations with the same name in
 * different stores ("Oven", "Make line") are the same screen, so they are added up here.
 */
import { share } from "./format";
import type { UsageScreenRow } from "./types";

/** A store's figure for one screen: present while the screen was in the main tile, as a share of the store's open hours. */
export interface ScreenStoreShare {
  store: string;
  share: number;
}

/** One screen added up over the stores that have it. Every duration in SECONDS. */
export interface ScreenGroup {
  /** The grouping key: the name without case or extra spaces. */
  key: string;
  /** The spelling most stores use. */
  name: string;
  /** Stores that have this screen, and how many of them had it in a main tile at least once. */
  stores: number;
  watched_stores: number;
  main: number;
  mic: number;
  camera: number;
  connected: number;
  present: number;
  talking: number;
  /** Open hours of the stores that have this screen and have open hours set (null: none of them has). */
  open_hours: number | null;
  /** Present and talking as a share (0 to 100) of those open hours, counting only those stores; null without open hours. */
  present_open_share: number | null;
  talking_open_share: number | null;
  present_connected_share: number;
  talking_connected_share: number;
  /** The stores with the lowest and highest present share of open hours (null: fewer than two stores with open hours). */
  low: ScreenStoreShare | null;
  high: ScreenStoreShare | null;
}

/** "  Make   Line " and "make line" are one screen. */
export function screenKey(name: string): string {
  // Collapses runs of spaces, e.g. "Make   Line" -> "make line".
  return name.split(" ").filter(Boolean).join(" ").toLowerCase();
}

const SUMMED = ["main", "mic", "camera", "connected", "present", "talking"] as const;

/**
 * Adds the stations up by screen name. Open hours count once per store, even if a
 * store has two stations with the same name.
 *
 * @param openByStore  store number -> open seconds in the range (stores without open hours are absent)
 */
export function groupScreens(rows: UsageScreenRow[], openByStore: Record<string, number>): ScreenGroup[] {
  const byKey = new Map<string, UsageScreenRow[]>();
  rows.forEach((row) => {
    const key = screenKey(row.name);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  });

  return [...byKey.entries()].map(([key, members]) => {
    const sum = (pick: (r: UsageScreenRow) => number, of = members) => of.reduce((total, r) => total + pick(r), 0);
    const totals = Object.fromEntries(SUMMED.map((field) => [field, sum((r) => r[field])])) as Record<(typeof SUMMED)[number], number>;

    const stores = new Set(members.map((r) => r.store ?? ""));
    const watched = new Set(members.filter((r) => r.main > 0).map((r) => r.store ?? ""));
    const withHours = members.filter((r) => r.store !== null && r.store in openByStore);
    const hoursStores = [...new Set(withHours.map((r) => r.store as string))];
    const openHours = hoursStores.reduce((total, store) => total + openByStore[store], 0);
    const hasHours = hoursStores.length > 0;

    // Per store, so a store with two same-named stations is still one store.
    const storeShares = hoursStores
      .map((store) => ({ store, share: share(sum((r) => r.present, withHours.filter((r) => r.store === store)), openByStore[store]) }))
      .sort((a, b) => a.share - b.share);

    return {
      key,
      name: mostCommonSpelling(members.map((r) => r.name.trim())),
      stores: stores.size,
      watched_stores: watched.size,
      ...totals,
      open_hours: hasHours ? openHours : null,
      present_open_share: hasHours ? share(sum((r) => r.present, withHours), openHours) : null,
      talking_open_share: hasHours ? share(sum((r) => r.talking, withHours), openHours) : null,
      present_connected_share: share(totals.present, totals.connected),
      talking_connected_share: share(totals.talking, totals.connected),
      low: storeShares.length > 1 ? storeShares[0] : null,
      high: storeShares.length > 1 ? storeShares[storeShares.length - 1] : null,
    };
  });
}

function mostCommonSpelling(names: string[]): string {
  const counts = new Map<string, number>();
  names.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}
