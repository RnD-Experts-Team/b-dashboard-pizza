"use client";

import { useEffect } from "react";
import { useWorkbooksStore } from "@/lib/store/workbooks.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * Folder browser: the tree, the open folder and its contents.
 *
 * Reads are NOT store-scoped (an all_stores_* folder belongs to every store's
 * view at once), so switching store does not refetch. Creates carry the
 * selected store's CODE ("03795-00001") — `storeCode` below.
 */
export function useWorkbooks(folderId: number | null) {
  const { selectedStore } = useSelectedStoreStore();
  const storeCode = selectedStore?.storeId ?? null;
  const storeName = selectedStore?.name ?? null;

  const state = useWorkbooksStore();
  const { openFolder, loadChildren } = state;

  useEffect(() => {
    void loadChildren(null);
  }, [loadChildren]);

  useEffect(() => {
    void openFolder(folderId);
  }, [folderId, openFolder]);

  return { ...state, storeCode, storeName, refetch: state.refreshCurrent };
}
