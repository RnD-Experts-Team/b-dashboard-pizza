"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";

export interface StoreNumberOption {
  /** The store NUMBER ("03795-00001"): what the maintenance API filters and stores by. */
  value: string;
  label: string;
}

/**
 * The stores the viewer can see, keyed by store number — the maintenance API
 * speaks store numbers (`coverage_stores`, `store=`, `stores[]`), never the
 * auth service's numeric ids.
 */
export function useStoreNumberOptions(): StoreNumberOption[] {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  return useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive && s.storeId)
        .map((s) => ({
          value: s.storeId as string,
          label: s.name ? `${s.storeId} · ${s.name}` : (s.storeId as string),
        }))
        .sort((a, b) => a.value.localeCompare(b.value)),
    [overviewStores],
  );
}
