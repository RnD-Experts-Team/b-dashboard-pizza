import type { CanAccessParams } from "./can-access";

/**
 * Access rules for the Cleaning Chart page's tabs, defined one tab at a time
 * as the corresponding backend Auth Rules are set up. A tab with no entry
 * here is fail-open (visible to everyone) — matches the sidebar's default
 * behavior for pages that don't have rules configured yet.
 */
export type CleaningTabId = "due" | "tasks" | "evaluation" | "reports" | "my-store";

interface CleaningTabRule {
  /** Any ONE of these route checks (via canAccessRoute) grants access. */
  requirements: (storeId?: string) => CanAccessParams[];
  /** Roles that always see this tab, regardless of the permission rules above. */
  rolesAny?: string[];
}

export const CLEANING_TAB_RULES: Partial<Record<CleaningTabId, CleaningTabRule>> = {
  // Due Today — Store Manager (own store) + Cleaning Specialist (permission-gated
  // via the backend Auth Rules on the QA service's /cleaning/stores/* routes).
  due: {
    rolesAny: ["store_manager"],
    requirements: (storeId) => [
      { service: "QA", method: "GET", path: "/cleaning/stores/*/dates/*/due", storeId },
      { service: "QA", method: "GET", path: "/cleaning/stores/*/due-range", storeId },
      { service: "QA", method: "POST", path: "/cleaning/stores/*/tasks/*/complete", storeId },
      { service: "QA", method: "POST", path: "/cleaning/stores/*/tasks/*/uncomplete", storeId },
      { service: "QA", method: "GET", path: "/cleaning/stores/*/tasks/*/history", storeId },
    ],
  },

  // Tasks — unscoped (store_scope_mode: "none"), Cleaning Specialist permission
  // only (no roles_any on the backend rules — super admin bypasses automatically
  // via canAccessRoute).
  tasks: {
    requirements: () => [
      { service: "QA", method: "GET", path: "/cleaning/tasks" },
      { service: "QA", method: "POST", path: "/cleaning/tasks" },
      { service: "QA", method: "GET", path: "/cleaning/tasks/*" },
      { service: "QA", method: "PUT", path: "/cleaning/tasks/*" },
      { service: "QA", method: "DELETE", path: "/cleaning/tasks/*" },
    ],
  },

  // Evaluation — unscoped, Cleaning Specialist permission only.
  evaluation: {
    requirements: () => [
      { service: "QA", method: "GET", path: "/cleaning/evaluations" },
      { service: "QA", method: "POST", path: "/cleaning/evaluations" },
      { service: "QA", method: "POST", path: "/cleaning/evaluations/finalize" },
      { service: "QA", method: "GET", path: "/cleaning/inspection-items" },
      { service: "QA", method: "POST", path: "/cleaning/inspection-items" },
      { service: "QA", method: "DELETE", path: "/cleaning/inspection-items/*" },
    ],
  },

  // Reports — unscoped, Cleaning Specialist permission only.
  reports: {
    requirements: () => [
      { service: "QA", method: "GET", path: "/cleaning/reports/data" },
      { service: "QA", method: "GET", path: "/cleaning/reports/csv" },
    ],
  },

  // My Store — Store Manager's own read-only evaluation results. Needs the
  // backend to allow a store manager to call GET /cleaning/evaluations,
  // store-scoped to their own store (see the handoff note in the plan) — this
  // rolesAny entry makes the tab itself visible regardless of that permission,
  // so the view can show its own "no access yet" state rather than the tab
  // just disappearing.
  "my-store": {
    rolesAny: ["store_manager"],
    requirements: (storeId) => [
      { service: "QA", method: "GET", path: "/cleaning/evaluations", storeId },
    ],
  },
};

/**
 * Plain function (not a hook) so it's safe to call inside .filter()/.map() —
 * callers pass in the auth-store functions they already obtained via useAuthStore().
 */
export function canAccessCleaningTab(
  tabId: CleaningTabId,
  auth: {
    canAccessRoute: (params: CanAccessParams) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
  },
  storeId?: string
): boolean {
  const rule = CLEANING_TAB_RULES[tabId];
  if (!rule) return true;
  if (rule.rolesAny && auth.hasAnyRole(rule.rolesAny)) return true;
  return rule.requirements(storeId).some((req) => auth.canAccessRoute(req));
}

/**
 * Whether this user may set evaluation verdicts — used by the Due list's
 * Evaluate shortcut, which writes a chart cell without leaving the page.
 *
 * Deliberately checks the POST /evaluations rule only, NOT the whole
 * `evaluation` tab: the tab is reachable by anyone holding any one of its
 * six requirements (including read-only ones), whereas this action writes.
 * A store_manager reaching Due via `rolesAny` therefore does not get it.
 *
 * Deliberately passes NO storeId. The backend rule for this route is
 * `store_scope_mode: "none"`, so the server authorizes it against the user's
 * GLOBAL permissions only and ignores store-level ones. `canAccess` (see
 * can-access.ts) does not mirror that for unscoped rules: given a storeId it
 * checks that store's permissions first and grants access on a match. Store
 * managers are commonly assigned "cleaning specialist" at store level while
 * holding nothing globally, so passing a storeId here showed the Evaluate
 * buttons to users the backend then rejected with 403. Omitting it makes this
 * check evaluate exactly what the server enforces.
 */
export function canEvaluateCleaning(auth: {
  canAccessRoute: (params: CanAccessParams) => boolean;
}): boolean {
  return auth.canAccessRoute({
    service: "QA",
    method: "POST",
    path: "/cleaning/evaluations",
  });
}

/**
 * Whether this user may reopen a finalized evaluation. The migration guide's
 * prose (§8) described this as "Super Admin only", but the backend's actual
 * registered permission for `POST /cleaning/evaluations/reopen` is the same
 * "cleaning specialist" permission that gates the rest of the Evaluation tab
 * — confirmed directly against the live permission registry, not a role
 * restriction at all. Checked as a permission (not a hardcoded role list)
 * specifically so this stays correct regardless of which way that
 * assumption was wrong, the same way `canEvaluateCleaning` mirrors
 * POST /evaluations instead of assuming a role.
 */
export function canReopenCleaningEvaluation(auth: {
  canAccessRoute: (params: CanAccessParams) => boolean;
}): boolean {
  return auth.canAccessRoute({
    service: "QA",
    method: "POST",
    path: "/cleaning/evaluations/reopen",
  });
}

/**
 * Whether this user may change the score formula/shares. Also gated by the
 * "cleaning specialist" permission per the live registry — not Super Admin
 * only, despite guide §9's prose (see `canReopenCleaningEvaluation` above).
 * Still gates the whole Settings dialog (not just the Save button): showing
 * a read-only view of configuration to everyone else who can't save it
 * isn't useful here.
 */
export function canManageCleaningSettings(auth: {
  canAccessRoute: (params: CanAccessParams) => boolean;
}): boolean {
  return auth.canAccessRoute({
    service: "QA",
    method: "PUT",
    path: "/cleaning/settings",
  });
}
