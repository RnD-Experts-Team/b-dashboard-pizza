"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * The signed-in user's roles at the store selected in the sidebar — the list a
 * workbook "specific roles" tag is picked from.
 *
 * DIRECT roles only. The toolbox matches role grants as stored, with no
 * hierarchy (a GM does not implicitly hold the roles beneath them there), so an
 * inherited role would be pickable here yet match nobody. That is why this is
 * `directRoles`, not the auth store's `getStoreRoles()` (which is the inherited
 * union, and keyed by store code — never the numeric id).
 *
 * Global roles (e.g. super-admin) are not tied to a store, so they are not
 * listed.
 */
export function useMyStoreRoles() {
  const user = useAuthStore((s) => s.user);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);

  // `Store.storeId` is the human code ("03795-00001"); `AuthUserStore.store.id`
  // is the same code. The numeric `Store.id` would never match.
  const storeCode = selectedStore?.storeId ?? null;
  const storeName = selectedStore?.name ?? null;

  const roles = useMemo(() => {
    if (!user || !storeCode) return [];
    const assignment = user.stores?.find((s) => s.store.id === storeCode);
    const names = (assignment?.directRoles ?? []).map((r) => r.name.trim()).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [user, storeCode]);

  return { storeCode, storeName, roles };
}
