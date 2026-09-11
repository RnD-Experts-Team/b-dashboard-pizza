"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStorageStore } from "@/lib/store/storage.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { storageService } from "@/lib/api/services/storage.service";
import type { CatalogPart } from "@/types/maintenance-tickets.types";
import type { StockBalance, StorageLocation } from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main hook for the Storage & Stock page                                   */
/*                                                                            */
/*  Owns the three list resources plus the reference data every tab needs     */
/*  (parts, locations) for filters and the movement composer.                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Balances loaded purely to count negatives for the KPI strip. */
const NEGATIVE_SCAN_PER_PAGE = 200;

export function useStorage() {
  const {
    movements,
    movementsLoading,
    movementsRefreshing,
    movementsError,
    movementFilters,
    balances,
    balancesLoading,
    balancesRefreshing,
    balancesError,
    balanceFilters,
    locations,
    locationsLoading,
    locationsRefreshing,
    locationsError,
    locationFilters,
    fetchMovements,
    fetchBalances,
    fetchLocations,
    clearErrors,
    reset,
  } = useStorageStore();

  /* ── Reference data ───────────────────────────────────────────────────── */

  const [parts, setParts] = useState<CatalogPart[]>([]);
  const [allLocations, setAllLocations] = useState<StorageLocation[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);

  const loadReference = useCallback(() => {
    const ctrl = new AbortController();
    setReferenceLoading(true);
    Promise.all([
      maintenanceTicketsService
        .getCatalogParts(ctrl.signal)
        .then((rows) => rows.filter((p) => !p.deletedAt))
        .catch(() => [] as CatalogPart[]),
      // `trashed: "with"` so a movement that references a RETIRED location can
      // still resolve its name. Composer destinations filter to live ones.
      storageService
        .getStorageLocations({ trashed: "with", per_page: 200 }, ctrl.signal)
        .then((res) => res.data)
        .catch(() => [] as StorageLocation[]),
    ])
      .then(([p, l]) => {
        if (ctrl.signal.aborted) return;
        setParts(p);
        setAllLocations(l);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setReferenceLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => loadReference(), [loadReference]);

  /** Only live locations may receive new stock. */
  const liveLocations = useMemo(
    () => allLocations.filter((l) => !l.deletedAt),
    [allLocations]
  );

  /* ── Negative-balance scan, for the KPI strip ─────────────────────────── */

  const [negativeScan, setNegativeScan] = useState<{
    rows: StockBalance[];
    scanned: number;
    total: number;
  } | null>(null);

  const loadNegativeScan = useCallback(() => {
    const ctrl = new AbortController();
    storageService
      // Deliberately WITHOUT non_zero: that flag hides pairs that netted to
      // ZERO, and conflating it with "negative" can hide the very rows this
      // scan exists to count.
      .getStockBalances({ per_page: NEGATIVE_SCAN_PER_PAGE }, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setNegativeScan({
          rows: res.data.filter((b) => b.onHand < 0),
          scanned: res.data.length,
          total: res.meta.total,
        });
      })
      .catch((err) => {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => loadNegativeScan(), [loadNegativeScan]);

  /* ── Initial loads ────────────────────────────────────────────────────── */

  useEffect(() => {
    void fetchBalances();
    void fetchMovements();
    void fetchLocations();
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchAll = useCallback(() => {
    void fetchBalances(balanceFilters, balanceFilters.page ?? 1);
    void fetchMovements(movementFilters, movementFilters.page ?? 1);
    void fetchLocations(locationFilters, locationFilters.page ?? 1);
    loadNegativeScan();
    loadReference();
  }, [
    fetchBalances,
    fetchMovements,
    fetchLocations,
    balanceFilters,
    movementFilters,
    locationFilters,
    loadNegativeScan,
    loadReference,
  ]);

  /** Called after any write: movements and balances always move together. */
  const refetchAfterWrite = useCallback(() => {
    void fetchMovements(movementFilters, movementFilters.page ?? 1);
    void fetchBalances(balanceFilters, balanceFilters.page ?? 1);
    loadNegativeScan();
  }, [fetchMovements, fetchBalances, movementFilters, balanceFilters, loadNegativeScan]);

  const isRefreshing = movementsRefreshing || balancesRefreshing || locationsRefreshing;

  return {
    // Movements
    movements,
    movementsLoading,
    movementsError,
    movementFilters,
    fetchMovements,

    // Balances
    balances,
    balancesLoading,
    balancesError,
    balanceFilters,
    fetchBalances,

    // Locations
    locations,
    locationsLoading,
    locationsError,
    locationFilters,
    fetchLocations,

    // Reference data
    parts,
    allLocations,
    liveLocations,
    referenceLoading,
    reloadReference: loadReference,

    // KPI
    negativeScan,

    // Shared
    isRefreshing,
    refetchAll,
    refetchAfterWrite,
    clearErrors,
  };
}
