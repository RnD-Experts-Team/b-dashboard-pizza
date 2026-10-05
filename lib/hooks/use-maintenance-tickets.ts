"use client";

import { useEffect, useCallback, useRef } from "react";
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
    analytics,
    analyticsLoading,
    analyticsError,
    fetchAnalytics,
    baseAnalytics,
    baseAnalyticsLoading,
    fetchBaseAnalytics,
    setMode,
    setScopedStoreIds,
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

  // Fetch tickets when the effective store or mode changes.
  //
  // On mount (and on a re-run for the same store/mode, e.g. StrictMode) the
  // filters and page already in the store are kept: that is what makes coming
  // back from a ticket land on the same list instead of a fresh one. A genuine
  // store/mode change still starts clean, because filter values such as
  // technician or issue ids belong to the store they were picked in.
  const lastScopeRef = useRef<string | null>(null);
  useEffect(() => {
    const scope = `${mode}:${effectiveStoreId ?? ""}`;
    const keepView = lastScopeRef.current === null || lastScopeRef.current === scope;
    lastScopeRef.current = scope;
    const { filters: keptFilters, currentPage: keptPage } =
      useMaintenanceTicketsStore.getState();
    const nextFilters = keepView ? keptFilters : {};
    const nextPage = keepView ? keptPage : 1;

    if (mode === "global") {
      fetchTickets(undefined, nextFilters, nextPage);
      fetchAnalytics(undefined, nextFilters);
      fetchBaseAnalytics(undefined);
    } else if (effectiveStoreId) {
      fetchTickets(effectiveStoreId, nextFilters, nextPage);
      fetchAnalytics(effectiveStoreId, nextFilters);
      fetchBaseAnalytics(effectiveStoreId);
    } else {
      reset();
    }
  }, [mode, effectiveStoreId, fetchTickets, fetchAnalytics, fetchBaseAnalytics, reset]);

  // Load catalog on mount (and whenever the effective store changes)
  useEffect(() => {
    loadCatalog(effectiveStoreId ?? undefined);
  }, [loadCatalog, effectiveStoreId]);

  const refetch = useCallback(() => {
    if (mode === "global") {
      fetchTickets(undefined, filters, currentPage);
      fetchAnalytics(undefined, filters);
      fetchBaseAnalytics(undefined);
    } else if (effectiveStoreId) {
      fetchTickets(effectiveStoreId, filters, currentPage);
      fetchAnalytics(effectiveStoreId, filters);
      fetchBaseAnalytics(effectiveStoreId);
    }
  }, [
    mode,
    effectiveStoreId,
    fetchTickets,
    fetchAnalytics,
    fetchBaseAnalytics,
    filters,
    currentPage,
  ]);

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
    setScopedStoreIds,
    goToPage,
    applyFilters,
    clearError,

    // Analytics
    analytics,
    analyticsLoading,
    analyticsError,
    baseAnalytics,
    baseAnalyticsLoading,

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
