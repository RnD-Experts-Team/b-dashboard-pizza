"use client";

import { useCallback, useEffect, useState } from "react";
import { useItemsStore } from "@/lib/store/inventory-items.store";
import { itemService } from "@/lib/api/services/inventory.service";
import {
  getInventoryErrorMessage,
  isCanceledError,
} from "@/lib/api/inventory-errors";
import type { Item, ListParams } from "@/types/inventory.types";

/**
 * Items list + mutations.
 */
export function useItems(initialParams?: ListParams) {
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

  useEffect(() => {
    fetchItems(initialParams);
  }, [fetchItems, initialParams]);

  const refetch = useCallback(
    (params?: ListParams) => fetchItems({ ...initialParams, ...params }),
    [fetchItems, initialParams]
  );

  const handlePageChange = useCallback(
    (page: number) => fetchItems({ ...initialParams, page }),
    [fetchItems, initialParams]
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
 * Pass `null` to skip (e.g. while the sheet is closed).
 */
export function useItemDetail(id: number | null) {
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setItem(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    itemService
      .get(id, controller.signal)
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
  }, [id]);

  return { item, isLoading, error };
}

/**
 * Single item loader (for the edit page). Pass null to skip fetching.
 */
export function useItem(id: number | null) {
  const { currentItem, isLoadingItem, itemError, fetchItem } = useItemsStore();

  useEffect(() => {
    if (id != null) fetchItem(id);
  }, [id, fetchItem]);

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
