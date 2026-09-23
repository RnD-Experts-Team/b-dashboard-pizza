import type { CanAccessParams } from "@/lib/auth/can-access";
import { BOTTOM_NAV_ELIGIBLE_ITEMS, type BottomNavItem } from "./bottom-nav-items";

interface BottomNavAuth {
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (params: CanAccessParams) => boolean;
}

export const MAX_BOTTOM_NAV_ITEMS = 4;

/**
 * Same 3-branch visibility check sidebar.tsx's isNavItemVisible uses.
 * Deliberately does NOT special-case super admins for `requiredPermission`
 * items — hasPermission() doesn't auto-bypass for them either in sidebar.tsx,
 * only canAccessRoute() does. Kept consistent rather than "fixed" here.
 */
export function isBottomNavItemEligible(
  item: BottomNavItem,
  auth: BottomNavAuth,
  storeId?: string
): boolean {
  if (item.requiredPermission) {
    return auth.hasPermission(item.requiredPermission);
  }
  if (item.requirements) {
    return item.requirements(storeId).some((req) => auth.canAccessRoute(req));
  }
  return true;
}

export function getEligibleBottomNavItems(
  auth: BottomNavAuth,
  storeId?: string
): BottomNavItem[] {
  return BOTTOM_NAV_ELIGIBLE_ITEMS.filter((item) =>
    isBottomNavItemEligible(item, auth, storeId)
  );
}

export function getDefaultBottomNavItemIds(
  auth: BottomNavAuth,
  storeId?: string
): string[] {
  return getEligibleBottomNavItems(auth, storeId)
    .slice(0, MAX_BOTTOM_NAV_ITEMS)
    .map((item) => item.id);
}
