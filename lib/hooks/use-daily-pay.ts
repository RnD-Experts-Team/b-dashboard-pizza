"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useDailyPayStore } from "@/lib/store/daily-pay.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";

/** Normalised store option: integer id (for the API) + display store number. */
export interface DailyPayStoreOption {
  id: number;
  storeNumber: string;
  name: string;
}

/**
 * Main hook for the Daily Pay page.
 *
 * - Owns the list store state (data / loading / error / pagination).
 * - Loads the technician catalog (shared with the maintenance-tickets page)
 *   for filters and the create/edit form.
 * - Derives the store options ({ integer id, store_number }) from the auth
 *   overview — the create endpoint needs the integer `store_id` while the UI
 *   displays the human-readable store number (e.g. "03795-00001").
 *
 * Filters live in the URL and are driven by the page; this hook does not
 * fetch on mount — the page calls `fetchEntries` from its URL-sync effect.
 */
export function useDailyPay() {
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    fetchEntries,
    clearError,
    reset,
  } = useDailyPayStore();

  const { overviewStores } = useAuthStore();

  // ── Store options (integer id ↔ store_number) ─────────────────────────────
  const stores = useMemo<DailyPayStoreOption[]>(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({
          id: Number(s.id),
          storeNumber: s.storeId ?? s.id,
          name: s.name,
        }))
        .filter((s) => Number.isFinite(s.id)),
    [overviewStores]
  );

  // ── Technician catalog ─────────────────────────────────────────────────────
  const [technicians, setTechnicians] = useState<CatalogTechnician[]>([]);
  const [isTechniciansLoading, setIsTechniciansLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setIsTechniciansLoading(true);
    maintenanceTicketsService
      .getCatalogTechnicians(ctrl.signal)
      .then((techs) => setTechnicians(techs.filter((t) => !t.deletedAt)))
      .catch((err) => {
        // Ignore cancelled requests; other failures just leave the list empty.
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      })
      .finally(() => setIsTechniciansLoading(false));
    return () => ctrl.abort();
  }, []);

  const refetch = useCallback(() => {
    fetchEntries(filters, currentPage);
  }, [fetchEntries, filters, currentPage]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    fetchEntries,
    refetch,
    clearError,
    reset,

    stores,
    technicians,
    isTechniciansLoading,
  };
}
