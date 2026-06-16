"use client";

import { useEffect, useCallback } from "react";
import { useMaintenanceTicketsStore } from "@/lib/store/maintenance-tickets.store";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { TicketsFilters } from "@/types/maintenance-tickets.types";

interface UseMaintenanceTicketsOptions {
  /**
   * Override the store ID used for fetching tickets (e.g. from a page-level
   * store selector). When provided it takes precedence over the sidebar's
   * `selectedStore`. Pass `undefined` to fall back to sidebar selection.
   */
  storeId?: string;
}

/**
 * Main hook for the Maintenance Tickets page.
 * - Fetches tickets when the selected store changes (no auto-refresh).
 * - Loads catalog data (issues + technicians) on mount for dropdowns.
 * - Reloads catalog after any successful mutation via `reloadCatalog`.
 */
export function useMaintenanceTickets(options?: UseMaintenanceTicketsOptions) {
  const { selectedStore } = useSelectedStoreStore();

  // Page-level override takes precedence; falls back to sidebar selection.
  const effectiveStoreId =
    options?.storeId !== undefined ? options.storeId : selectedStore?.storeId;

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    mode,
    filters,
    fetchTickets,
    setMode,
    goToPage,
    setFilters,
    clearError,
    reset,
  } = useMaintenanceTicketsStore();

  const {
    issues: catalogIssues,
    technicians: catalogTechnicians,
    isLoading: isCatalogLoading,
    error: catalogError,
    loadCatalog,
    clearError: clearCatalogError,
  } = useMaintenanceTicketsCatalogStore();

  // Fetch tickets when the effective store or mode changes
  useEffect(() => {
    if (mode === "global") {
      fetchTickets(undefined, {}, 1);
    } else if (effectiveStoreId) {
      fetchTickets(effectiveStoreId, {}, 1);
    } else {
      reset();
    }
  }, [mode, effectiveStoreId, fetchTickets, reset]);

  // Load catalog on mount (and whenever the effective store changes)
  useEffect(() => {
    loadCatalog(effectiveStoreId ?? undefined);
  }, [loadCatalog, effectiveStoreId]);

  const refetch = useCallback(() => {
    if (mode === "global") {
      fetchTickets(undefined, filters, currentPage);
    } else if (effectiveStoreId) {
      fetchTickets(effectiveStoreId, filters, currentPage);
    }
  }, [mode, effectiveStoreId, fetchTickets, filters, currentPage]);

  const reloadCatalog = useCallback(() => {
    loadCatalog(effectiveStoreId ?? undefined);
  }, [loadCatalog, effectiveStoreId]);

  const applyFilters = useCallback(
    (newFilters: TicketsFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  return {
    // Ticket list
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    mode,
    filters,
    refetch,
    setMode,
    goToPage,
    applyFilters,
    clearError,

    // Catalog
    catalogIssues,
    catalogTechnicians,
    isCatalogLoading,
    catalogError,
    reloadCatalog,
    clearCatalogError,

    // Store
    selectedStore,
  };
}
