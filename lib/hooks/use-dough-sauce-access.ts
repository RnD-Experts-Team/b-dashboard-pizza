"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";
import { buildDoughSauceAccess, type DoughSauceAccess } from "@/lib/dough-sauce/access";

/**
 * The signed-in user's Dough & Sauce access (pages + actions), derived from the
 * pizzasys auth rules. Re-evaluates when the rules or permissions change.
 */
export function useDoughSauceAccess(): DoughSauceAccess {
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const overviewStores = useAuthStore((s) => s.overviewStores);
  // canAccessRoute reads these through get(); subscribing makes the memo recompute when they load/change.
  const authRules = useAuthStore((s) => s.authRules);
  const globalPermissions = useAuthStore((s) => s.globalPermissions);
  const storePermissions = useAuthStore((s) => s.storePermissions);
  const user = useAuthStore((s) => s.user);

  return useMemo(
    () => buildDoughSauceAccess({ canAccessRoute }, (overviewStores ?? []).map((s) => s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canAccessRoute, overviewStores, authRules, globalPermissions, storePermissions, user]
  );
}
