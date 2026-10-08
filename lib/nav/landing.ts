import type { CanAccessParams } from "@/lib/auth/can-access";
import { BOTTOM_NAV_ELIGIBLE_ITEMS, type BottomNavItem } from "./bottom-nav-items";
import { isBottomNavItemEligible } from "./bottom-nav-access";

interface LandingAuth {
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (params: CanAccessParams) => boolean;
}

/**
 * Where someone lands after signing in: the first dashboard in the nav's
 * Dashboards group they can open, in the group's order (DSPR, Labor,
 * Maintenance Analytics). Null when they can open none of them -- they stay
 * on the default screen.
 *
 * Reads the bottom-nav mirror of the sidebar, the same list and the same
 * access check the nav itself uses, so landing never disagrees with what the
 * nav shows.
 */
export function firstDashboard(auth: LandingAuth, storeId?: string): BottomNavItem | null {
  return (
    BOTTOM_NAV_ELIGIBLE_ITEMS.find(
      (item) => item.groupKey === "dashboards" && isBottomNavItemEligible(item, auth, storeId),
    ) ?? null
  );
}
