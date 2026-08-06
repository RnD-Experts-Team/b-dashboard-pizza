import type { CanAccessParams } from "./can-access";

/**
 * Access rules for the Cleaning Chart page's tabs, defined one tab at a time
 * as the corresponding backend Auth Rules are set up. A tab with no entry
 * here is fail-open (visible to everyone) — matches the sidebar's default
 * behavior for pages that don't have rules configured yet.
 */
export type CleaningTabId = "due" | "tasks" | "evaluation" | "reports";

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
