"use client";

import { useCallback, useEffect, useState } from "react";
import { useItemsStore } from "@/lib/store/inventory-items.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { itemService } from "@/lib/api/services/inventory.service";
import {
  getInventoryErrorMessage,
  isCanceledError,
} from "@/lib/api/inventory-errors";
import type { Item, ListParams } from "@/types/inventory.types";

/**
 * Items list + mutations.
 *
 * `storeId` (the ambient dashboard store) is sent as an X-Store-Id header so
 * the backend's now store-scoped list rule can authorize store-scoped
 * permissions (e.g. a store_manager's "inventory handling" grant).
 *
 * The GET /inventory/items rule is store-scoped, so we must not fire until a
 * store id is known — otherwise the first (pre-hydration) request has no header
 * and 403s. Super-admins bypass backend authz and may have no assigned store,
 * so they fetch regardless.
 */
export function useItems(initialParams?: ListParams, storeId?: string) {
  const {
    items,
    pagination,
    isLoading,
    isDeleting,
    error,
    deleteError,
    fetchItems,
    deleteItem,
    clearErrors,
  } = useItemsStore();

  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const canFetch = Boolean(storeId) || isSuperAdmin;

  useEffect(() => {
    if (canFetch) fetchItems(initialParams, storeId);
  }, [canFetch, fetchItems, initialParams, storeId]);

  const refetch = useCallback(
    (params?: ListParams) => fetchItems({ ...initialParams, ...params }, storeId),
    [fetchItems, initialParams, storeId]
  );

  const handlePageChange = useCallback(
    (page: number) => fetchItems({ ...initialParams, page }, storeId),
    [fetchItems, initialParams, storeId]
  );

  return {
    items,
    pagination,
    isLoading,
    isDeleting,
    error,
    deleteError,
    refetch,
    handlePageChange,
    deleteItem,
    clearErrors,
  };
}

/**
 * Fetch a single item by ID with its full detail (units, stores, etc.).
 * Uses local state so it doesn't conflict with the edit-page `currentItem` slot.
 * Pass `null` to skip (e.g. while the sheet is closed). `storeId` is forwarded
 * as X-Store-Id — see `useItems` for why.
 */
export function useItemDetail(id: number | null, storeId?: string) {
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const canFetch = Boolean(storeId) || isSuperAdmin;

  useEffect(() => {
    if (!id || !canFetch) {
      setItem(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    itemService
      .get(id, storeId, controller.signal)
      .then((i) => {
        setItem(i);
        setIsLoading(false);
      })
      .catch((e) => {
        if (!isCanceledError(e)) {
          setError(getInventoryErrorMessage(e));
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, storeId, canFetch]);

  return { item, isLoading, error };
}

/**
 * Single item loader (for the edit page). Pass null to skip fetching.
 * `storeId` is forwarded as X-Store-Id — see `useItems` for why (incl. the
 * store-id gate so a store-scoped request never fires without the header).
 */
export function useItem(id: number | null, storeId?: string) {
  const { currentItem, isLoadingItem, itemError, fetchItem } = useItemsStore();

  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const canFetch = Boolean(storeId) || isSuperAdmin;

  useEffect(() => {
    if (id != null && canFetch) fetchItem(id, storeId);
  }, [id, storeId, canFetch, fetchItem]);

  return { item: currentItem, isLoading: isLoadingItem, error: itemError };
}

/**
 * Create/update helpers for the item form.
 */
export function useItemMutations() {
  const { isSaving, saveError, createItem, updateItem, clearErrors } =
    useItemsStore();

  return { isSaving, saveError, createItem, updateItem, clearErrors };
}
