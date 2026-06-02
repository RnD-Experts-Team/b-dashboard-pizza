"use client";

import { useEffect, useCallback } from "react";
import { useMaintenanceTicketsStore } from "@/lib/store/maintenance-tickets.store";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { TicketsFilters } from "@/types/maintenance-tickets.types";

/**
 * Main hook for the Maintenance Tickets page.
 * - Fetches tickets when the selected store changes (no auto-refresh).
 * - Loads catalog data (issues + technicians) on mount for dropdowns.
 * - Reloads catalog after any successful mutation via `reloadCatalog`.
 */
export function useMaintenanceTickets() {
  const { selectedStore } = useSelectedStoreStore();

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    fetchTickets,
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

  // Fetch tickets when the selected store changes
  useEffect(() => {
    if (selectedStore?.storeId) {
      fetchTickets(selectedStore.storeId, {}, 1);
    } else {
      reset();
    }
  }, [selectedStore?.storeId, fetchTickets, reset]);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const refetch = useCallback(() => {
    if (selectedStore?.storeId) {
      fetchTickets(selectedStore.storeId, filters, currentPage);
    }
  }, [selectedStore?.storeId, fetchTickets, filters, currentPage]);

  const reloadCatalog = useCallback(() => {
    loadCatalog();
  }, [loadCatalog]);

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
    filters,
    refetch,
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
