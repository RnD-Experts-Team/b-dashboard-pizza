"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStorageStore } from "@/lib/store/storage.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { storageService } from "@/lib/api/services/storage.service";
import type { CatalogPart } from "@/types/maintenance-tickets.types";
import type { StorageLocation } from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main hook for the Storage & Stock page                                   */
/*                                                                            */
/*  Owns the three list resources plus the reference data every tab needs     */
/*  (parts, locations) for filters and the movement composer.                */
/* ────────────────────────────────────────────────────────────────────────── */

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
    partTotals,
    partTotalsLoading,
    partTotalsRefreshing,
    partTotalsError,
    partTotalFilters,
    fetchPartTotals,
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

  /* ── Negative-balance count, for the KPI strip ────────────────────────── */

  const [negativeCount, setNegativeCount] = useState<number | null>(null);

  /*
   * The EXACT number of pairs below zero, not a sample of one.
   *
   * This used to load the first 200 balances and count the negatives in them,
   * which meant the KPI and the list it opens could disagree: "3 negative", and
   * then nothing on screen, because the shortages were on page four. `per_page:
   * 1` because nothing here needs the rows -- `meta.total` is the answer, and
   * the server does the filtering.
   *
   * Deliberately WITHOUT non_zero: that flag hides pairs that netted to ZERO,
   * and conflating it with "negative" can hide the very rows being counted.
   */
  const loadNegativeCount = useCallback(() => {
    const ctrl = new AbortController();
    storageService
      .getStockBalances({ negative_only: true, per_page: 1 }, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setNegativeCount(res.meta.total);
      })
      .catch((err) => {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => loadNegativeCount(), [loadNegativeCount]);

  /* ── Initial loads ────────────────────────────────────────────────────── */

  useEffect(() => {
    void fetchPartTotals();
    void fetchBalances();
    void fetchMovements();
    void fetchLocations();
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchAll = useCallback(() => {
    void fetchPartTotals(partTotalFilters, partTotalFilters.page ?? 1);
    void fetchBalances(balanceFilters, balanceFilters.page ?? 1);
    void fetchMovements(movementFilters, movementFilters.page ?? 1);
    void fetchLocations(locationFilters, locationFilters.page ?? 1);
    loadNegativeCount();
    loadReference();
  }, [
    fetchBalances,
    fetchPartTotals,
    fetchMovements,
    fetchLocations,
    balanceFilters,
    partTotalFilters,
    movementFilters,
    locationFilters,
    loadNegativeCount,
    loadReference,
  ]);

  /**
   * Called after any write: movements and stock always move together.
   *
   * Both shapes of the balance are refreshed, because both are on screen at
   * once now -- the per-part totals at the top and the ledger below. Locations
   * are deliberately left alone; they do not change when stock does.
   */
  const refetchAfterWrite = useCallback(() => {
    void fetchMovements(movementFilters, movementFilters.page ?? 1);
    void fetchPartTotals(partTotalFilters, partTotalFilters.page ?? 1);
    void fetchBalances(balanceFilters, balanceFilters.page ?? 1);
    loadNegativeCount();
  }, [
    fetchMovements,
    fetchPartTotals,
    fetchBalances,
    movementFilters,
    partTotalFilters,
    balanceFilters,
    loadNegativeCount,
  ]);

  const isRefreshing =
    movementsRefreshing || balancesRefreshing || partTotalsRefreshing || locationsRefreshing;

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
    partTotals,
    partTotalsLoading,
    partTotalsRefreshing,
    partTotalsError,
    partTotalFilters,
    fetchPartTotals,
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
    negativeCount,

    // Shared
    isRefreshing,
    refetchAll,
    refetchAfterWrite,
    clearErrors,
  };
}
