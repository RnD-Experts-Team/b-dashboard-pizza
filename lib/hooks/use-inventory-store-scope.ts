"use client";

import { useAuthStore } from "@/lib/auth/auth.store";
import { useInventoryStores, type InventoryStoreOption } from "@/lib/hooks/use-inventory-stores";

export interface InventoryStoreScope {
  /** Stores the current user may pick from (all assigned stores, or — for a
   *  store_manager — only the stores they manage). */
  stores: InventoryStoreOption[];
  /** True when the user is a store_manager pinned to a single store. */
  isLocked: boolean;
  /** The store_id (human-readable) to lock to, or null when not locked. */
  lockedStoreId: string | null;
}

/**
 * Store list for inventory pickers with a store_manager lock.
 *
 * A store_manager (who is not a super-admin) is restricted to the store(s) where
 * they actually hold the `store_manager` role; when that resolves to a single
 * store the picker is locked to it. Everyone else sees all their assigned stores.
 * Employees follow the selected store (see `useInventoryEmployees`), so locking
 * the store also limits the visible employees.
 */
export function useInventoryStoreScope(): InventoryStoreScope {
  const { stores } = useInventoryStores();
  const hasRole = useAuthStore((s) => s.hasRole);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const getStoreRoles = useAuthStore((s) => s.getStoreRoles);

  const isStoreManager = hasRole("store_manager") && !isSuperAdmin();

  const managed = isStoreManager
    ? stores.filter((s) => getStoreRoles(s.id).includes("store_manager"))
    : stores;

  // Fallback: if we can't resolve the managed stores, don't trap the user —
  // fall back to their full assigned set.
  const scoped = isStoreManager && managed.length > 0 ? managed : stores;
  const isLocked = isStoreManager && scoped.length === 1;
  const lockedStoreId = isLocked ? (scoped[0].storeId ?? scoped[0].id) : null;

  return { stores: scoped, isLocked, lockedStoreId };
}
