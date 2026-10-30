"use client";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Lookups the payment screens need beyond the payments data layer          */
/*                                                                            */
/*  - stores: the dashboard's own list (auth overview). Each has the numeric */
/*    stores.id (what a payment line's `store_id` takes) AND the store       */
/*    number (what the list filter and the ticket routes take).              */
/*  - a store's ticket issues, for the line's Tickets multi-select.          */
/*  - storage locations and their place levels, for parts into storage.     */
/* ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { storageService } from "@/lib/api/services/storage.service";
import { useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";

export interface StoreOption {
  /** Numeric stores.id. */
  id: number;
  storeNumber: string;
  name: string;
}

export function useStoreOptions() {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const stores = useMemo<StoreOption[]>(
    () =>
      overviewStores
        .filter((s) => s.isActive && Number.isFinite(Number(s.id)))
        .map((s) => ({ id: Number(s.id), storeNumber: s.storeId ?? s.id, name: s.name }))
        .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber)),
    [overviewStores],
  );
  const resolveStoreId = useCallback(
    (storeNumber: string) => stores.find((s) => s.storeNumber === storeNumber)?.id ?? null,
    [stores],
  );
  const storeNumberOf = useCallback(
    (id: string | number | null | undefined) => (id == null || id === "" ? null : stores.find((s) => s.id === Number(id))?.storeNumber ?? null),
    [stores],
  );
  return { stores, resolveStoreId, storeNumberOf };
}

export interface StoreIssueOption {
  id: number;
  ticketId: number;
  title: string;
  status: string | null;
  statusLabel: string | null;
}

/** Enough for any store's live tickets; the line picks from what it shows. */
const STORE_TICKETS_PER_PAGE = 100;
const CACHE_TTL_MS = 60_000;
const CANCELLED = "cancelled";

const issueCache = new Map<string, { at: number; promise: Promise<StoreIssueOption[]> }>();

async function fetchStoreIssues(storeNumber: string): Promise<StoreIssueOption[]> {
  try {
    const res = await maintenanceTicketsService.getTickets(storeNumber, { per_page: STORE_TICKETS_PER_PAGE });
    return res.data.flatMap((ticket) =>
      ticket.issues
        .filter((issue) => issue.status?.value !== CANCELLED)
        .map((issue) => ({
          id: issue.id,
          ticketId: ticket.id,
          title: issue.title,
          status: issue.status?.value ?? null,
          statusLabel: issue.status?.label ?? null,
        })),
    );
  } catch (err) {
    // A failed read is never served from the cache.
    issueCache.delete(storeNumber);
    throw err;
  }
}

/** Shared by every line on the same store, so it is not tied to one caller's abort signal. */
function loadStoreIssues(storeNumber: string): Promise<StoreIssueOption[]> {
  const hit = issueCache.get(storeNumber);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = fetchStoreIssues(storeNumber);
  issueCache.set(storeNumber, { at: Date.now(), promise });
  return promise;
}

/** The store's open and closed ticket issues (cancelled ones left out). */
export function useStoreIssues(storeNumber: string | null) {
  const res = useMaintenanceResource(storeNumber ? `store-issues:${storeNumber}` : null, () =>
    loadStoreIssues(storeNumber as string),
  );
  return { ...res, issues: res.data ?? [] };
}

export function useStorageLocations(enabled: boolean) {
  const res = useMaintenanceResource(enabled ? "storage-locations" : null, (signal) => storageService.listStorageLocations(signal));
  return { ...res, locations: res.data ?? [] };
}

export function usePlaceLevels(locationId: number | null) {
  const res = useMaintenanceResource(locationId ? `place-levels:${locationId}` : null, (signal) =>
    storageService.getPlaceLevels(locationId as number, signal),
  );
  const levels = useMemo(
    () => (res.data ?? []).filter((l) => !l.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [res.data],
  );
  return { ...res, levels };
}
