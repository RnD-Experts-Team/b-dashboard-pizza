import type { AuthRule } from "@/types/auth-rule.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanAccessParams {
  /** Backend service identifier, e.g. "Data", "QA" */
  service: string;
  /** HTTP method, e.g. "GET", "POST" */
  method: string;
  /** Path to test against path_regex, e.g. "/engine/keys" */
  path: string;
  /**
   * The store the request is for (numeric store id). A "scoped" rule checks
   * only the permissions held at this store; with none given it checks global
   * permissions if the rule allows an empty store, else denies. Rules in
   * "none" mode ignore it, exactly as the server does.
   */
  storeId?: string;
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * PHP-style regex delimiters produced by the backend look like:
 *   #^/export/[^/]+$#
 *
 * Strip leading/trailing delimiter char so we get a plain JS regex string.
 */
function stripPhpDelimiters(raw: string): string {
  if (raw.length < 2) return raw;
  const delimiter = raw[0];
  // Find the last occurrence of the delimiter (ignore flags after it)
  const lastIndex = raw.lastIndexOf(delimiter, raw.length - 1);
  if (lastIndex <= 0) return raw;
  return raw.slice(1, lastIndex);
}

function buildRegex(raw: string): RegExp | null {
  try {
    return new RegExp(stripPhpDelimiters(raw));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Pure authorization check — no React, no Zustand.
 *
 * @param params        What resource the user wants to access
 * @param globalPerms   Set of global permission names for the current user
 * @param storePerms    Map of storeId → Set of permission names
 * @param authRules     The active auth rules from /auth/general-overview
 * @param globalRoles   Names of the user's GLOBAL roles (for rules' roles_any)
 * @returns             `true` if the user is authorized, `false` otherwise
 */
export function canAccess(
  params: CanAccessParams,
  globalPerms: Set<string>,
  storePerms: Record<string, Set<string>>,
  authRules: AuthRule[],
  globalRoles: string[] = []
): boolean {
  const { service, method, path, storeId } = params;

  // ------------------------------------------------------------------
  // Step 1 — Find the highest-priority matching active rule
  // ------------------------------------------------------------------
  const candidates = authRules
    .filter((r) => {
      if (!r.isActive && !r.is_active) return false;
      const rService = r.service;
      const rMethod = r.method;
      if (
        rService.toLowerCase() !== service.toLowerCase() ||
        rMethod.toUpperCase() !== method.toUpperCase()
      ) {
        return false;
      }
      const rawRegex = r.pathRegex ?? r.path_regex;
      if (!rawRegex) return false;
      const regex = buildRegex(rawRegex);
      return regex ? regex.test(path) : false;
    })
    // lower priority number = higher priority (sort ascending)
    .sort((a, b) => a.priority - b.priority);

  if (candidates.length === 0) {
    // Default deny — no matching rule found
    return false;
  }

  const rule = candidates[0];

  // ------------------------------------------------------------------
  // Step 2/3 — Evaluate exactly as pizzasys AuthorizationResolver does,
  // so a control shows only when the server will let the request through.
  // ------------------------------------------------------------------

  // roles_any: a GLOBAL role named here passes in every scope mode.
  const rolesAny = rule.rolesAny ?? rule.roles_any;
  if (rolesAny && rolesAny.some((r) => globalRoles.includes(r))) return true;

  const scopeMode = rule.storeScopeMode ?? rule.store_scope_mode ?? "none";
  const allowsEmpty = Boolean(rule.storeAllowsEmpty ?? rule.store_allows_empty);

  const any = rule.permissionsAny ?? rule.permissions_any;
  const all = rule.permissionsAll ?? rule.permissions_all;

  // permissions_any OR permissions_all; a rule with neither lets anyone through.
  function passesAgainst(permSet: Set<string>): boolean {
    const hasAny = !!any && any.length > 0;
    const hasAll = !!all && all.length > 0;
    if (!hasAny && !hasAll) return true;
    if (hasAny && any.some((p) => permSet.has(p))) return true;
    if (hasAll && all.every((p) => permSet.has(p))) return true;
    return false;
  }

  // Scoped: only the permissions held at that store. With no store, the server
  // checks global permissions if the rule allows an empty store, else denies.
  if (scopeMode === "scoped") {
    if (storeId) return passesAgainst(storePerms[String(storeId)] ?? new Set());
    return allowsEmpty ? passesAgainst(globalPerms) : false;
  }

  // none / all_stores: GLOBAL permissions only — a storeId is ignored, as on
  // the server. (all_stores also requires a store role at every active store,
  // which this check cannot see; no rule uses that mode today.)
  if (scopeMode === "none" || scopeMode === "all_stores") {
    return passesAgainst(globalPerms);
  }

  // Unknown mode: the server denies.
  return false;
}

// ---------------------------------------------------------------------------
// Normalisation helpers (used by the auth store)
// ---------------------------------------------------------------------------

export interface NormalizedAuthState {
  globalPermissions: Set<string>;
  storePermissions: Record<string, Set<string>>;
}

/**
 * Derive globalPermissions and storePermissions from the raw /auth/me payload.
 *
 * global_roles[].permissions[]  → globalPermissions
 * stores[].effective_permissions[]  → storePermissions[storeId]
 */
export function normalizeAuthPermissions(user: {
  // Accept both API snake_case and frontend camelCase shapes.
  // Prefer already-flattened lists when present.
  all_permissions?: Array<{ name: string }>;
  allPermissions?: Array<{ name: string }>;
  global_roles?: Array<{ permissions?: Array<{ name: string }> }>;
  globalRoles?: Array<{ permissions?: Array<{ name: string }> }>;
  stores?: Array<{
    store: { id: string | number; store_id?: string };
    // API shape
    effective_permissions?: Array<{ name: string }>;
    // Frontend transformed shape
    effectivePermissions?: Array<{ name: string }>;
  }>;
} | null): NormalizedAuthState {
  const globalPermissions = new Set<string>();
  const storePermissions: Record<string, Set<string>> = {};

  if (!user) return { globalPermissions, storePermissions };

  // Global permissions — explicitly read from `global_permissions` and
  // `global_roles` (supporting both API snake_case and frontend camelCase).
  const gp: any[] = (user as any).globalPermissions ?? (user as any).global_permissions ?? [];
  if (Array.isArray(gp) && gp.length > 0) {
    gp.forEach((p: any) => {
      if (!p) return;
      if (typeof p === "string") globalPermissions.add(p);
      else if (typeof p.name === "string") globalPermissions.add(p.name);
    });
  }

  const roles = (user as any).globalRoles ?? (user as any).global_roles ?? [];
  if (Array.isArray(roles) && roles.length > 0) {
    roles.forEach((role: any) => {
      role?.permissions?.forEach((p: any) => {
        if (!p) return;
        if (typeof p === "string") globalPermissions.add(p);
        else if (typeof p.name === "string") globalPermissions.add(p.name);
      });
    });
  }

  // Store-scoped permissions — from effective_permissions per store
  // Store-scoped permissions — support both API and frontend key names.
  user.stores?.forEach((assignment) => {
    const id = String(assignment.store.store_id ?? assignment.store.id);
    const set = new Set<string>();
    const eff = (assignment as any).effectivePermissions ?? assignment.effective_permissions;
    eff?.forEach((p: { name: string }) => set.add(p.name));
    storePermissions[id] = set;
  });

  return { globalPermissions, storePermissions };
}
