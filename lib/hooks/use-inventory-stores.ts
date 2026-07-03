"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";

/** A store option for the inventory store picker. */
export interface InventoryStoreOption {
  /** Numeric internal id (e.g. "48"). */
  id: string;
  /** Human-readable identifier (e.g. "03795-00001") — the default value we send. */
  storeId: string;
  name: string;
}

/**
 * Store list for inventory pickers, derived from the auth store's `overviewStores`
 * (already loaded from /auth/general-overview at login — no extra request).
 *
 * NOTE: the inventory backend's store_id format may differ from these values,
 * so the picker that consumes this is editable (the user can override).
 */
export function useInventoryStores() {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const authLoading = useAuthStore((s) => s.isLoading);

  const stores = useMemo<InventoryStoreOption[]>(
    () =>
      (overviewStores ?? []).map((s) => ({
        id: s.id,
        storeId: s.storeId ?? s.id,
        name: s.name,
      })),
    [overviewStores]
  );

  return { stores, isLoading: authLoading && stores.length === 0 };
}
