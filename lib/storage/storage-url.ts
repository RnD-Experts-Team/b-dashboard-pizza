/**
 * The Storage page's place in the URL (docs/MAINTENANCE-UI.md rule 9):
 * `?tab=stock|movements|counts|locations` plus each tab's filters, so a shared
 * link opens the exact view and Back restores it.
 *
 *   stock      q (search), loc (location id)
 *   movements  type, part, loc, from, to (YYYY-MM-DD), page
 *   counts     loc, status
 *   locations  location (the one whose spots are open)
 */

import type { StockMovementFilters, StockMovementType } from "@/types/storage.types";
import type { StockCountStatus } from "@/types/maintenance-system";
import { VOCABULARY } from "@/lib/maintenance/vocabulary";

export const STORAGE_TABS = ["stock", "movements", "counts", "locations"] as const;
export type StorageTab = (typeof STORAGE_TABS)[number];

export function parseStorageTab(raw: string | null | undefined): StorageTab {
  return (STORAGE_TABS as readonly string[]).includes(raw ?? "") ? (raw as StorageTab) : "stock";
}

/** A positive whole number from the URL, or undefined. */
export function idParam(raw: string | null | undefined): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * A `YYYY-MM-DD` date, or undefined.
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&testString=2026-10-30%0A2026-1-3
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dateParam(raw: string | null | undefined): string | undefined {
  return raw && ISO_DATE.test(raw) ? raw : undefined;
}

/* ── Movements ───────────────────────────────────────────────────────────── */

export interface MovementUrlFilters {
  type?: StockMovementType;
  partId?: number;
  locationId?: number;
  from?: string;
  to?: string;
  page?: number;
}

const MOVEMENT_TYPE_VALUES = new Set(Object.keys(VOCABULARY.movementType));

export function readMovementFilters(params: URLSearchParams): MovementUrlFilters {
  const type = params.get("type");
  return {
    type: type && MOVEMENT_TYPE_VALUES.has(type) ? (type as StockMovementType) : undefined,
    partId: idParam(params.get("part")),
    locationId: idParam(params.get("loc")),
    from: dateParam(params.get("from")),
    to: dateParam(params.get("to")),
    page: idParam(params.get("page")),
  };
}

/** Movements per page in the ledger. */
export const MOVEMENTS_PER_PAGE = 25;

export function toMovementApiFilters(f: MovementUrlFilters): StockMovementFilters {
  return {
    types: f.type ? [f.type] : undefined,
    part_ids: f.partId ? [f.partId] : undefined,
    storage_location_ids: f.locationId ? [f.locationId] : undefined,
    moved_from: f.from,
    moved_to: f.to,
    sort: "moved_at",
    dir: "desc",
    page: f.page,
    per_page: MOVEMENTS_PER_PAGE,
  };
}

export function hasMovementFilters(f: MovementUrlFilters): boolean {
  return Boolean(f.type || f.partId || f.locationId || f.from || f.to);
}

/* ── Counts ──────────────────────────────────────────────────────────────── */

export function countStatusParam(raw: string | null | undefined): StockCountStatus | undefined {
  return raw === "draft" || raw === "applied" ? raw : undefined;
}

/* ── Writing ─────────────────────────────────────────────────────────────── */

export type ParamPatch = Record<string, string | number | null | undefined>;

/** The query string after applying `patch` (null/undefined/"" removes a key). */
export function patchParams(current: URLSearchParams, patch: ParamPatch): string {
  const next = new URLSearchParams(current.toString());
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  });
  const s = next.toString();
  return s ? `?${s}` : "";
}

/** Keys that belong to one tab, dropped when switching to another. */
export const TAB_PARAM_KEYS: Record<StorageTab, readonly string[]> = {
  stock: ["q", "loc"],
  movements: ["type", "part", "loc", "from", "to", "page"],
  counts: ["loc", "status"],
  locations: ["location"],
};
