"use client";

import { useEffect, useMemo, useState } from "react";
import { maintenanceCatalogService } from "@/lib/api/services/maintenance-catalog.service";
import { storageService } from "@/lib/api/services/storage.service";
import { keyOf, useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { PartInput, PartSerialStatus, StartStockCountPayload } from "@/types/maintenance-system";
import type {
  CreateStockMovementPayload,
  StockBalanceFilters,
  StockMovementFilters,
} from "@/types/storage.types";

/** Every location fits one read. */
const LOCATION_LIST_SIZE = 200;
/** Wait this long after the last keystroke before searching tickets. */
const SEARCH_DEBOUNCE_MS = 300;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance Storage page (docs/MAINTENANCE-UI.md §6)              */
/*                                                                            */
/*  One small hook per read, built on useMaintenanceResource: each tab loads  */
/*  only what it shows, and a fast filter change cancels the older request.  */
/* ────────────────────────────────────────────────────────────────────────── */

/** Parts on hand, one row per part with its locations and spots. */
export function useStockTotals(filters: StockBalanceFilters, enabled = true, revision = 0) {
  const res = useMaintenanceResource(enabled ? keyOf(`stock-totals@${revision}`, filters) : null, (signal) =>
    storageService.getPartStockTotals(filters, signal),
  );
  return { ...res, rows: res.data?.data ?? [], meta: res.data?.meta ?? null };
}

/** The ledger, newest first. */
export function useStockMovements(filters: StockMovementFilters, enabled = true, revision = 0) {
  const res = useMaintenanceResource(enabled ? keyOf(`stock-movements@${revision}`, filters) : null, (signal) =>
    storageService.getStockMovements(filters, signal),
  );
  return { ...res, rows: res.data?.data ?? [], meta: res.data?.meta ?? null };
}

/** Every storage location; retired ones too (history still names them). */
export function useStorageLocationList() {
  const res = useMaintenanceResource("storage-locations:all", (signal) =>
    storageService.getStorageLocations({ trashed: "with", per_page: LOCATION_LIST_SIZE }, signal),
  );
  const all = useMemo(() => res.data?.data ?? [], [res.data]);
  const live = useMemo(() => all.filter((l) => !l.deletedAt), [all]);
  return { ...res, all, live };
}

/** How one location addresses its spots (levels with their values). */
export function usePlaceLevels(locationId: number | null) {
  const res = useMaintenanceResource(locationId ? `place-levels:${locationId}` : null, (signal) =>
    storageService.getPlaceLevels(locationId as number, signal),
  );
  return { ...res, levels: res.data ?? [] };
}

/** The whole parts catalog, live parts only unless asked. */
export function usePartsCatalog(includeDeleted = false) {
  const res = useMaintenanceResource(`parts-catalog:${includeDeleted ? "all" : "live"}`, (signal) =>
    maintenanceCatalogService.listParts({ includeDeleted }, signal),
  );
  const parts = useMemo(() => (res.data ?? []).filter((p) => includeDeleted || !p.deletedAt), [res.data, includeDeleted]);
  return { ...res, parts };
}

/** What we paid for one part, newest first. */
export function usePartPriceHistory(partId: number | null, revision = 0) {
  const res = useMaintenanceResource(partId ? `part-prices:${partId}@${revision}` : null, (signal) =>
    storageService.getPartPriceHistory(partId as number, signal),
  );
  return { ...res, entries: res.data ?? [] };
}

/** The serial-numbered units of one part (optionally only one status). */
export function useStoragePartUnits(partId: number | null, status?: PartSerialStatus, enabled = true, revision = 0) {
  const res = useMaintenanceResource(enabled && partId ? keyOf(`part-units:${partId}@${revision}`, { status }) : null, (signal) =>
    storageService.listPartUnits(partId as number, status, signal),
  );
  return { ...res, units: res.data ?? [] };
}

/** Ticket issues for "Used on a ticket", searched as the person types. */
export function useTicketIssueSearch(query: string) {
  const [debounced, setDebounced] = useState(query.trim());
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);
  const res = useMaintenanceResource(debounced ? `issue-search:${debounced}` : null, (signal) =>
    storageService.searchTicketIssues(debounced, signal),
  );
  return { ...res, hits: res.data ?? [], isSearching: res.isLoading || debounced !== query.trim() };
}

/** One part's stock at each location (the record dialogs' "on hand here"). */
export function usePartStockAt(partId: number | null, revision = 0) {
  const res = useMaintenanceResource(partId ? `part-stock:${partId}@${revision}` : null, (signal) =>
    storageService.getPartStockTotals({ part_ids: [partId as number], per_page: 1 }, signal),
  );
  const total = res.data?.data[0] ?? null;
  return { ...res, total, locations: total?.locations ?? [] };
}

/** Writes the Storage page makes outside the record dialogs. */
export function useStorageWrites() {
  const markMistaken = useMaintenanceMutation((movementId: number) => storageService.markStockMovementMistaken(movementId));
  const createPart = useMaintenanceMutation((input: PartInput) => maintenanceCatalogService.createPart(input));
  const updatePart = useMaintenanceMutation((partId: number, input: Partial<PartInput>) =>
    maintenanceCatalogService.updatePart(partId, input),
  );
  const recordMovement = useMaintenanceMutation((payload: CreateStockMovementPayload) => storageService.createStockMovement(payload));
  const setPlace = useMaintenanceMutation((balanceId: number, valueIds: number[]) =>
    storageService.setStockBalancePlace(balanceId, valueIds),
  );
  const startCount = useMaintenanceMutation((payload: StartStockCountPayload) => storageService.startStockCount(payload));
  return { markMistaken, createPart, updatePart, recordMovement, setPlace, startCount };
}
