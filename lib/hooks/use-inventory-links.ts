"use client";

import { useCallback, useEffect } from "react";
import { useLinksStore } from "@/lib/store/inventory-links.store";
import type { ListParams } from "@/types/inventory.types";

/**
 * Links for one store + create. Re-fetches whenever the storeId changes.
 * Pass null storeId to avoid fetching until a store is chosen.
 */
export function useStoreLinks(storeId: string | null, initialParams?: ListParams) {
  const {
    links,
    pagination,
    isLoading,
    error,
    fetchLinks,
  } = useLinksStore();

  useEffect(() => {
    if (storeId) fetchLinks(storeId, initialParams);
  }, [storeId, fetchLinks, initialParams]);

  const refetch = useCallback(
    (params?: ListParams) => {
      if (storeId) fetchLinks(storeId, { ...initialParams, ...params });
    },
    [storeId, fetchLinks, initialParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (storeId) fetchLinks(storeId, { ...initialParams, page });
    },
    [storeId, fetchLinks, initialParams]
  );

  return { links, pagination, isLoading, error, refetch, handlePageChange };
}

/**
 * Create-link helpers (used by the create-link dialog).
 */
export function useCreateLinks() {
  const {
    isCreating,
    createError,
    createdLinks,
    createLinks,
    clearCreated,
    clearErrors,
  } = useLinksStore();

  return {
    isCreating,
    createError,
    createdLinks,
    createLinks,
    clearCreated,
    clearErrors,
  };
}
