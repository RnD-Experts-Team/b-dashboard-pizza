import type { CanAccessParams } from "./can-access";

/**
 * Access rules for the Shirt Milestones views, in the same shape as
 * cleaning-access.ts: a rules map plus plain functions (not hooks) that callers
 * feed the auth-store functions into, so they are safe inside .filter()/.map().
 */
export type ShirtViewId = "store_queue" | "fulfilment" | "catalog_admin";

interface ShirtViewRule {
  /** Any ONE of these route checks (via canAccessRoute) grants access. */
  requirements: (storeId?: string) => CanAccessParams[];
  /** Roles that always see this view, regardless of the permission rules above. */
  rolesAny?: string[];
}

/**
 * The HQ fulfilment role. Matched against the auth store's `roles`, which is
 * extractRoles() → globalRoles[].name ∪ stores[].effectiveRoles[].name — the
 * role's display NAME, not a slug. If the auth server ever stores this as
 * "employee_obsession" instead, this fails closed and the fulfilment view
 * simply never appears; add the slug here if that turns out to be the case.
 */
export const SHIRT_FULFILMENT_ROLE = "Employee Obsession";

export const SHIRT_VIEW_RULES: Partial<Record<ShirtViewId, ShirtViewRule>> = {
  // The store manager's own queue. Store-scoped on the backend, so these pass
  // a storeId.
  store_queue: {
    rolesAny: ["store_manager"],
    requirements: (storeId) => [
      { service: "Hiring", method: "GET", path: "/v1/stores/*/shirt-milestones", storeId },
      {
        service: "Hiring",
        method: "POST",
        path: "/v1/stores/*/shirt-milestones/*/entry",
        storeId,
      },
      { service: "Hiring", method: "GET", path: "/v1/stores/*/employees/*/shirts", storeId },
      // Fail-soft. canAccess() default-DENIES when no auth rule matches the
      // service/method/path, and the auth server has not necessarily registered
      // rules for the shirt routes yet. Without this, the tab would vanish for
      // everyone but super admins on day one. Anyone who can already open this
      // page keeps seeing the tab, and a genuine 403 then surfaces in the view's
      // own error state instead — which is how the tab this one replaced
      // behaved: visible to everyone who could reach the page.
      { service: "Hiring", method: "GET", path: "/v1/stores/*/requests", storeId },
    ],
  },

  // HQ fulfilment. NO storeId is passed, deliberately: these backend routes are
  // unscoped, and canAccess() given a storeId checks that store's permissions
  // first and grants on a match — which the server does not mirror. Passing one
  // would show fulfilment buttons to store managers who then get a 403. Same
  // caveat cleaning-access.ts documents on canEvaluateCleaning.
  fulfilment: {
    rolesAny: [SHIRT_FULFILMENT_ROLE],
    requirements: () => [
      { service: "Hiring", method: "GET", path: "/v1/shirt-milestones" },
      { service: "Hiring", method: "POST", path: "/v1/shirt-milestones/*/order" },
      { service: "Hiring", method: "PATCH", path: "/v1/shirt-milestones/*/delivery-date" },
      { service: "Hiring", method: "POST", path: "/v1/shirt-milestones/*/deliver" },
      { service: "Hiring", method: "POST", path: "/v1/shirt-milestones/*/cancel" },
    ],
  },

  // Catalog admin — also unscoped, same no-storeId reasoning.
  catalog_admin: {
    rolesAny: [SHIRT_FULFILMENT_ROLE],
    requirements: () => [
      { service: "Hiring", method: "POST", path: "/v1/shirt-colors" },
      { service: "Hiring", method: "POST", path: "/v1/shirt-logos" },
      { service: "Hiring", method: "POST", path: "/v1/shirt-templates" },
    ],
  },
};

export interface ShirtAuth {
  canAccessRoute: (params: CanAccessParams) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

/**
 * Whether this user may see a shirt view. `canAccessRoute` already returns true
 * for super admins, so there is no isSuperAdmin() special-casing anywhere in
 * this module.
 */
export function canAccessShirtView(
  viewId: ShirtViewId,
  auth: ShirtAuth,
  storeId?: string,
): boolean {
  const rule = SHIRT_VIEW_RULES[viewId];
  if (!rule) return true;
  if (rule.rolesAny && auth.hasAnyRole(rule.rolesAny)) return true;
  return rule.requirements(storeId).some((req) => auth.canAccessRoute(req));
}

/**
 * Whether this user may fill an entry form.
 *
 * Deliberately the single POST rule rather than the whole store_queue view: a
 * store manager reaching the queue via `rolesAny` should not automatically get
 * the write button if the backend rule says otherwise.
 */
export function canFillShirtEntry(
  auth: Pick<ShirtAuth, "canAccessRoute">,
  storeId?: string,
): boolean {
  return auth.canAccessRoute({
    service: "Hiring",
    method: "POST",
    path: "/v1/stores/*/shirt-milestones/*/entry",
    storeId,
  });
}

/** Whether this user may create a manual milestone (the "New Entry" button). */
export function canCreateManualShirtMilestone(
  auth: Pick<ShirtAuth, "canAccessRoute">,
  storeId?: string,
): boolean {
  return auth.canAccessRoute({
    service: "Hiring",
    method: "POST",
    path: "/v1/stores/*/shirt-milestones",
    storeId,
  });
}

/**
 * Drives every fulfilment action — order, reschedule, deliver, cancel. No
 * storeId, for the reason documented on the `fulfilment` rule above.
 */
export function canFulfilShirtMilestone(auth: ShirtAuth): boolean {
  return (
    auth.hasAnyRole([SHIRT_FULFILMENT_ROLE]) ||
    auth.canAccessRoute({
      service: "Hiring",
      method: "POST",
      path: "/v1/shirt-milestones/*/order",
    })
  );
}

export function canManageShirtCatalog(auth: ShirtAuth): boolean {
  return canAccessShirtView("catalog_admin", auth);
}

/**
 * For sidebar.tsx and bottom-nav-items.ts, which take a plain CanAccessParams[]
 * and cannot express rolesAny. Both gates are `.some(...)`, so adding this
 * alongside the existing store-scoped requests rule is purely additive: store
 * users keep matching on that one, and a fulfilment-only user gets the page
 * via this one.
 */
export const SHIRT_NAV_REQUIREMENT: CanAccessParams = {
  service: "Hiring",
  method: "GET",
  path: "/v1/shirt-milestones",
};
